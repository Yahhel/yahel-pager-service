import { Module } from '@nestjs/common';
import { DBModule } from '../schemas';
import { NestFactory } from '@nestjs/core';
import { ProdProductSeeder } from './seeds/production/prod.product.seeder';

@Module({
  imports: [DBModule],
  controllers: [],
  providers: [
    ProdProductSeeder
  ],
  exports: [],
})
export class SeederModule {
  constructor(
    private readonly productSeeder: ProdProductSeeder,
  ) {}

  async runSeeders() {
    const isRefresh = process.argv.toString().includes('refresh');
    const isDelete = process.argv.toString().includes('delete');

    // Drop and Seed for seed Function refresh
    (isRefresh || isDelete) &&
      (await Promise.all([
        // register all drop here
        this.productSeeder.drop(),
      ] as any));

    // Register each seed function here
    if (isDelete) return null;
    await this.productSeeder.seed();
  }
}

async function runAllSeeders() {
  NestFactory.create(SeederModule)
    .then(async (app) => {
      const seederModule = app.get<SeederModule>(SeederModule);
      await seederModule.runSeeders();
      await app.close();
      console.log('seederModule Successful');
      process.exit(0);
    })
    .catch(async (e) => {
      console.log('seederModule Failed', e.stack);
      process.exit(0);
    });
}

runAllSeeders();
