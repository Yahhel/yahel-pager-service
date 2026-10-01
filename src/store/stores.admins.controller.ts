import { Controller, Get, Param, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAdminsGuard } from '@shared/auth/guards';
import { AuditLogMeta } from '@shared/decorators';
import {
  ApiReq,
  AuditSeverity,
  AuditType,
  StoreStatuses,
} from '@shared/interfaces';
import { StoreService } from './stores.service';

@ApiTags('admins')
@ApiBearerAuth()
@UseGuards(JwtAdminsGuard)
@Controller('v1/admins/stores')
export class StoresAdminsController {
  constructor(private readonly storeService: StoreService) {}

  @AuditLogMeta({
    action: AuditType.ADMIN,
    description: 'Admin retrieved stores',
    severity: AuditSeverity.INFO,
  })
  @ApiQuery({ name: 'limit', required: false, type: String } as any)
  @ApiQuery({ name: 'page', required: false, type: String } as any)
  @ApiQuery({
    name: 'order',
    required: false,
    type: String,
    enum: ['ASC', 'DESC'],
  } as any)
  @ApiQuery({
    name: 'storeSearch',
    required: false,
    type: String,
    description: 'fuzzy search on display name or handle',
  } as any)
  @ApiQuery({
    name: 'storeByStatuses',
    required: false,
    type: String,
    description: `comma separated: ${StoreStatuses}`,
  } as any)
  @ApiQuery({
    name: 'storeDateRange',
    required: false,
    type: String,
    description: 'e.g: 2020-11-12,2022-11-15',
  } as any)
  @Get()
  findAll(@Request() req: ApiReq) {
    return this.storeService.findAll(req);
  }

  @AuditLogMeta({
    action: AuditType.ADMIN,
    description: 'Admin retrieved a store',
    severity: AuditSeverity.INFO,
  })
  @Get(':storeId')
  findOne(@Param('storeId') storeId: string) {
    return this.storeService.findOne(storeId);
  }
}
