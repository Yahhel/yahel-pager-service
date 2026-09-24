import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAdminsGuard } from '@shared/auth/guards';
import { AuditLogMeta } from '@shared/decorators';
import {
  ApiReq,
  AuditSeverity,
  AuditType,
  RoleTypes,
  UserStatuses,
} from '@shared/interfaces';
import { UserService } from './users.service';
import { InviteUserDto } from './dto/invite-user.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';

@ApiTags('admins')
@ApiBearerAuth()
@UseGuards(JwtAdminsGuard)
@Controller('v1/admins/users')
export class UsersAdminsController {
  constructor(private readonly userService: UserService) {}

  @AuditLogMeta({
    action: AuditType.ADMIN,
    description: 'Admin retrieved users',
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
    name: 'userSearch',
    required: false,
    type: String,
    description: 'fuzzy search on name, email or phone',
  } as any)
  @ApiQuery({
    name: 'userByIds',
    required: false,
    type: String,
    description: 'comma separated user ids',
  } as any)
  @ApiQuery({
    name: 'userByRoles',
    required: false,
    type: String,
    description: `comma separated: ${RoleTypes}`,
  } as any)
  @ApiQuery({
    name: 'userByStatuses',
    required: false,
    type: String,
    description: `comma separated: ${UserStatuses}`,
  } as any)
  @ApiQuery({
    name: 'userByEmailVerified',
    required: false,
    type: Boolean,
    enum: [true, false],
  } as any)
  @ApiQuery({
    name: 'userDateRange',
    required: false,
    type: String,
    description: 'e.g: 2020-11-12,2022-11-15',
  } as any)
  @Get()
  findAll(@Request() req: ApiReq) {
    return this.userService.findAll(req);
  }

  @AuditLogMeta({
    action: AuditType.ADMIN,
    description: 'Admin retrieved a user profile',
    severity: AuditSeverity.INFO,
  })
  @Get(':userId')
  findOne(@Param('userId') userId: string) {
    return this.userService.findOne(userId);
  }

  @AuditLogMeta({
    action: AuditType.ADMIN,
    description: 'Admin updated a user status',
    severity: AuditSeverity.CRITICAL,
  })
  @Put(':userId/status')
  async updateStatus(
    @Request() req: ApiReq,
    @Param('userId') userId: string,
    @Body() payload: UpdateUserStatusDto,
  ) {
    return this.userService.updateStatus(req, userId, payload);
  }

  @AuditLogMeta({
    action: AuditType.ADMIN,
    description: 'Admin invited a new admin',
    severity: AuditSeverity.CRITICAL,
  })
  @Post('invite')
  async inviteUser(
    @Request() req: ApiReq,
    @Body() inviteUserDto: InviteUserDto,
  ) {
    return this.userService.inviteUser(req, inviteUserDto);
  }
}
