import { createHash } from 'crypto';
import * as mongoose from 'mongoose';
import { Types } from 'mongoose';
import { ConflictException, NotAcceptableException } from '@nestjs/common';
import { FileSchema } from './file.schema';
import { generateChecksumFromBuffer } from '../utils/helper.util';

const mockStorageUtil = {
  uploadFileStreamAsync: jest.fn(),
  deleteFileAsync: jest.fn().mockResolvedValue(true),
  getFileStream: jest.fn(),
  downloadFile: jest.fn(),
};

jest.mock('../utils/storage.util', () => ({
  getStorageProvider: () => 'AZURE',
  getStorageUtil: () => mockStorageUtil,
}));

const flushNextTick = () => new Promise((resolve) => setImmediate(resolve));
const USER_ID = new Types.ObjectId().toString();
const OTHER_USER_ID = new Types.ObjectId().toString();

const multerFile = (
  name: string,
  content: string,
  mimetype = 'application/pdf',
) =>
  ({
    originalname: name,
    mimetype,
    buffer: Buffer.from(content),
    size: Buffer.byteLength(content),
  }) as Express.Multer.File;

const bindStatics = (model: any) => {
  Object.entries(FileSchema.statics).forEach(([name, fn]) => {
    model[name] = (fn as any).bind(model);
  });
  return model;
};

