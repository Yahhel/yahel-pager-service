import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '@shared/auth';
import { AuditLogMeta } from '@shared/decorators';
import { ApiReq, AuditSeverity } from '@shared/interfaces';
import { UpdateProfileDto } from './dto';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('v1/users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @AuditLogMeta({ description: 'User updated own profile' })
  @Patch('me')
  updateProfile(@Request() req: ApiReq, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateProfile(req.user, dto);
  }

  @AuditLogMeta({
    description: 'User became a seller',
    severity: AuditSeverity.WARNING,
  })
  @HttpCode(HttpStatus.OK)
  @Post('me/become-seller')
  becomeSeller(@Request() req: ApiReq) {
    return this.usersService.becomeSeller(req.user);
  }
}
