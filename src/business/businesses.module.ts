import { Module } from '@nestjs/common';
import { BusinessController } from './businesses.controller';
import { BusinessesAdminsController } from './businesses.admins.controller';
import { BusinessService } from './businesses.service';
import { DBModule } from '@shared/schemas';
import { AuthModule } from '@shared/auth/auth.module';
import { ShareablesModule } from '@shared/sharebles';

@Module({
  imports: [DBModule, AuthModule, ShareablesModule],
  controllers: [BusinessController, BusinessesAdminsController],
  providers: [BusinessService],
  exports: [BusinessService],
})
export class BusinessesModule {}