describe('File statics', () => {
  let fileModel: any;
  let userModel: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockStorageUtil.uploadFileStreamAsync.mockImplementation(async (file) => ({
      url: `https://blob/${file.originalname}`,
      publicId: `${file.originalname}-uuid`,
    }));
    fileModel = bindStatics({
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
      findOneAndUpdate: jest.fn(),
      insertMany: jest.fn(async (docs) =>
        docs.map((doc) => ({ ...doc, toJSON: () => doc })),
      ),
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
      distinct: jest.fn().mockResolvedValue([]),
    });
    userModel = { updateOne: jest.fn(), bulkWrite: jest.fn() };
  });

  it('computes the same SHA-256 checksum as a regular hash', async () => {
    const buffer = Buffer.from('hello pager');
    await expect(generateChecksumFromBuffer(buffer)).resolves.toBe(
      createHash('sha256').update(buffer).digest('hex'),
    );
  });

  it('never exposes the storage url or publicId in JSON', () => {
    const FileTestModel = mongoose.model('FileJsonTest', FileSchema);
    const json: any = new FileTestModel({
      user: new Types.ObjectId(),
      url: 'https://account.blob.core.windows.net/container/secret.pdf',
      publicId: 'secret.pdf',
    }).toJSON();
    expect(json.url).toBeUndefined();
    expect(json.publicId).toBeUndefined();
    expect(json.public_url).toContain('/api/v1/files/stream/');
  });

  it('streams private files only when a signed token was validated', async () => {
    fileModel.findOne.mockResolvedValue({
      publicId: 'p',
      storageProvider: 'AZURE',
      private: true,
    });
    await fileModel.getFileStream(
      new Types.ObjectId().toString(),
      {},
      undefined,
      true,
    );
    expect(fileModel.findOne.mock.calls[0][0].private).toBeUndefined();
    expect(mockStorageUtil.getFileStream).toHaveBeenCalledWith(
      'p',
      {},
      undefined,
      true,
    );
  });

  describe('uploadFile', () => {
    it('uploads new files, records checksums and adds to the storage counter', async () => {
      const files = [
        multerFile('a.pdf', 'aaa'),
        multerFile('b.png', 'bb', 'image/png'),
      ];

      const result = await fileModel.uploadFile(
        userModel,
        { files },
        USER_ID,
        false,
      );

      expect(mockStorageUtil.uploadFileStreamAsync).toHaveBeenCalledTimes(2);
      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        publicId: 'a.pdf-uuid',
        private: false,
        category: 'pdf',
        storageProvider: 'AZURE',
        metadata: { fileSizeBytes: 3, extension: 'pdf' },
      });
      expect(result[1].category).toBe('image');
      expect(userModel.updateOne).toHaveBeenCalledWith(
        { _id: new Types.ObjectId(USER_ID) },
        { $inc: { storageUsedBytes: 5 } },
      );
    });

    it('checks for duplicates with one query for the whole batch', async () => {
      await fileModel.uploadFile(
        userModel,
        { files: [multerFile('a.pdf', 'a'), multerFile('b.pdf', 'b')] },
        USER_ID,
      );
      expect(fileModel.find).toHaveBeenCalledTimes(1);
      expect(
        fileModel.find.mock.calls[0][0]['metadata.checksum'].$in,
      ).toHaveLength(2);
    });

    it("skips the upload when the same user's file already exists", async () => {
      const checksum = await generateChecksumFromBuffer(Buffer.from('same'));
      fileModel.find.mockResolvedValue([
        {
          user: new Types.ObjectId(USER_ID),
          url: 'https://blob/original',
          publicId: 'original-uuid',
          storageProvider: 'AZURE',
          metadata: { checksum },
        },
      ]);

      const [file] = await fileModel.uploadFile(
        userModel,
        { files: [multerFile('copy.pdf', 'same')] },
        USER_ID,
      );

      expect(mockStorageUtil.uploadFileStreamAsync).not.toHaveBeenCalled();
      expect(file).toMatchObject({
        publicId: 'original-uuid',
        metadata: { fileName: 'copy.pdf' },
      });
    });

    it('uploads a file only once when it appears twice in one request', async () => {
      const result = await fileModel.uploadFile(
        userModel,
        { files: [multerFile('x.pdf', 'dup'), multerFile('y.pdf', 'dup')] },
        USER_ID,
      );

      expect(mockStorageUtil.uploadFileStreamAsync).toHaveBeenCalledTimes(1);
      expect(result[0].publicId).toBe(result[1].publicId);
    });

    it('rejects a file that another user already uploaded, without uploading anything', async () => {
      const checksum = await generateChecksumFromBuffer(Buffer.from('theirs'));
      fileModel.find.mockResolvedValue([
        {
          user: new Types.ObjectId(OTHER_USER_ID),
          publicId: 'theirs-uuid',
          metadata: { checksum },
        },
      ]);

      await expect(
        fileModel.uploadFile(
          userModel,
          {
            files: [
              multerFile('new.pdf', 'new'),
              multerFile('stolen.pdf', 'theirs'),
            ],
          },
          USER_ID,
        ),
      ).rejects.toThrow(ConflictException);
      expect(mockStorageUtil.uploadFileStreamAsync).not.toHaveBeenCalled();
      expect(fileModel.insertMany).not.toHaveBeenCalled();
    });

    it('removes already-uploaded objects when another upload in the batch fails', async () => {
      mockStorageUtil.uploadFileStreamAsync.mockImplementation(async (file) =>
        file.originalname === 'bad.pdf'
          ? null
          : { url: 'https://blob/good', publicId: 'good-uuid' },
      );

      await expect(
        fileModel.uploadFile(
          userModel,
          {
            files: [
              multerFile('good.pdf', 'good'),
              multerFile('bad.pdf', 'bad'),
            ],
          },
          USER_ID,
        ),
      ).rejects.toThrow(NotAcceptableException);
      await flushNextTick();

      expect(mockStorageUtil.deleteFileAsync).toHaveBeenCalledWith('good-uuid');
      expect(fileModel.insertMany).not.toHaveBeenCalled();
      expect(userModel.updateOne).not.toHaveBeenCalled();
    });
  });

  describe('access and linking', () => {
    it('only links files owned by the user', async () => {
      const ownFile = new Types.ObjectId();
      fileModel.find.mockResolvedValue([{ _id: ownFile }]);

      await expect(
        fileModel.validateAndLinkFiles(
          {
            cover: ownFile.toString(),
            gallery: [new Types.ObjectId().toString()],
          },
          ['cover', 'gallery'],
          'Product',
          new Types.ObjectId(),
          USER_ID,
        ),
      ).rejects.toThrow('Invalid file IDs');

      expect(fileModel.find.mock.calls[0][0].user).toEqual(
        new Types.ObjectId(USER_ID),
      );
    });

    it('streams only public files', async () => {
      fileModel.findOne.mockResolvedValue(null);
      await expect(
        fileModel.getFileStream(new Types.ObjectId().toString(), {}),
      ).rejects.toThrow('File not found');
      expect(fileModel.findOne.mock.calls[0][0]).toMatchObject({
        private: false,
        isDeleted: false,
      });
    });

    it('downloads private files only for their owner', async () => {
      fileModel.findOne.mockResolvedValue({
        publicId: 'p',
        storageProvider: 'AZURE',
        metadata: { fileName: 'guide.pdf' },
      });
      await fileModel.downloadFile(
        new Types.ObjectId().toString(),
        {},
        {
          userId: USER_ID,
        },
      );
      expect(fileModel.findOne.mock.calls[0][0].$or).toEqual([
        { private: false },
        { user: new Types.ObjectId(USER_ID) },
      ]);
      expect(mockStorageUtil.downloadFile).toHaveBeenCalledWith(
        'p',
        {},
        'guide.pdf',
        undefined,
      );
    });
  });

  describe('deletion', () => {
    it("soft deletes the owner's file and subtracts it from their storage", async () => {
      fileModel.findOneAndUpdate.mockResolvedValue({
        metadata: { fileSizeBytes: 1024 },
      });

      await fileModel.deleteFile({
        userModel,
        fileId: new Types.ObjectId().toString(),
        userId: USER_ID,
      });

      expect(fileModel.findOneAndUpdate.mock.calls[0][1].$set).toMatchObject({
        isDeleted: true,
      });
      expect(userModel.updateOne).toHaveBeenCalledWith(
        { _id: new Types.ObjectId(USER_ID) },
        { $inc: { storageUsedBytes: -1024 } },
      );
    });

    it('purge keeps objects still used by other files and credits back unattached uploads', async () => {
      const deletedFile = {
        _id: new Types.ObjectId(),
        user: new Types.ObjectId(USER_ID),
        publicId: 'shared-uuid',
        storageProvider: 'AZURE',
        isDeleted: true,
        metadata: { fileSizeBytes: 100 },
      };
      const unattachedFile = {
        _id: new Types.ObjectId(),
        user: new Types.ObjectId(USER_ID),
        publicId: 'orphan-uuid',
        storageProvider: 'AZURE',
        isDeleted: false,
        metadata: { fileSizeBytes: 40 },
      };
      fileModel.find.mockResolvedValue([deletedFile, unattachedFile]);
      fileModel.distinct.mockResolvedValue(['shared-uuid']);

      const result = await fileModel.purgeFiles({
        userModel,
        deletedBefore: new Date(),
        unattachedBefore: new Date(),
      });

      expect(result).toEqual({ purgedFiles: 2, deletedObjects: 1 });
      expect(mockStorageUtil.deleteFileAsync).toHaveBeenCalledTimes(1);
      expect(mockStorageUtil.deleteFileAsync).toHaveBeenCalledWith(
        'orphan-uuid',
      );
      expect(fileModel.deleteMany).toHaveBeenCalledWith({
        _id: { $in: [deletedFile._id, unattachedFile._id] },
      });
      expect(userModel.bulkWrite).toHaveBeenCalledWith([
        {
          updateOne: {
            filter: { _id: new Types.ObjectId(USER_ID) },
            update: { $inc: { storageUsedBytes: -40 } },
          },
        },
      ]);
    });
  });
});
