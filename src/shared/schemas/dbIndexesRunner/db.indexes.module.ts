import { Module, Inject } from '@nestjs/common';
import {
  // Product,
  // ProductDocument,
  DataLog,
  DataLogDocument,
  DBModule,
} from '../index';
import { Model } from 'mongoose';

@Module({
  imports: [DBModule],
  controllers: [],
  providers: [],
  exports: [],
})
export class DbIndexesModule {
  constructor(
    @Inject(DataLog.name)
    private readonly dataLogModel: Model<DataLogDocument>,
  ) {}

  async runIndexes() {
    await Promise.all([
      this.dataLogModel.syncIndexes(),
    ] as any);
  }
}
