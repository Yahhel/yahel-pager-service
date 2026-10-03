import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Types } from 'mongoose';
import {
  File,
  FileModel,
  Business,
  BusinessModel,
  User,
  UserModel,
} from '@shared/schemas';
import {
  ApiReq,
  EmailFrom,
  ModelEntity,
  PayoutAccount,
  BUSINESS_PUBLIC_FIELDS,
  BusinessStatus,
} from '@shared/interfaces';
import {
  createTransferRecipient,
  deleteTransferRecipient,
  getPaginated,
  getPagingParams,
  isAccountNameMatch,
  isValidObjectId,
  resolveAccountNumber,
  runNextTick,
  stripEmptyFields,
} from '@shared/utils';
import { getMailTemplate, sendMail } from '@shared/utils/mailtrap.util';
import { AuthService } from '@shared/auth/auth.service';
import { ShareablesService } from '@shared/sharebles/shareables.service';
import { CreateBusinessDto } from './dto/create-business.dto';
import { UpdateBusinessDto } from './dto/update-business.dto';
import {
  LinkPayoutAccountDto,
  ResolveAccountDto,
} from './dto/payout-account.dto';

// stageTracker keys become Mongo paths, so dots or $ would let clients write elsewhere
const STAGE_KEY_REGEX = /^[a-zA-Z0-9_-]{1,50}$/;

@Injectable()
export class BusinessService {
  constructor(
    @Inject(Business.name)
    private readonly businessModel: BusinessModel,
    @Inject(User.name)
    private readonly userModel: UserModel,
    @Inject(File.name)
    private readonly fileModel: FileModel,
    private readonly authService: AuthService,
    private readonly shareablesService: ShareablesService,
  ) {}

  private populateProfilePhoto() {
    return {
      path: 'profilePhoto',
      model: this.fileModel,
      select: 'private category metadata',
    };
  }

  async createBusiness(req: ApiReq, payload: CreateBusinessDto) {
    const user = await this.userModel
      .findById(req.user._id, { emailVerification: 1 })
      .lean();

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!user.emailVerification) {
      throw new BadRequestException(
        'Verify your email before becoming a seller',
      );
    }

    const business = await this.businessModel.createBusiness(
      { ...payload, user },
      this.userModel,
      this.fileModel,
    );

