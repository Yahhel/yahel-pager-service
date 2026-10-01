import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Model, Types } from 'mongoose';
import {
  BadRequestException,
  ConflictException,
  NotAcceptableException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Response } from 'express';
import {
  collectFileIds,
  convertToFileSizeUnits,
  generateChecksumFromBuffer,
  getFileCategory,
  getStorageProvider,
  getStorageUtil,
  isValidObjectId,
  runNextTick,
  validateFileSizes,
} from '@shared/utils';
import {
  ApiReq,
  FileCategory,
  FileMetadata,
  FileMetadataRaw,
  StorageProvider,
} from '@shared/interfaces';
import { UserDocument, UserModel } from './user.schema';

export type FileDocument = HydratedDocument<File>;

export interface FileModel extends Model<FileDocument> {
  uploadFile(
    userModel: UserModel,
    req: ApiReq,
    userId: string,
    isPrivate?: boolean,
  ): Promise<FileDocument[]>;
  validateAndLinkFiles(
    data: any,
    fields: string[],
    entityType: string,
    entityId: string | Types.ObjectId,
    userId?: string,
    silentError?: boolean,
  ): Promise<void>;
  getFileStream(
    fileId: string,
    res: Response,
    rangeHeader?: string,
    hasFileToken?: boolean,
  ): Promise<void>;
  downloadFile(
    fileId: string,
    res: Response,
    options: { userId: string; rangeHeader?: string },
  ): Promise<void>;
  deleteFile({
    userModel,
    fileId,
    userId,
  }: {
    userModel: UserModel;
    fileId: string;
    userId: string;
  }): Promise<{ message: string }>;
  purgeFiles({
    userModel,
    deletedBefore,
    unattachedBefore,
    batchSize,
  }: {
    userModel: UserModel;
    deletedBefore: Date;
    unattachedBefore: Date;
    batchSize?: number;
  }): Promise<{ purgedFiles: number; deletedObjects: number }>;
  getStorageSummary(): Promise<{
    totalFiles: number;
    logicalBytes: number;
    physicalBytes: number;
  }>;
}

// Storage locations never leave the server, so files can only be reached through our access checks
const hideStorageLocation = (_doc: any, ret: any) => {
  delete ret.url;
  delete ret.publicId;
  return ret;
};

@Schema({
  timestamps: true,
  toJSON: { virtuals: true, transform: hideStorageLocation },
  toObject: { virtuals: true },
})
export class File {
  @Prop({ index: true, type: Types.ObjectId, ref: 'User', required: true })
  user: UserDocument | Types.ObjectId;

  @Prop({ required: true })
  url: string;

  @Prop({ index: true, required: true })
  publicId: string;

  @Prop({
    type: String,
    enum: StorageProvider,
    default: StorageProvider.AZURE,
  })
  storageProvider: StorageProvider;

  @Prop({ required: false })
  entityType: string;

  @Prop({ type: Types.ObjectId, required: false, refPath: 'entityType' })
  entityId: Types.ObjectId;

  @Prop({ type: String, enum: FileCategory, required: false })
  category: FileCategory;

  @Prop({ type: [String], default: [] })
  tags: string[];

  @Prop({ type: FileMetadataRaw })
  metadata: FileMetadata;

  @Prop({ default: false })
  acknowledged: boolean;

  @Prop({ default: true })
  private: boolean;

  @Prop({ default: false })
  isDeleted: boolean;

  @Prop({ type: Date, default: null })
  deletedAt?: Date | null;

  declare createdAt: Date;
  declare updatedAt: Date;
}

export const FileSchema = SchemaFactory.createForClass(File);
FileSchema.index({ entityType: 1, entityId: 1 });
FileSchema.index({ isDeleted: 1, deletedAt: 1 });
FileSchema.index({ acknowledged: 1, isDeleted: 1, createdAt: 1 });

FileSchema.virtual('public_url').get(function () {
  return `${process.env.BASE_URL}/api/v1/files/stream/${this._id}`;
});

