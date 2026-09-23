import { Module } from '@nestjs/common';
import { ShareablesService } from './shareables.service';
import { ShareablesController } from './shareables.controller';
import { DBModule } from '@shared/schemas';

@Module({
  imports: [DBModule],
  controllers: [ShareablesController],
  providers: [ShareablesService],
  exports: [ShareablesService],
})
export class ShareablesModule {}
