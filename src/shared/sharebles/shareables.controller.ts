import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuditLogMeta } from '@shared/decorators';
import { AuditSeverity, AuditType } from '@shared/interfaces';
import { ShareablesService } from './shareables.service';

@ApiTags('shareables')
@Controller('v1/shareables')
export class ShareablesController {
  constructor(private readonly shareablesService: ShareablesService) {}

  @AuditLogMeta({
    action: AuditType.USER,
    description: 'User retrieved supported banks',
    severity: AuditSeverity.INFO,
  })
  @Get('banks/public')
  async getBanks() {
    return this.shareablesService.getBanks();
  }
}
