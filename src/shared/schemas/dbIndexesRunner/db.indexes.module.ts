import { Module, Inject } from '@nestjs/common';
import {
  AuditLog,
  AuditLogModel,
  DataLog,
  DataLogDocument,
  DBModule,
  File,
  FileModel,
  Business,
  BusinessModel,
  Category,
  CategoryModel,
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
    @Inject(File.name)
    private readonly fileModel: FileModel,
    @Inject(Business.name)
    private readonly businessModel: BusinessModel,
    @Inject(Category.name)
    private readonly categoryModel: CategoryModel,
  ) {}

  async runIndexes() {
    await Promise.all([
      this.dataLogModel.syncIndexes(),
      this.userModel.syncIndexes(),
      this.auditLogModel.syncIndexes(),
      this.fileModel.syncIndexes(),
      this.businessModel.syncIndexes(),
      this.categoryModel.syncIndexes(),
    ] as any);
  }
}
