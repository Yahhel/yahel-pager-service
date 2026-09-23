import { DBModule } from '../schemas';
import { DataLogsModule } from '../datalogs';
import { Module } from '@nestjs/common';

@Module({
  imports: [DBModule, DataLogsModule],
  exports: [DataLogsModule, DBModule],
})
export class TestModule {}