    return this.businessModel
      .findById(business._id)
      .populate(this.populateProfilePhoto());
  }

  async findMyBusiness(req: ApiReq) {
    const business = await this.businessModel
      .findOne(
        { user: new Types.ObjectId(req.user._id) },
        { 'payoutAccount.recipientCode': 0 },
      )
      .populate(this.populateProfilePhoto());

    if (!business) {
      throw new NotFoundException('Business not found');
    }

    return business;
  }

  async updateMyBusiness(req: ApiReq, payload: UpdateBusinessDto) {
    const { code, profilePhoto, socialLinks, stageTracker } = payload;
    const userId = req.user._id.toString();

    const business = await this.businessModel
      .findOne({ user: new Types.ObjectId(userId) }, { _id: 1 })
      .lean();

    if (!business) {
      throw new NotFoundException('Business not found');
    }

    const invalidKeys = Object.keys(stageTracker || {}).filter(
      (key) => !STAGE_KEY_REGEX.test(key),
    );
    if (invalidKeys.length) {
      throw new BadRequestException(
        `Invalid stageTracker keys: ${invalidKeys.join(', ')}`,
      );
    }

    const [codeTaken] = await Promise.all([
      code
        ? this.businessModel.exists({ code, _id: { $ne: business._id } })
        : Promise.resolve(null),
      this.businessModel.validateProfilePhoto(
        this.fileModel,
        profilePhoto,
        userId,
      ),
    ]);

    if (codeTaken) {
      throw new BadRequestException('Business handle already taken');
    }

    const now = new Date();
    const $set: Record<string, any> = stripEmptyFields({
      displayName: payload.displayName?.trim(),
      bio: payload.bio,
      code,
      profilePhoto: profilePhoto && new Types.ObjectId(profilePhoto),
    });

    // Path-level sets so partial updates don't wipe other links or stages
    Object.entries(socialLinks || {}).forEach(([key, value]) => {
      $set[`socialLinks.${key}`] = value;
    });
    Object.entries(stageTracker || {}).forEach(([key, entry]) => {
      $set[`stageTracker.${key}`] = { ...entry, updatedAt: now };
    });

    const updatedBusiness = await this.businessModel
      .findOneAndUpdate({ _id: business._id }, { $set }, { new: true })
      .populate(this.populateProfilePhoto());

    if (profilePhoto) {
      await this.fileModel.validateAndLinkFiles(
        payload,
        ['profilePhoto'],
        ModelEntity.BUSINESS,
        business._id,
        userId,
      );
    }

    return updatedBusiness;
  }

  private async resolveVerifiedAccount(
    userId: string,
    { bankCode, accountNumber }: ResolveAccountDto,
  ) {
    const [banks, user] = await Promise.all([
      this.shareablesService.getBanks(),
      this.userModel.findById(userId, { firstName: 1, lastName: 1 }).lean(),
    ]);

    const bank = banks.find((b) => b.code === bankCode);
    if (!bank) {
      throw new BadRequestException('Unsupported bank');
    }

    const resolved = await resolveAccountNumber({ accountNumber, bankCode });
    const nameMatches = isAccountNameMatch(
      resolved.account_name,
      user?.firstName,
      user?.lastName,
    );

    return { bank, accountName: resolved.account_name, nameMatches };
  }

  async resolvePayoutAccount(req: ApiReq, payload: ResolveAccountDto) {
    const { bank, accountName, nameMatches } =
      await this.resolveVerifiedAccount(req.user._id.toString(), payload);

    return {
      bankCode: bank.code,
      bankName: bank.name,
      accountNumber: payload.accountNumber,
      accountName,
      nameMatches,
    };
  }

  async linkPayoutAccount(req: ApiReq, payload: LinkPayoutAccountDto) {
    const userId = req.user._id.toString();
    const business = await this.businessModel
      .findOne({ user: new Types.ObjectId(userId) }, { payoutAccount: 1 })
      .lean();

    if (!business) {
      throw new NotFoundException('Business not found');
    }

    const previousAccount = business.payoutAccount;
    if (previousAccount?.recipientCode) {
      await this.authService.verifyUserCredentials(
        userId,
        payload.password,
        payload.twoFactorToken,
      );
    }

    // Resolve server-side so the saved name never comes from the client
    const { bank, accountName, nameMatches } =
      await this.resolveVerifiedAccount(userId, payload);
    if (!nameMatches) {
      throw new BadRequestException(
        `The account name "${accountName}" does not match your name. Use a bank account in your own name.`,
      );
    }

    const recipient = await createTransferRecipient({
      name: accountName,
      accountNumber: payload.accountNumber,
      bankCode: bank.code,
      currency: 'NGN',
      metadata: { businessId: business._id.toString(), userId },
    });

    const payoutAccount: PayoutAccount = {
      bankCode: bank.code,
      bankName: bank.name,
      accountName,
      accountNumberLast4: payload.accountNumber.slice(-4),
      currency: 'NGN',
      recipientCode: recipient.recipient_code,
      verifiedAt: new Date(),
    };

    await this.businessModel.updateOne(
      { _id: business._id },
      { $set: { payoutAccount } },
    );

    if (previousAccount?.recipientCode) {
      runNextTick(async () => {
        if (previousAccount.recipientCode !== recipient.recipient_code)
          await deleteTransferRecipient(previousAccount.recipientCode);

        const user = await this.userModel
          .findById(userId, { email: 1, firstName: 1 })
          .lean();
        // Lets the creator notice if someone else changed where their money goes
        sendMail({
          to: user.email,
          from: EmailFrom.HELLO,
          subject: 'Your payout bank account was changed',
          template: getMailTemplate().payoutAccountChanged,
          templateVariables: {
            firstName: user.firstName,
            bankName: bank.name,
            accountNumberLast4: payoutAccount.accountNumberLast4,
          },
        });
      });
    }

    const publicPayoutAccount: Partial<PayoutAccount> = { ...payoutAccount };
    delete publicPayoutAccount.recipientCode;
    return publicPayoutAccount;
  }

  async findPublicBusiness(code: string) {
    const business = await this.businessModel
      .findOne(
        {
          code: code?.toLowerCase(),
          status: BusinessStatus.ACTIVE,
          deleted: false,
        },
        BUSINESS_PUBLIC_FIELDS,
      )
      .populate(this.populateProfilePhoto());

    if (!business) {
      throw new NotFoundException('Business not found');
    }

    return business;
  }

  async findAll(req: ApiReq) {
    const { page, currentLimit, skip, order, dbQuery } = getPagingParams(req);

    const [records, count] = await Promise.all([
      this.businessModel
        .find(dbQuery, {}, { lean: true })
        .populate({
          path: 'user',
          model: this.userModel,
          select: 'firstName lastName email',
        })
        .sort({ createdAt: order })
        .skip(skip)
        .limit(currentLimit),
      this.businessModel.countDocuments(dbQuery),
    ] as any);

    return getPaginated({ page, count, limit: currentLimit }, records);
  }

  async findOne(businessId: string) {
    if (!isValidObjectId(businessId)) {
      throw new BadRequestException('Invalid identification provisioned.');
    }

    const business = await this.businessModel
      .findById(businessId)
      .populate({
        path: 'user',
        model: this.userModel,
        select: 'firstName lastName email',
      })
      .populate(this.populateProfilePhoto());

    if (!business) {
      throw new NotFoundException('Business not found');
    }

    return business;
  }
}
