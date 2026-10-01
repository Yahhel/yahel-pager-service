import { Response } from 'express';

export enum StorageProvider {
  AZURE = 'AZURE',
}

export const StorageProviders = [...new Set(Object.values(StorageProvider))];

// Every storage provider util implements this, so switching provider never touches file code
export interface StorageUtil {
  uploadFileStreamAsync(
    file: Express.Multer.File,
  ): Promise<{ url: string; publicId: string } | null>;
  getFileStream(
    publicId: string,
    res: Response,
    rangeHeader?: string,
    isPrivate?: boolean,
  ): Promise<void>;
  downloadFile(
    publicId: string,
    res: Response,
    fileName: string,
    rangeHeader?: string,
  ): Promise<void>;
  deleteFileAsync(publicId: string): Promise<boolean>;
}
