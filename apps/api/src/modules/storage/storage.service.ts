import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class StorageService {
  private readonly s3: S3Client;
  private readonly bucket: string;
  private readonly publicBaseUrl: string;

  constructor(private readonly config: ConfigService) {
    const endpoint = this.config.get<string>('S3_ENDPOINT', '');
    const region = this.config.get<string>('S3_REGION', 'us-east-1');
    this.bucket = this.config.get<string>('S3_BUCKET', 'showprep');
    this.s3 = new S3Client({
      region,
      endpoint: endpoint || undefined,
      forcePathStyle: !!endpoint,
      credentials: endpoint
        ? {
            accessKeyId: this.config.get<string>('S3_ACCESS_KEY', ''),
            secretAccessKey: this.config.get<string>('S3_SECRET_KEY', ''),
          }
        : undefined,
    });
    this.publicBaseUrl = this.config.get<string>('S3_PUBLIC_URL', endpoint ? `${endpoint}/${this.bucket}` : `https://${this.bucket}.s3.${region}.amazonaws.com`);
  }

  async uploadBuffer(key: string, buffer: Buffer, contentType: string): Promise<string> {
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      }),
    );
    return `${this.publicBaseUrl}/${key}`;
  }

  async uploadImage(buffer: Buffer, folder: string): Promise<string> {
    const key = `${folder}/${uuidv4()}.webp`;
    return this.uploadBuffer(key, buffer, 'image/webp');
  }

  async uploadAudio(buffer: Buffer, folder: string): Promise<string> {
    const key = `${folder}/${uuidv4()}.mp3`;
    return this.uploadBuffer(key, buffer, 'audio/mpeg');
  }

  getSignedUrl(key: string, expiresIn = 3600): Promise<string> {
    return getSignedUrl(
      this.s3,
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      { expiresIn },
    );
  }
}
