import { Controller, Get, Param, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard, RolesGuard } from '../auth/guards';
import { Roles } from '../decorators';
import { ApiReq, AuditSeverities, AuditTypes, UserRole } from '../interfaces';
import { ParseObjectIdPipe } from '../validators';
import { AuditLogsService } from './audit-logs.service';

@ApiTags('admins-audit-logs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('v1/admins/audit-logs')
export class AuditLogsAdminsController {
  constructor(private readonly auditLogsService: AuditLogsService) {}

  @ApiQuery({ name: 'limit', required: false, type: String } as any)
  @ApiQuery({ name: 'page', required: false, type: String } as any)
  @ApiQuery({ name: 'order', required: false, enum: ['ASC', 'DESC'] } as any)
  @ApiQuery({
    name: 'auditSearch',
    required: false,
    type: String,
    description: 'Matches URL or description',
  } as any)
  @ApiQuery({
    name: 'auditActionBy',
    required: false,
    type: String,
    description: 'Comma-separated user ids',
  } as any)
  @ApiQuery({
    name: 'auditTypes',
    required: false,
    type: String,
    description: `Comma-separated. ${AuditTypes}`,
  } as any)
  @ApiQuery({
    name: 'auditSeverities',
    required: false,
    type: String,
    description: `Comma-separated. ${AuditSeverities}`,
  } as any)
  @ApiQuery({
    name: 'auditModelTypes',
    required: false,
    type: String,
    description: 'e.g: auth,users',
  } as any)
  @ApiQuery({
    name: 'auditMethods',
    required: false,
    type: String,
    description: 'e.g: POST,PATCH',
  } as any)
  @ApiQuery({ name: 'auditStatusCodes', required: false, type: String } as any)
  @ApiQuery({
    name: 'auditSuccessful',
    required: false,
    enum: ['0', '1'],
  } as any)
  @ApiQuery({
    name: 'auditLogDateRange',
    required: false,
    type: String,
    description: 'e.g: 2026-01-01,2026-01-31',
  } as any)
  @Get()
  findAll(@Request() req: ApiReq) {
    return this.auditLogsService.findAll(req);
  }

  @Get(':auditLogId')
  findOne(@Param('auditLogId', ParseObjectIdPipe) auditLogId: string) {
    return this.auditLogsService.findOne(auditLogId);
  }
}
