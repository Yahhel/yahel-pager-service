import { Module } from '@nestjs/common';
import { DBModule } from '@shared/schemas';
import { CronService } from './cron.service';
import { DataLogsModule } from '@shared/datalogs';
import { ProductsService } from './products/products.service';
import { FilesService } from './files/files.service';

@Module({
  imports: [DBModule, DataLogsModule],
  controllers: [],
  providers: [CronService, ProductsService, FilesService],
  exports: [],
})
export class CronModule {}
