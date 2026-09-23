import { Injectable } from '@nestjs/common';
import { ProductSeeder } from '../product.seeder';
@Injectable()
export class ProdProductSeeder extends ProductSeeder {
  async drop(): Promise<unknown> {
    return null;
  }
}
