import { Injectable, Inject } from '@nestjs/common';
import { Model } from 'mongoose';
import { Seeder } from './Seeder';
import {
  Product,
  ProductDocument,
} from '../../schemas';

@Injectable()
export class ProductSeeder implements Seeder {
  constructor(
    @Inject(Product.name)
    private readonly productModel: Model<ProductDocument>,
  ) {}

  async seed(): Promise<any> {
    const exists = await this.productModel.find({}, { _id: 1 }).limit(1);

    if (exists.length > 0) return;

    return [];
  }

  async drop(): Promise<unknown> {
    return null;
  }
}
