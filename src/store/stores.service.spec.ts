import { BadRequestException, ConflictException } from '@nestjs/common';
import { Types } from 'mongoose';
import { StoreSchema } from '@shared/schemas/store.schema';
import { RoleType } from '@shared/interfaces';
import { StoreService } from './stores.service';

const USER_ID = new Types.ObjectId();

const query = (value: any) => {
  const q: any = {
    populate: jest.fn(() => q),
    lean: jest.fn(() => Promise.resolve(value)),
    then: (resolve, reject) => Promise.resolve(value).then(resolve, reject),
  };
  return q;
};

const bindStatics = (model: any) => {
  Object.entries(StoreSchema.statics).forEach(([name, fn]) => {
    model[name] = (fn as any).bind(model);
  });
  return model;
};

describe('Store', () => {
  let storeModel: any;
  let userModel: any;
  let fileModel: any;
  let service: StoreService;
  const req: any = { user: { _id: USER_ID.toString() } };

  beforeEach(() => {
    storeModel = bindStatics({
      exists: jest.fn().mockResolvedValue(null),
      distinct: jest.fn().mockResolvedValue([]),
      create: jest.fn(async (doc) => ({ _id: new Types.ObjectId(), ...doc })),
      findById: jest.fn(() => query({ displayName: 'Ada Stories' })),
      findOne: jest.fn(() => query({ _id: new Types.ObjectId() })),
      findOneAndUpdate: jest.fn(() => query({ displayName: 'Updated' })),
    });
    userModel = {
      findById: jest.fn(() => query({ _id: USER_ID, emailVerification: true })),
      updateOne: jest.fn(),
    };
    fileModel = {
      exists: jest.fn().mockResolvedValue({ _id: 'photo' }),
      validateAndLinkFiles: jest.fn(),
    };
    service = new StoreService(storeModel, userModel, fileModel);
  });

  describe('generateStoreCode', () => {
    it('slugifies the display name', async () => {
      await expect(storeModel.generateStoreCode('Ada Stories!')).resolves.toBe(
        'ada_stories',
      );
    });

    it('picks the next free suffix with a single lookup', async () => {
      storeModel.distinct.mockResolvedValue(['ada', 'ada-2', 'ada-3']);
      await expect(storeModel.generateStoreCode('Ada')).resolves.toBe('ada-4');
      expect(storeModel.distinct).toHaveBeenCalledTimes(1);
    });

    it('falls back to a default when the name has no usable characters', async () => {
      await expect(storeModel.generateStoreCode('!!!')).resolves.toBe('store');
    });
  });

  describe('createStore (become seller)', () => {
    it('rejects users whose email is not verified', async () => {
      userModel.findById.mockReturnValue(
        query({ _id: USER_ID, emailVerification: false }),
      );
      await expect(
        service.createStore(req, { displayName: 'Ada' }),
      ).rejects.toThrow('Verify your email before becoming a seller');
      expect(storeModel.create).not.toHaveBeenCalled();
    });

    it('creates the store, adds SELLER and links the store to the user', async () => {
      await service.createStore(req, {
        displayName: 'Ada Stories',
        bio: 'I write',
        socialLinks: { instagram: 'https://instagram.com/ada' },
      });

      expect(storeModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          user: USER_ID,
          displayName: 'Ada Stories',
          code: 'ada_stories',
          bio: 'I write',
        }),
      );
      expect(userModel.updateOne).toHaveBeenCalledWith(
        { _id: USER_ID },
        {
          $addToSet: { roles: RoleType.SELLER },
          $set: { store: expect.any(Types.ObjectId) },
        },
      );
    });

    it('allows only one store per seller', async () => {
      storeModel.exists.mockResolvedValue({ _id: 'existing' });
      await expect(
        service.createStore(req, { displayName: 'Ada' }),
      ).rejects.toThrow(ConflictException);
      expect(userModel.updateOne).not.toHaveBeenCalled();
    });

    it("requires the profile photo to be the user's own public file", async () => {
      fileModel.exists.mockResolvedValue(null);
      const photo = new Types.ObjectId().toString();
      await expect(
        service.createStore(req, { displayName: 'Ada', profilePhoto: photo }),
      ).rejects.toThrow('Profile photo must be one of your files');
      expect(fileModel.exists).toHaveBeenCalledWith(
        expect.objectContaining({ user: USER_ID, private: false }),
      );
      expect(storeModel.create).not.toHaveBeenCalled();
    });
  });

  describe('updateMyStore', () => {
    it('merges stageTracker entries and social links by path', async () => {
      await service.updateMyStore(req, {
        socialLinks: { x: 'https://x.com/ada' },
        stageTracker: {
          profile: { step: 'profile', completed: true },
          bank: { step: 'bank', completed: false },
        },
      });

      const $set = storeModel.findOneAndUpdate.mock.calls[0][1].$set;
      expect($set['socialLinks.x']).toBe('https://x.com/ada');
      expect($set['stageTracker.profile']).toMatchObject({
        step: 'profile',
        completed: true,
        updatedAt: expect.any(Date),
      });
      expect($set['stageTracker.bank'].completed).toBe(false);
      expect($set.socialLinks).toBeUndefined();
    });

    it('rejects stageTracker keys that could target other fields', async () => {
      await expect(
        service.updateMyStore(req, {
          stageTracker: { 'status.$': { step: 'x' } } as any,
        }),
      ).rejects.toThrow(BadRequestException);
      expect(storeModel.findOneAndUpdate).not.toHaveBeenCalled();
    });

    it('rejects a handle that belongs to another store', async () => {
      storeModel.exists.mockResolvedValue({ _id: 'other' });
      await expect(
        service.updateMyStore(req, { code: 'taken' }),
      ).rejects.toThrow('Store handle already taken');
    });
  });
});