FileSchema.statics.uploadFile = async function uploadFile(
  userModel: UserModel,
  req: ApiReq,
  userId: string,
  isPrivate = true,
) {
  const files: Express.Multer.File[] = req.files;
  if (!files || !files.length) {
    throw new UnprocessableEntityException('At least a file required');
  }

  // Early validation: Check file sizes before any upload processing
  validateFileSizes(files);

  // Hash before uploading so duplicates never reach storage
  const checksums = await Promise.all(
    files.map((file) => generateChecksumFromBuffer(file.buffer)),
  );

  const existingFiles = await this.find(
    { 'metadata.checksum': { $in: checksums }, isDeleted: false },
    {
      user: 1,
      url: 1,
      publicId: 1,
      storageProvider: 1,
      'metadata.checksum': 1,
    },
    { lean: true },
  );

  const existingByChecksum = new Map<string, any>();
  for (const existingFile of existingFiles) {
    const checksum = existingFile.metadata.checksum;
    if (existingFile.user.toString() !== userId) {
      const fileName = files[checksums.indexOf(checksum)].originalname;
      throw new ConflictException(
        `"${fileName}" already exists on Pager under another account. You can flag or claim it.`,
      );
    }
    existingByChecksum.set(checksum, existingFile);
  }

  // Upload each new file once, even if it appears twice in this request
  const storageProvider = getStorageProvider();
  const storageUtil = getStorageUtil(storageProvider);
  const pendingUploads = new Map<string, Express.Multer.File>();
  files.forEach((file, index) => {
    const checksum = checksums[index];
    if (!existingByChecksum.has(checksum) && !pendingUploads.has(checksum))
      pendingUploads.set(checksum, file);
  });

  const uploadResults = await Promise.all(
    [...pendingUploads].map(async ([checksum, file]) => ({
      checksum,
      file,
      uploaded: await storageUtil.uploadFileStreamAsync(file),
    })),
  );

  const failedUpload = uploadResults.find((result) => !result.uploaded);
  if (failedUpload) {
    // Remove the objects that did upload so a failed request leaves nothing behind
    runNextTick(async () => {
      await Promise.all(
        uploadResults
          .filter((result) => result.uploaded)
          .map((result) =>
            storageUtil.deleteFileAsync(result.uploaded.publicId),
          ),
      );
    });
    throw new NotAcceptableException(
      `Error uploading file ${failedUpload.file.originalname}, try again`,
    );
  }

  uploadResults.forEach(({ checksum, uploaded }) =>
    existingByChecksum.set(checksum, { ...uploaded, storageProvider }),
  );

  const newFiles = await this.insertMany(
    files.map((file, index) => {
      const stored = existingByChecksum.get(checksums[index]);
      return {
        user: new Types.ObjectId(userId),
        url: stored.url,
        publicId: stored.publicId,
        storageProvider: stored.storageProvider,
        private: isPrivate,
        category: getFileCategory(file.mimetype),
        metadata: {
          fileName: file.originalname,
          fileSize: convertToFileSizeUnits(file.size),
          fileSizeBytes: file.size,
          mimeType: file.mimetype,
          fileType: getFileCategory(file.mimetype),
          extension: file.originalname.includes('.')
            ? file.originalname.split('.').pop()
            : '',
          checksum: checksums[index],
        },
      };
    }),
  );

  const totalUploadSize = files.reduce((sum, file) => sum + file.size, 0);
  await userModel.updateOne(
    { _id: new Types.ObjectId(userId) },
    { $inc: { storageUsedBytes: totalUploadSize } },
  );

  return newFiles.map((file) => file.toJSON());
};

FileSchema.statics.validateAndLinkFiles = async function validateAndLinkFiles(
  data: any,
  fields: string[],
  entityType: string,
  entityId: string | Types.ObjectId,
  userId?: string,
  silentError = false,
): Promise<void> {
  const fileIds = collectFileIds(data, fields);

  if (fileIds.length === 0) {
    return;
  }

  const objectIds = fileIds.map((id) => new Types.ObjectId(id));
  // Only the uploader's own files can be attached to their entities
  const filter = {
    _id: { $in: objectIds },
    isDeleted: false,
    ...(userId && { user: new Types.ObjectId(userId) }),
  };

  const existingFiles = await this.find(filter, { _id: 1 }, { lean: true });

  const existingIds = existingFiles.map((file) => file._id.toString());
  const invalidIds = fileIds.filter((id) => !existingIds.includes(id));

  if (invalidIds.length > 0 && !silentError) {
    throw new BadRequestException(`Invalid file IDs: ${invalidIds.join(', ')}`);
  }

  if (existingIds.length > 0) {
    await this.updateMany(filter, {
      $set: {
        entityType,
        entityId:
          typeof entityId === 'string'
            ? new Types.ObjectId(entityId)
            : entityId,
        acknowledged: true,
      },
    });
  }
};

FileSchema.statics.getFileStream = async function getFileStream(
  fileId: string,
  res: Response,
  rangeHeader?: string,
  hasFileToken = false,
) {
  if (!isValidObjectId(fileId)) throw new NotFoundException('File not found');

  // Private files stream only with a validated signed link (?fk=)
  const file = await this.findOne(
    {
      _id: new Types.ObjectId(fileId),
      isDeleted: false,
      ...(!hasFileToken && { private: false }),
    },
    { publicId: 1, storageProvider: 1, private: 1 },
    { lean: true },
  );
  if (!file) throw new NotFoundException('File not found');

  return getStorageUtil(file.storageProvider).getFileStream(
    file.publicId,
    res,
    rangeHeader,
    file.private,
  );
};

