import { Controller, Get, Query } from '@nestjs/common';
import { ApiQuery, ApiTags } from '@nestjs/swagger';
import { AuditLogMeta } from '@shared/decorators';
import {
  AuditSeverity,
  AuditType,
  CategoryEntityModules,
  EntityModule,
} from '@shared/interfaces';
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

  @AuditLogMeta({
    action: AuditType.USER,
    description: 'User retrieved categories',
    severity: AuditSeverity.INFO,
  })
  @ApiQuery({
    name: 'module',
    required: false,
    type: String,
    enum: CategoryEntityModules,
  } as any)
  @Get('categories/public')
  async getCategories(@Query('module') module?: EntityModule) {
    return this.shareablesService.getCategories(
      CategoryEntityModules.includes(module) ? module : undefined,
    );
  }
}
