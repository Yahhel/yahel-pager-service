import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BlobServiceClient, BlockBlobClient } from '@azure/storage-blob';
import { randomUUID } from 'crypto';
import { Response } from 'express';
import { Readable } from 'stream';
import { LogLevel, StorageUtil } from '@shared/interfaces';
import { sanitizeFileName } from './file-validation.util';

const source = 'AzureBlobUtil';

export class AzureBlobUtil implements StorageUtil {
  private readonly configService = new ConfigService();
  private readonly azureConnection: string;
  private readonly containerName: string;

  constructor() {
    this.azureConnection = this.configService.getOrThrow(
      'AZURE_BLOB_STORAGE_CONNECTION_STRING',
    );
    this.containerName = this.configService.getOrThrow(
      'AZURE_BLOB_STORAGE_CONTAINER_NAME',
    );
  }

  public getBlobClient(filename: string): BlockBlobClient {
    const blobServiceClient = BlobServiceClient.fromConnectionString(
      this.azureConnection,
    );
    const containerClient = blobServiceClient.getContainerClient(
      this.containerName,
    );
    return containerClient.getBlockBlobClient(filename);
  }

  private generateBlobFilename(originalName: string): string {
    const sanitized = sanitizeFileName(originalName);
    const lastDotIndex = sanitized.lastIndexOf('.');
    const hasExtension = lastDotIndex > 0;
    const filenameWithoutExt = hasExtension
      ? sanitized.substring(0, lastDotIndex)
      : sanitized;
    const extension = hasExtension ? sanitized.substring(lastDotIndex) : '';

    // Use cryptographically secure random name to prevent predictability
    return `${filenameWithoutExt}-${randomUUID()}${extension}`;
  }

  async uploadFileStreamAsync(
    file: Express.Multer.File,
  ): Promise<{ url: string; publicId: string } | null> {
    try {
      const publicId = this.generateBlobFilename(file.originalname);
      const blobClient = this.getBlobClient(publicId);
      const STREAM_THRESHOLD = 5 * 1024 * 1024;

      if (file.size <= STREAM_THRESHOLD) {
        await blobClient.uploadData(file.buffer, {
          blobHTTPHeaders: { blobContentType: file.mimetype },
        });
      } else {
        await blobClient.uploadStream(
          Readable.from(file.buffer),
          file.size,
          3,
          {
            blobHTTPHeaders: { blobContentType: file.mimetype },
          },
        );
      }

      return { url: blobClient.url, publicId };
    } catch (err) {
      global.dataLogsService.log(
        source,
        { source, stack: err.status, message: err.message },
        LogLevel.ERROR,
      );
      return null;
    }
  }

  async getFileStream(
    publicId: string,
    res: Response,
    rangeHeader?: string,
    isPrivate = false,
  ): Promise<void> {
    // Private content must never be kept by browsers or shared caches
    await this.pipeBlob(publicId, res, rangeHeader, {
      'Cache-Control': isPrivate
        ? 'private, no-cache, no-store, must-revalidate'
        : 'public, max-age=31536000, immutable',
    });
  }

  async downloadFile(
    publicId: string,
    res: Response,
    fileName: string,
    rangeHeader?: string,
  ): Promise<void> {
    const sanitizedFileName = sanitizeFileName(fileName);
    await this.pipeBlob(publicId, res, rangeHeader, {
      'Content-Disposition': `attachment; filename="${sanitizedFileName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      'Cache-Control': 'private, no-cache, no-store, must-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
    });
  }

  async deleteFileAsync(publicId: string): Promise<boolean> {
    try {
      await this.getBlobClient(publicId).deleteIfExists();
      return true;
    } catch (err) {
      global.dataLogsService.log(
        source,
        { source, stack: err.status, message: err.message },
        LogLevel.ERROR,
      );
      return false;
    }
  }

  private async pipeBlob(
    publicId: string,
    res: Response,
    rangeHeader: string | undefined,
    headers: Record<string, string>,
  ): Promise<void> {
    try {
      const blobClient = this.getBlobClient(publicId);
      const exists = await blobClient.exists();

      if (!exists) throw new NotFoundException('File not found');

      const properties = await blobClient.getProperties();
      const fileSize = properties.contentLength;

      let startOffset: number | undefined = undefined;
      let count: number | undefined = undefined;
      let statusCode = 200;
      let contentLength = fileSize;
      let contentRange = '';

      // Handle range requests for resumable downloads and streaming video/audio
      if (rangeHeader && rangeHeader.startsWith('bytes=')) {
        const rangeValues = rangeHeader.replace('bytes=', '').split('-');
        const start = parseInt(rangeValues[0]);
        let end = rangeValues[1] ? parseInt(rangeValues[1]) : fileSize - 1;

        end = Math.min(end, fileSize - 1);

        startOffset = start;
        count = end - start + 1;
        contentLength = count;
        contentRange = `bytes ${start}-${end}/${fileSize}`;
        statusCode = 206; // Partial Content
      }

      const downloadResponse = await blobClient.download(startOffset, count);
      const stream = downloadResponse.readableStreamBody;

      if (!stream) {
        throw new NotFoundException('Unable to create file stream');
      }

      res.status(statusCode);
      res.set({
        'Content-Type':
          downloadResponse.contentType || 'application/octet-stream',
        'Content-Length': contentLength.toString(),
        'Accept-Ranges': 'bytes',
        ETag: properties.etag,
        'Last-Modified': properties.lastModified?.toUTCString(),
        'X-Content-Type-Options': 'nosniff',
        ...headers,
        ...(contentRange && { 'Content-Range': contentRange }),
      });

      stream.pipe(res);

      stream.on('error', (error) => {
        global.dataLogsService.log(
          source,
          {
            source,
            stack: error.stack,
            message: `Stream error during file streaming: ${error.message}`,
          },
          LogLevel.ERROR,
        );
        if (!res.headersSent) {
          res.status(500).json({ error: 'Error streaming file' });
        }
      });

      res.on('close', () => {
        if (!res.writableEnded && 'destroy' in stream) {
          (stream as any).destroy();
        }
      });
    } catch (err) {
      global.dataLogsService.log(
        source,
        { source, stack: err.stack, message: err.message },
        LogLevel.ERROR,
      );
      throw new NotFoundException('File not found');
    }
  }
}
