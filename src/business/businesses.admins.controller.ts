import { Controller, Get, Param, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAdminsGuard } from '@shared/auth/guards';
import { AuditLogMeta } from '@shared/decorators';
import {
  ApiReq,
  AuditSeverity,
  AuditType,
  BusinessStatuses,
} from '@shared/interfaces';
import { BusinessService } from './businesses.service';

@ApiTags('admins')
@ApiBearerAuth()
@UseGuards(JwtAdminsGuard)
@Controller('v1/admins/businesses')
export class BusinessesAdminsController {
  constructor(private readonly businessService: BusinessService) {}

  @AuditLogMeta({
    action: AuditType.ADMIN,
    description: 'Admin retrieved businesses',
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
    name: 'businessSearch',
    required: false,
    type: String,
    description: 'fuzzy search on display name or handle',
  } as any)
  @ApiQuery({
    name: 'businessByStatuses',
    required: false,
    type: String,
    description: `comma separated: ${BusinessStatuses}`,
  } as any)
  @ApiQuery({
    name: 'businessDateRange',
    required: false,
    type: String,
    description: 'e.g: 2020-11-12,2022-11-15',
  } as any)
  @Get()
  findAll(@Request() req: ApiReq) {
    return this.businessService.findAll(req);
  }

  @AuditLogMeta({
    action: AuditType.ADMIN,
    description: 'Admin retrieved a business',
    severity: AuditSeverity.INFO,
  })
  @Get(':businessId')
  findOne(@Param('businessId') businessId: string) {
    return this.businessService.findOne(businessId);
  }
}
