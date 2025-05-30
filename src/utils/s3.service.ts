import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3,
  ListObjectsV2Output,
  PutObjectCommand,
  ObjectCannedACL,
} from '@aws-sdk/client-s3';
 import { Upload } from '@aws-sdk/lib-storage';
import { randomUUID } from 'crypto';

@Injectable()
export class S3Service {
  protected readonly logger = new Logger(S3Service.name);
  private readonly _bucket: string;

  constructor(
    private config: ConfigService,
    @Inject('S3') private s3Client: S3
  ) {
    this._bucket = this.config.get('S3_BUCKET');
  }

  async uploadFile<T>(
    file: any,
    file_uri: string,
    metadata?: any,
    aclType: ObjectCannedACL = ObjectCannedACL.public_read
  ): Promise<{ url: string; id: string } & T> {
    try {
      let key;
      if (!file) {
        throw new BadRequestException('No file provided.');
      }
      const { originalname, mimetype } = file;
      let uuid = randomUUID();
      const upload = new Upload({
        client: this.s3Client,
        params: {
          Bucket: this._bucket,
          Key: file_uri?.includes('{uuid}')
            ? `${file_uri.replace(/{uuid}/, uuid) || uuid}.${originalname
                ?.split('.')
                ?.at(-1)}`
            : file_uri || uuid,
          Body: Buffer.from(file.buffer),
          ACL: aclType,
          ContentType: mimetype,
        },
      });

      upload.on('httpUploadProgress', (progress) => {
        key = progress.Key;
      });

      await upload.done();
      return { id: uuid, url: key, ...metadata };
    } catch (err) {
      throw new BadRequestException('Invalid file provided.');
    }
  }

  async getFiles(folder_path: string): Promise<ListObjectsV2Output> {
    try {
      const filesResponse = await this.s3Client.listObjectsV2({
        Bucket: this._bucket,
        Delimiter: '/',
        Prefix: folder_path,
      });
      return filesResponse;
    } catch (err) {
      throw new BadRequestException(err.message);
    }
  }

  async getFile(file_path: string) {
    try {
      return await this.s3Client.getObject({
        Bucket: this._bucket,
        Key: file_path,
      });
    } catch (err) {
      return err
    }
  }

  // async getSignedUrl(file_path: string) {
  //   try {
  //     const command = new PutObjectCommand({
  //       Bucket: this._bucket,
  //       Key: file_path,
  //     });
  //     return await getSignedUrl(this.s3Client, command, {
  //       expiresIn: 60 * 60 * 1,
  //     });
  //   } catch (err) {
  //     throw new RpcException(err);
  //   }
  // }

  async deleteFile(file_uri: string) {
    try {
      await this.s3Client.deleteObject({
        Bucket: this._bucket,
        Key: file_uri,
      });
      return true;
    } catch (err) {
      return err
    }
  }
}

