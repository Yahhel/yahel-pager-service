import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Response } from 'express';
import { Types } from 'mongoose';
import { File, FileModel } from '@shared/schemas/file.schema';
import { User, UserModel } from '@shared/schemas';
import {
  ApiReq,
  FileAccessLink,
  FileCategory,
  FileMetadata,
} from '@shared/interfaces';
import { convertToFileSizeUnits, isValidObjectId } from '@shared/utils';
import {
  destroyFileToken,
  injectFilePublicUrl,
  validateAndConsumeFileToken,
} from '@shared/utils/token.util';
import { configs } from '@shared/configs';

const MEDIA_CATEGORIES = [FileCategory.Video, FileCategory.Audio];

@Injectable()
export class FileService {
  constructor(
    @Inject(File.name)
    private readonly fileModel: FileModel,
    @Inject(User.name)
    private readonly userModel: UserModel,
  ) {}

  async uploadFile(req: ApiReq, isPrivate = true) {
    return this.fileModel.uploadFile(
      this.userModel,
      req,
      req.user._id,
      isPrivate,
    );
  }

  async getFileStream(
    fileId: string,
    res: Response,
    rangeHeader?: string,
    fk?: string,
  ) {
    if (fk) {
      const { ott, fingerprint, exp } = await validateAndConsumeFileToken(
        decodeURIComponent(fk),
        fileId,
      );
      if (ott) {
        res.on('finish', () => {
          destroyFileToken(fingerprint, exp);
        });
      }
    }
    return this.fileModel.getFileStream(fileId, res, rangeHeader, !!fk);
  }

  async getFileAccessLink(
    req: ApiReq,
    fileId: string,
  ): Promise<FileAccessLink> {
    if (!isValidObjectId(fileId)) throw new NotFoundException('File not found');

    // Owner-only for now; buyers with a paid order get links once orders exist
    const file = await this.fileModel
      .findOne(
        {
          _id: new Types.ObjectId(fileId),
          user: new Types.ObjectId(req.user._id),
          isDeleted: false,
        },
        { private: 1, category: 1, metadata: 1 },
      )
      .lean<{
        _id: Types.ObjectId;
        private: boolean;
        category: FileCategory;
        metadata: FileMetadata;
      }>();
    if (!file) throw new NotFoundException('File not found');

    const { fileLinkTtlSeconds, mediaLinkTtlSeconds } = configs().storage;
    const isMedia = MEDIA_CATEGORIES.includes(file.category);
    const ttlSeconds = isMedia ? mediaLinkTtlSeconds : fileLinkTtlSeconds;

    return injectFilePublicUrl(
      { ...file, expiresInSeconds: ttlSeconds, singleUse: !isMedia },
      req,
      { ttlSeconds, ott: !isMedia },
    );
  }

  async downloadFile(
    req: ApiReq,
    fileId: string,
    res: Response,
    rangeHeader?: string,
  ) {
    return this.fileModel.downloadFile(fileId, res, {
      userId: req.user._id,
      rangeHeader,
    });
  }

  async deleteFile(req: ApiReq, fileId: string) {
    return this.fileModel.deleteFile({
      userModel: this.userModel,
      fileId,
      userId: req.user._id,
    });
  }

  async getStorageSummary() {
    const summary = await this.fileModel.getStorageSummary();
    return {
      ...summary,
      logicalSize: convertToFileSizeUnits(summary.logicalBytes),
      physicalSize: convertToFileSizeUnits(summary.physicalBytes),
    };
  }
}
