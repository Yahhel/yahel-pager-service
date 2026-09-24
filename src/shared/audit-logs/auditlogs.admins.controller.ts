import { Controller, Get, Request, UseGuards } from '@nestjs/common';
import { AuditLogService } from './auditlogs.service';
import { ApiTags, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';

import { ApiReq } from '@shared/interfaces';
import { JwtAdminsGuard } from '@shared/auth/guards';

@ApiTags('admins')
@Controller('admins/audit-logs')
export class AuditLogAdminsController {
  constructor(private readonly auditLogService: AuditLogService) {}

  @ApiBearerAuth()
  @UseGuards(JwtAdminsGuard)
  @ApiQuery({ name: 'limit', required: false, type: String } as any)
  @ApiQuery({ name: 'page', required: false, type: String } as any)
  @ApiQuery({
    name: 'order',
    required: false,
    type: String,
    enum: ['ASC', 'DESC'],
  } as any)
  @ApiQuery({
    name: 'auditLogSearch',
    required: false,
    type: String,
    description: 'fuzzy search on log data',
  } as any)
  @ApiQuery({
    name: 'auditLogByIds',
    required: false,
    type: String,
    description: 'comma separated log ids',
  } as any)
  @ApiQuery({
    name: 'auditLogByRequestActionBy',
    required: false,
    type: String,
    description: 'comma separated ',
  } as any)
  @ApiQuery({
    name: 'auditLogByUserActionBy',
    required: false,
    type: String,
    description: 'comma separated ',
  } as any)
  @ApiQuery({
    name: 'auditLogByModelType',
    required: false,
    type: String,
    description: 'comma separated ',
  } as any)
  @ApiQuery({
    name: 'auditLogByRequestMethod',
    required: false,
    type: String,
    description: 'comma separated ',
  } as any)
  @ApiQuery({
    name: 'auditLogByRequestReferences',
    required: false,
    type: String,
    description: 'comma separated ',
  } as any)
  @ApiQuery({
    name: 'auditLogBySuccess',
    required: false,
    type: Boolean,
    enum: [true, false],
  } as any)
  @ApiQuery({
    name: 'auditLogByServiceNames',
    required: false,
    type: String,
    description: 'service name',
  } as any)
  @ApiQuery({
    name: 'auditLogDateRange',
    required: false,
    type: String,
    description: 'e.g: 2020-11-12,2022-11-15',
  } as any)
  @Get()
  findAll(@Request() req: ApiReq) {
    return this.auditLogService.findAll({ req });
  }
}
