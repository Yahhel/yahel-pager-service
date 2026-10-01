import { Module } from '@nestjs/common';
import { FileService } from './file.service';
import { FileController } from './file.controller';
import { FileAdminsController } from './file.admins.controller';
import { DBModule } from '@shared/schemas';

@Module({
  imports: [DBModule],
  controllers: [FileController, FileAdminsController],
  providers: [FileService],
  exports: [FileService],
})
export class FileModule {}
