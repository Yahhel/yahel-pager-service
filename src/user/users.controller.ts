import { Body, Controller, Put, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtUsersGuard, RoleGuard } from '@shared/auth/guards';
import { AuditLogMeta } from '@shared/decorators';
import { ApiReq, AuditSeverity, AuditType } from '@shared/interfaces';
import { UserService } from './users.service';
import { UserUpdateDto } from './dto/user-update.dto';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtUsersGuard, RoleGuard)
@Controller('v1/users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @AuditLogMeta({
    action: AuditType.USER,
    description: 'User updated their own profile',
    severity: AuditSeverity.ERROR,
  })
  @Put('profile')
  async updateOwnProfile(
    @Request() req: ApiReq,
    @Body() payload: UserUpdateDto,
  ) {
    return this.userService.updateUser(req, payload);
  }
}
