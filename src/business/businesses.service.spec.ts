import { BadRequestException, ConflictException } from '@nestjs/common';
import { Types } from 'mongoose';
import { BusinessSchema } from '@shared/schemas/business.schema';
import { RoleType } from '@shared/interfaces';
import { BusinessService } from './businesses.service';
import * as paystack from '@shared/utils/paystack.util';

jest.mock('@shared/utils/paystack.util', () => ({
  resolveAccountNumber: jest.fn(),
  createTransferRecipient: jest.fn(),
  deleteTransferRecipient: jest.fn(),
  listBanks: jest.fn(),
}));
jest.mock('@shared/utils/mailtrap.util', () => ({
  sendMail: jest.fn(),
  getMailTemplate: () => ({}),
}));

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
  Object.entries(BusinessSchema.statics).forEach(([name, fn]) => {
    model[name] = (fn as any).bind(model);
  });
  return model;
};

describe('Business', () => {
  let businessModel: any;
  let userModel: any;
  let fileModel: any;
  let service: BusinessService;
  let authService: any;
  let shareablesService: any;
  const req: any = { user: { _id: USER_ID.toString() } };

  beforeEach(() => {
    jest.clearAllMocks();
    businessModel = bindStatics({
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
    authService = { verifyUserCredentials: jest.fn() };
    shareablesService = {
      getBanks: jest
        .fn()
        .mockResolvedValue([
          { name: 'Access Bank', code: '044', slug: 'access-bank' },
        ]),
    };
    service = new BusinessService(
      businessModel,
      userModel,
      fileModel,
      authService,
      shareablesService,
    );
  });

  describe('generateBusinessCode', () => {
    it('slugifies the display name', async () => {
      await expect(
        businessModel.generateBusinessCode('Ada Stories!'),
      ).resolves.toBe('ada_stories');
    });

    it('picks the next free suffix with a single lookup', async () => {
      businessModel.distinct.mockResolvedValue(['ada', 'ada-2', 'ada-3']);
      await expect(businessModel.generateBusinessCode('Ada')).resolves.toBe(
        'ada-4',
      );
      expect(businessModel.distinct).toHaveBeenCalledTimes(1);
    });

    it('falls back to a default when the name has no usable characters', async () => {
      await expect(businessModel.generateBusinessCode('!!!')).resolves.toBe(
        'business',
      );
    });
  });

  describe('createBusiness (become seller)', () => {
    it('rejects users whose email is not verified', async () => {
      userModel.findById.mockReturnValue(
        query({ _id: USER_ID, emailVerification: false }),
      );
      await expect(
        service.createBusiness(req, { displayName: 'Ada' }),
      ).rejects.toThrow('Verify your email before becoming a seller');
      expect(businessModel.create).not.toHaveBeenCalled();
    });

    it('creates the business, adds SELLER and links the business to the user', async () => {
      await service.createBusiness(req, {
        displayName: 'Ada Stories',
        bio: 'I write',
        socialLinks: { instagram: 'https://instagram.com/ada' },
      });

      expect(businessModel.create).toHaveBeenCalledWith(
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
          $set: { business: expect.any(Types.ObjectId) },
        },
      );
    });

    it('allows only one business per seller', async () => {
      businessModel.exists.mockResolvedValue({ _id: 'existing' });
      await expect(
        service.createBusiness(req, { displayName: 'Ada' }),
      ).rejects.toThrow(ConflictException);
      expect(userModel.updateOne).not.toHaveBeenCalled();
    });

    it("requires the profile photo to be the user's own public file", async () => {
      fileModel.exists.mockResolvedValue(null);
      const photo = new Types.ObjectId().toString();
      await expect(
        service.createBusiness(req, {
          displayName: 'Ada',
          profilePhoto: photo,
        }),
      ).rejects.toThrow('Profile photo must be one of your files');
      expect(fileModel.exists).toHaveBeenCalledWith(
        expect.objectContaining({ user: USER_ID, private: false }),
      );
      expect(businessModel.create).not.toHaveBeenCalled();
    });
  });

  describe('updateMyBusiness', () => {
    it('merges stageTracker entries and social links by path', async () => {
      await service.updateMyBusiness(req, {
        socialLinks: { x: 'https://x.com/ada' },
        stageTracker: {
          profile: { step: 'profile', completed: true },
          bank: { step: 'bank', completed: false },
        },
      });

      const $set = businessModel.findOneAndUpdate.mock.calls[0][1].$set;
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
        service.updateMyBusiness(req, {
          stageTracker: { 'status.$': { step: 'x' } } as any,
        }),
      ).rejects.toThrow(BadRequestException);
      expect(businessModel.findOneAndUpdate).not.toHaveBeenCalled();
    });

    it('rejects a handle that belongs to another business', async () => {
      businessModel.exists.mockResolvedValue({ _id: 'other' });
      await expect(
        service.updateMyBusiness(req, { code: 'taken' }),
      ).rejects.toThrow('Business handle already taken');
    });
  });

  describe('payout account (onboarding step 2)', () => {
    const businessId = new Types.ObjectId();
    const payload = { bankCode: '044', accountNumber: '0123456789' };

    beforeEach(() => {
      userModel.findById.mockReturnValue(
        query({
          _id: USER_ID,
          firstName: 'Ada',
          lastName: 'Lovelace',
          email: 'ada@test.com',
        }),
      );
      businessModel.findOne.mockReturnValue(
        query({ _id: businessId, payoutAccount: null }),
      );
      businessModel.updateOne = jest.fn();
      (paystack.resolveAccountNumber as jest.Mock).mockResolvedValue({
        account_name: 'LOVELACE ADA MARY',
        account_number: '0123456789',
      });
      (paystack.createTransferRecipient as jest.Mock).mockResolvedValue({
        recipient_code: 'RCP_new',
      });
    });

    it('resolve reports whether the bank name matches the creator', async () => {
      await expect(service.resolvePayoutAccount(req, payload)).resolves.toEqual(
        {
          bankCode: '044',
          bankName: 'Access Bank',
          accountNumber: '0123456789',
          accountName: 'LOVELACE ADA MARY',
          nameMatches: true,
        },
      );
    });

    it('rejects unsupported banks before calling Paystack', async () => {
      await expect(
        service.resolvePayoutAccount(req, { ...payload, bankCode: '999' }),
      ).rejects.toThrow('Unsupported bank');
      expect(paystack.resolveAccountNumber).not.toHaveBeenCalled();
    });

    it('links a matching account: businesses last 4 digits and recipient, hides the recipient code', async () => {
      const result = await service.linkPayoutAccount(req, payload);

      expect(authService.verifyUserCredentials).not.toHaveBeenCalled();
      expect(paystack.createTransferRecipient).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'LOVELACE ADA MARY',
          accountNumber: '0123456789',
          bankCode: '044',
        }),
      );
      expect(
        businessModel.updateOne.mock.calls[0][1].$set.payoutAccount,
      ).toMatchObject({
        accountNumberLast4: '6789',
        recipientCode: 'RCP_new',
        bankName: 'Access Bank',
      });
      expect(result).toMatchObject({
        accountNumberLast4: '6789',
        accountName: 'LOVELACE ADA MARY',
      });
      expect(result).not.toHaveProperty('recipientCode');
      expect(JSON.stringify(result)).not.toContain('0123456789');
    });

    it("refuses accounts that aren't in the creator's name", async () => {
      (paystack.resolveAccountNumber as jest.Mock).mockResolvedValue({
        account_name: 'JOHN DOE',
      });
      await expect(service.linkPayoutAccount(req, payload)).rejects.toThrow(
        'does not match your name',
      );
      expect(paystack.createTransferRecipient).not.toHaveBeenCalled();
      expect(businessModel.updateOne).not.toHaveBeenCalled();
    });

    it('changing an existing account requires the password (and 2FA) first', async () => {
      businessModel.findOne.mockReturnValue(
        query({ _id: businessId, payoutAccount: { recipientCode: 'RCP_old' } }),
      );
      authService.verifyUserCredentials.mockRejectedValue(
        new BadRequestException('Invalid password'),
      );

      await expect(
        service.linkPayoutAccount(req, { ...payload, password: 'wrong' }),
      ).rejects.toThrow('Invalid password');
      expect(authService.verifyUserCredentials).toHaveBeenCalledWith(
        USER_ID.toString(),
        'wrong',
        undefined,
      );
      expect(paystack.resolveAccountNumber).not.toHaveBeenCalled();
    });

    it('replacing an account deactivates the old Paystack recipient', async () => {
      businessModel.findOne.mockReturnValue(
        query({ _id: businessId, payoutAccount: { recipientCode: 'RCP_old' } }),
      );
      await service.linkPayoutAccount(req, {
        ...payload,
        password: 'Secret#123',
      });
      await new Promise((resolve) => setImmediate(resolve));
      await new Promise((resolve) => setImmediate(resolve));
      expect(paystack.deleteTransferRecipient).toHaveBeenCalledWith('RCP_old');
    });
  });
});
