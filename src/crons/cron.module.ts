import { Module } from '@nestjs/common';
import { DBModule } from '@shared/schemas';
import { CronService } from './cron.service';
import { DataLogsModule } from '@shared/datalogs';
import { ProductsService } from './products/products.service';

@Module({
  imports: [DBModule, DataLogsModule],
  controllers: [],
  providers: [
    CronService,
    ProductsService,
  ],
  exports: [],
})
export class CronModule {}
