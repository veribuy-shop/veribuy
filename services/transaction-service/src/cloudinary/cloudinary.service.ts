import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';

@Injectable()
export class CloudinaryService {
  private readonly logger = new Logger(CloudinaryService.name);

  constructor(private readonly configService: ConfigService) {
    cloudinary.config({
      cloud_name: this.configService.getOrThrow<string>('CLOUDINARY_CLOUD_NAME'),
      api_key: this.configService.getOrThrow<string>('CLOUDINARY_API_KEY'),
      api_secret: this.configService.getOrThrow<string>('CLOUDINARY_API_SECRET'),
    });
  }

  /**
   * Upload a PDF buffer to Cloudinary as a raw resource.
   * @param buffer   - The PDF buffer
   * @param folder   - Cloudinary folder (e.g. "invoices/orderId")
   * @param publicId - Unique public ID (without extension)
   * @returns The Cloudinary secure_url for the uploaded PDF
   */
  async uploadPdf(buffer: Buffer, folder: string, publicId: string): Promise<string> {
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