FileSchema.statics.downloadFile = async function downloadFile(
  fileId: string,
  res: Response,
  options: { userId: string; rangeHeader?: string },
) {
  const { userId, rangeHeader } = options;
  if (!isValidObjectId(fileId)) throw new NotFoundException('File not found');

  // Private files are owner-only until buyer access comes with orders
  const file = await this.findOne(
    {
      _id: new Types.ObjectId(fileId),
      isDeleted: false,
      $or: [{ private: false }, { user: new Types.ObjectId(userId) }],
    },
    { publicId: 1, storageProvider: 1, 'metadata.fileName': 1 },
    { lean: true },
  );
  if (!file) throw new NotFoundException('File not found');

  return getStorageUtil(file.storageProvider).downloadFile(
    file.publicId,
    res,
    file.metadata?.fileName || 'download',
    rangeHeader,
  );
};

FileSchema.statics.deleteFile = async function ({
  userModel,
  fileId,
  userId,
}: {
  userModel: UserModel;
  fileId: string;
  userId: string;
}) {
  if (!isValidObjectId(fileId)) throw new NotFoundException('File not found');

  const file = await this.findOneAndUpdate(
    {
      _id: new Types.ObjectId(fileId),
      user: new Types.ObjectId(userId),
      isDeleted: false,
    },
    { $set: { isDeleted: true, deletedAt: new Date() } },
    { new: true, lean: true, projection: { 'metadata.fileSizeBytes': 1 } },
  );
  if (!file) throw new NotFoundException('File not found');

  await userModel.updateOne(
    { _id: new Types.ObjectId(userId) },
    { $inc: { storageUsedBytes: -(file.metadata?.fileSizeBytes || 0) } },
  );

  return { message: 'File deleted successfully' };
};

FileSchema.statics.purgeFiles = async function purgeFiles({
  userModel,
  deletedBefore,
  unattachedBefore,
  batchSize = 500,
}: {
  userModel: UserModel;
  deletedBefore: Date;
  unattachedBefore: Date;
  batchSize?: number;
}) {
  const files = await this.find(
    {
      $or: [
        { isDeleted: true, deletedAt: { $lte: deletedBefore } },
        {
          isDeleted: false,
          acknowledged: false,
          createdAt: { $lte: unattachedBefore },
        },
      ],
    },
    {
      user: 1,
      publicId: 1,
      storageProvider: 1,
      isDeleted: 1,
      'metadata.fileSizeBytes': 1,
    },
    { lean: true, limit: batchSize },
  );
  if (!files.length) return { purgedFiles: 0, deletedObjects: 0 };

  const fileIds = files.map((file) => file._id);
  const publicIds = [...new Set(files.map((file) => file.publicId))];

  // A stored object can back several File records (dedup); keep it while any other record uses it
  const stillUsedPublicIds: string[] = await this.distinct('publicId', {
    publicId: { $in: publicIds },
    _id: { $nin: fileIds },
  });

  const objectsToDelete = [
    ...new Map<string, any>(
      files
        .filter((file) => !stillUsedPublicIds.includes(file.publicId))
        .map((file) => [file.publicId, file]),
    ).values(),
  ];

  // Soft-deleted files were already subtracted at delete time; unattached ones were not
  const unattachedBytesByUser = files
    .filter((file) => !file.isDeleted)
    .reduce((result, file) => {
      const key = file.user.toString();
      result[key] = (result[key] || 0) + (file.metadata?.fileSizeBytes || 0);
      return result;
    }, {});

  const userUpdates = Object.entries(unattachedBytesByUser).map(
    ([userId, bytes]: [string, number]) => ({
      updateOne: {
        filter: { _id: new Types.ObjectId(userId) },
        update: { $inc: { storageUsedBytes: -bytes } },
      },
    }),
  );

  await Promise.all([
    this.deleteMany({ _id: { $in: fileIds } }),
    userUpdates.length ? userModel.bulkWrite(userUpdates) : null,
  ] as any);

  const deletedObjects = await Promise.all(
    objectsToDelete.map((file) =>
      getStorageUtil(file.storageProvider).deleteFileAsync(file.publicId),
    ),
  );

  return {
    purgedFiles: files.length,
    deletedObjects: deletedObjects.filter(Boolean).length,
  };
};

FileSchema.statics.getStorageSummary = async function getStorageSummary() {
  const [[logical], [physical]] = await Promise.all([
    this.aggregate([
      { $match: { isDeleted: false } },
      {
        $group: {
          _id: null,
          totalFiles: { $sum: 1 },
          bytes: { $sum: '$metadata.fileSizeBytes' },
        },
      },
    ]),
    // Physical usage counts each stored object once, including soft-deleted files awaiting purge
    this.aggregate([
      {
        $group: {
          _id: '$publicId',
          bytes: { $first: '$metadata.fileSizeBytes' },
        },
      },
      { $group: { _id: null, bytes: { $sum: '$bytes' } } },
    ]),
  ]);

  return {
    totalFiles: logical?.totalFiles || 0,
    logicalBytes: logical?.bytes || 0,
    physicalBytes: physical?.bytes || 0,
  };
};
