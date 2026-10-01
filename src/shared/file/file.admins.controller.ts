import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAdminsGuard } from '@shared/auth/guards';
import { AuditLogMeta } from '@shared/decorators';
import { AuditSeverity, AuditType } from '@shared/interfaces';
import { FileService } from './file.service';

@ApiTags('admins')
@ApiBearerAuth()
@UseGuards(JwtAdminsGuard)
@Controller('v1/admins/files')
export class FileAdminsController {
  constructor(private readonly fileService: FileService) {}

  @AuditLogMeta({
    action: AuditType.ADMIN,
    description: 'Admin retrieved platform storage summary',
    severity: AuditSeverity.INFO,
  })
  @Get('storage')
  async getStorageSummary() {
    return this.fileService.getStorageSummary();
  }
}
