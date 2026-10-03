import { Injectable } from '@nestjs/common';
import { PaystackBank } from '../interfaces';
import { listBanks, redisGet, redisSet } from '../utils';

const BANKS_CACHE_KEY = 'shareables:banks:NGN';
const BANKS_CACHE_SECONDS = 24 * 3600;

@Injectable()
export class ShareablesService {
  constructor() {}

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
}
