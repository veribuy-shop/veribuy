import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';

@Injectable()
export class CloudinaryService {
  private readonly logger = new Logger(CloudinaryService.name);
  private readonly configured: boolean;

  constructor(private readonly configService: ConfigService) {
    const cloudName = this.configService.get<string>('CLOUDINARY_CLOUD_NAME');
    const apiKey    = this.configService.get<string>('CLOUDINARY_API_KEY');
    const apiSecret = this.configService.get<string>('CLOUDINARY_API_SECRET');

    if (cloudName && apiKey && apiSecret) {
      cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret });
      this.configured = true;
    } else {
      this.logger.warn(
        'Cloudinary credentials not configured — PDF uploads will be skipped',
      );
      this.configured = false;
    }
  }

  /**
   * Upload a PDF buffer to Cloudinary as a raw resource.
   * Returns null when Cloudinary is not configured.
   * @param buffer   - The PDF buffer
   * @param folder   - Cloudinary folder (e.g. "invoices/orderId")
   * @param publicId - Unique public ID (without extension)
   * @returns The Cloudinary secure_url, or null if not configured
   */
  async uploadPdf(buffer: Buffer, folder: string, publicId: string): Promise<string | null> {
    if (!this.configured) {
      this.logger.warn(`Cloudinary not configured — skipping PDF upload for ${publicId}`);
      return null;
    }

    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder,
          public_id: publicId,
          resource_type: 'raw',
          overwrite: true,
          format: 'pdf',
        },
        (error, result) => {
          if (error) {
            this.logger.error(`Cloudinary PDF upload error: ${error.message}`);
            return reject(error);
          }
          if (!result) {
            return reject(new Error('Cloudinary returned no result'));
          }
          this.logger.log(`Uploaded PDF to Cloudinary: ${result.secure_url}`);
          resolve(result.secure_url);
        },
      );
      stream.end(buffer);
    });
  }
}
