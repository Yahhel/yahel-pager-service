import { Module } from '@nestjs/common';
import { AuditLogService } from './auditlogs.service';
import { AuditLogAdminsController } from './auditlogs.admins.controller';
import { DBModule } from '@shared/schemas';

@Module({
  imports: [DBModule],
  controllers: [AuditLogAdminsController],
  providers: [AuditLogService],
  exports: [AuditLogService],
})
export class AuditLogModule {}
