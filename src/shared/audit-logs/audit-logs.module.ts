import { Module } from '@nestjs/common';
import { DBModule } from '../schemas';
import { AuditLogsAdminsController } from './audit-logs.admins.controller';
import { AuditLogsService } from './audit-logs.service';

@Module({
  imports: [DBModule],
  controllers: [AuditLogsAdminsController],
  providers: [AuditLogsService],
})
export class AuditLogsModule {}
