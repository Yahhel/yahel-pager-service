import { Inject, Injectable } from '@nestjs/common';
import {
  CATEGORY_PUBLIC_FIELDS,
  EntityModule,
  PaystackBank,
} from '../interfaces';
import { Category, CategoryModel } from '../schemas';
import { listBanks, redisGet, redisSet } from '../utils';

const BANKS_CACHE_KEY = 'shareables:banks:NGN';
const BANKS_CACHE_SECONDS = 24 * 3600;

@Injectable()
export class ShareablesService {
  constructor(
    @Inject(Category.name)
    private readonly categoryModel: CategoryModel,
  ) {}

  async getBanks(): Promise<Pick<PaystackBank, 'name' | 'code' | 'slug'>[]> {
    const cached = await redisGet(BANKS_CACHE_KEY);
    if (cached) return cached;

    // Bank lists rarely change, so cache them instead of calling Paystack per request
    const banks = (await listBanks())
      .filter((bank) => bank.active)
      .map(({ name, code, slug }) => ({ name, code, slug }));
    await redisSet(BANKS_CACHE_KEY, banks, { EX: BANKS_CACHE_SECONDS });
    return banks;
  }

  async getCategories(module: EntityModule = EntityModule.PRODUCTS) {
    return this.categoryModel
      .find(
        { module, isActive: true, isDeleted: false },
        CATEGORY_PUBLIC_FIELDS,
      )
      .sort({ name: 1 })
      .lean();
  }
}
