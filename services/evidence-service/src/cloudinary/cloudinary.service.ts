import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary, UploadApiResponse, UploadApiErrorResponse } from 'cloudinary';

@Injectable()
export class CloudinaryService {
  private readonly logger = new Logger(CloudinaryService.name);

  constructor(private configService: ConfigService) {
    cloudinary.config({
      cloud_name: this.configService.getOrThrow<string>('CLOUDINARY_CLOUD_NAME'),
      api_key: this.configService.getOrThrow<string>('CLOUDINARY_API_KEY'),
      api_secret: this.configService.getOrThrow<string>('CLOUDINARY_API_SECRET'),
    });
  }

  /**
   * Upload a file buffer to Cloudinary.
   * @param buffer     - The file buffer
   * @param folder     - Cloudinary folder path (e.g. "evidence-packs/listingId/PHOTO")
   * @param publicId   - Unique public ID for the asset (without extension)
   * @param mimeType   - MIME type of the file
   * @returns The Cloudinary secure_url
   */
  async uploadFile(
    buffer: Buffer,
    folder: string,
    publicId: string,
    mimeType: string,
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const resourceType = mimeType.startsWith('video/') ? 'video' : 'auto';

      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder,
          public_id: publicId,
          resource_type: resourceType,
          overwrite: true,
        },
        (error: UploadApiErrorResponse | undefined, result: UploadApiResponse | undefined) => {
          if (error) {
            this.logger.error(`Cloudinary upload error: ${error.message}`);
            return reject(error);
          }
          if (!result) {
            return reject(new Error('Cloudinary returned no result'));
          }
          this.logger.log(`Uploaded to Cloudinary: ${result.secure_url}`);
          resolve(result.secure_url);
        },
      );

      uploadStream.end(buffer);
    });
  }

  /**
   * Delete an asset from Cloudinary by its public ID.
   * @param publicId - The Cloudinary public ID (including folder path, without extension)
   */
  async deleteFile(publicId: string): Promise<void> {
    try {
      await cloudinary.uploader.destroy(publicId);
      this.logger.log(`Deleted from Cloudinary: ${publicId}`);
    } catch (error) {
      this.logger.error(`Cloudinary delete error for ${publicId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Extract the Cloudinary public ID from a secure_url.
   * e.g. https://res.cloudinary.com/cloud/image/upload/v123/evidence-packs/abc/PHOTO/uuid
   * => evidence-packs/abc/PHOTO/uuid
   */
  extractPublicId(secureUrl: string): string | null {
    try {
      // Match everything after /upload/v<version>/ or /upload/
      const match = secureUrl.match(/\/upload\/(?:v\d+\/)?(.+?)(?:\.[^.]+)?$/);
      return match ? match[1] : null;
    } catch {
      return null;
    }
  }
}
