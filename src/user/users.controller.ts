import {
  Body,
  Controller,
  Post,
  Put,
  Request,
  UseGuards,
} from '@nestjs/common';
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

  @AuditLogMeta({
    action: AuditType.USER,
    description: 'User upgraded their account to seller',
    severity: AuditSeverity.CRITICAL,
  })
  @Post('become-seller')
  async becomeSeller(@Request() req: ApiReq) {
    return this.userService.becomeSeller(req);
  }
}
