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
  Store,
  StoreModel,
  User,
  UserModel,
} from '@shared/schemas';
import {
  ApiReq,
  ModelEntity,
  STORE_PUBLIC_FIELDS,
  StoreStatus,
} from '@shared/interfaces';
import {
  getPaginated,
  getPagingParams,
  isValidObjectId,
  stripEmptyFields,
} from '@shared/utils';
import { CreateStoreDto } from './dto/create-store.dto';
import { UpdateStoreDto } from './dto/update-store.dto';

// stageTracker keys become Mongo paths, so dots or $ would let clients write elsewhere
const STAGE_KEY_REGEX = /^[a-zA-Z0-9_-]{1,50}$/;

@Injectable()
export class StoreService {
  constructor(
    @Inject(Store.name)
    private readonly storeModel: StoreModel,
    @Inject(User.name)
    private readonly userModel: UserModel,
    @Inject(File.name)
    private readonly fileModel: FileModel,
  ) {}

  private populateProfilePhoto() {
    return {
      path: 'profilePhoto',
      model: this.fileModel,
      select: 'private category metadata',
    };
  }

  async createStore(req: ApiReq, payload: CreateStoreDto) {
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

    const store = await this.storeModel.createStore(
      { ...payload, user },
      this.userModel,
      this.fileModel,
    );

    return this.storeModel
      .findById(store._id)
      .populate(this.populateProfilePhoto());
  }

  async findMyStore(req: ApiReq) {
    const store = await this.storeModel
      .findOne({ user: new Types.ObjectId(req.user._id) })
      .populate(this.populateProfilePhoto());

    if (!store) {
      throw new NotFoundException('Store not found');
    }

    return store;
  }

  async updateMyStore(req: ApiReq, payload: UpdateStoreDto) {
    const { code, profilePhoto, socialLinks, stageTracker } = payload;
    const userId = req.user._id.toString();

    const store = await this.storeModel
      .findOne({ user: new Types.ObjectId(userId) }, { _id: 1 })
      .lean();

    if (!store) {
      throw new NotFoundException('Store not found');
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
        ? this.storeModel.exists({ code, _id: { $ne: store._id } })
        : Promise.resolve(null),
      this.storeModel.validateProfilePhoto(
        this.fileModel,
        profilePhoto,
        userId,
      ),
    ]);

    if (codeTaken) {
      throw new BadRequestException('Store handle already taken');
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

    const updatedStore = await this.storeModel
      .findOneAndUpdate({ _id: store._id }, { $set }, { new: true })
      .populate(this.populateProfilePhoto());

    if (profilePhoto) {
      await this.fileModel.validateAndLinkFiles(
        payload,
        ['profilePhoto'],
        ModelEntity.STORE,
        store._id,
        userId,
      );
    }

    return updatedStore;
  }

  async findPublicStore(code: string) {
    const store = await this.storeModel
      .findOne(
        {
          code: code?.toLowerCase(),
          status: StoreStatus.ACTIVE,
          deleted: false,
        },
        STORE_PUBLIC_FIELDS,
      )
      .populate(this.populateProfilePhoto());

    if (!store) {
      throw new NotFoundException('Store not found');
    }

    return store;
  }

  async findAll(req: ApiReq) {
    const { page, currentLimit, skip, order, dbQuery } = getPagingParams(req);

    const [records, count] = await Promise.all([
      this.storeModel
        .find(dbQuery, {}, { lean: true })
        .populate({
          path: 'user',
          model: this.userModel,
          select: 'firstName lastName email',
        })
        .sort({ createdAt: order })
        .skip(skip)
        .limit(currentLimit),
      this.storeModel.countDocuments(dbQuery),
    ] as any);

    return getPaginated({ page, count, limit: currentLimit }, records);
  }

  async findOne(storeId: string) {
    if (!isValidObjectId(storeId)) {
      throw new BadRequestException('Invalid identification provisioned.');
    }

    const store = await this.storeModel
      .findById(storeId)
      .populate({
        path: 'user',
        model: this.userModel,
        select: 'firstName lastName email',
      })
      .populate(this.populateProfilePhoto());

    if (!store) {
      throw new NotFoundException('Store not found');
    }

    return store;
  }
}
