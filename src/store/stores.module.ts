import { Module } from '@nestjs/common';
import { StoreController } from './stores.controller';
import { StoresAdminsController } from './stores.admins.controller';
import { StoreService } from './stores.service';
import { DBModule } from '@shared/schemas';

@Module({
  imports: [DBModule],
  controllers: [StoreController, StoresAdminsController],
  providers: [StoreService],
  exports: [StoreService],
})
export class StoresModule {}
