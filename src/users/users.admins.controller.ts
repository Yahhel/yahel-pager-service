import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard, RolesGuard } from '@shared/auth';
import { AuditLogMeta, Roles } from '@shared/decorators';
import {
  ApiReq,
  AuditSeverity,
  UserRole,
  UserRoles,
  UserStatuses,
} from '@shared/interfaces';
import { ParseObjectIdPipe } from '@shared/validators';
import { InviteAdminDto, UpdateUserStatusDto } from './dto';
import { UsersService } from './users.service';

@ApiTags('admins-users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('v1/admins/users')
export class UsersAdminsController {
  constructor(private readonly usersService: UsersService) {}

  @ApiQuery({ name: 'limit', required: false, type: String } as any)
  @ApiQuery({ name: 'page', required: false, type: String } as any)
  @ApiQuery({ name: 'order', required: false, enum: ['ASC', 'DESC'] } as any)
  @ApiQuery({
    name: 'userSearch',
    required: false,
    type: String,
    description: 'Matches name, email or phone',
  } as any)
  @ApiQuery({
    name: 'userRoles',
    required: false,
    type: String,
    description: `Comma-separated. ${UserRoles}`,
  } as any)
  @ApiQuery({
    name: 'userStatuses',
    required: false,
    type: String,
    description: `Comma-separated. ${UserStatuses}`,
  } as any)
  @ApiQuery({
    name: 'userEmailVerified',
    required: false,
    enum: ['0', '1'],
  } as any)
  @ApiQuery({
    name: 'userDateRange',
    required: false,
    type: String,
    description: 'e.g: 2026-01-01,2026-01-31',
  } as any)
  @Get()
  findAll(@Request() req: ApiReq) {
    return this.usersService.findAll(req);
  }

  @Get(':userId')
  findOne(@Param('userId', ParseObjectIdPipe) userId: string) {
    return this.usersService.findOne(userId);
  }

  @AuditLogMeta({
    description: 'Admin changed user status',
    severity: AuditSeverity.CRITICAL,
  })
  @Patch(':userId/status')
  updateStatus(
    @Request() req: ApiReq,
    @Param('userId', ParseObjectIdPipe) userId: string,
    @Body() dto: UpdateUserStatusDto,
  ) {
    return this.usersService.updateStatus(req.user, userId, dto);
  }

  @AuditLogMeta({
    description: 'Admin invited a new admin',
    severity: AuditSeverity.CRITICAL,
  })
  @Post('invite')
  inviteAdmin(@Body() dto: InviteAdminDto) {
    return this.usersService.inviteAdmin(dto);
  }
}
