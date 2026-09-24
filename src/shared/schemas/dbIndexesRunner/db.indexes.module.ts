import { Module, Inject } from '@nestjs/common';
import {
  AuditLog,
  AuditLogModel,
  DataLog,
  DataLogDocument,
  DBModule,
  User,
  UserModel,
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
    @Inject(User.name)
    private readonly userModel: UserModel,
    @Inject(AuditLog.name)
    private readonly auditLogModel: AuditLogModel,
  ) {}

  async runIndexes() {
    await Promise.all([
      this.dataLogModel.syncIndexes(),
      this.userModel.syncIndexes(),
      this.auditLogModel.syncIndexes(),
    ] as any);
  }
}
