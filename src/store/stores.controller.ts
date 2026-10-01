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
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtUsersGuard, RoleGuard } from '@shared/auth/guards';
import { AuditLogMeta, Roles } from '@shared/decorators';
import { ApiReq, AuditSeverity, AuditType, RoleType } from '@shared/interfaces';
import { RateProfile } from '@shared/rate-limit';
import { StoreService } from './stores.service';
import { CreateStoreDto } from './dto/create-store.dto';
import { UpdateStoreDto } from './dto/update-store.dto';

@ApiTags('stores')
@Controller('v1/stores')
export class StoreController {
  constructor(private readonly storeService: StoreService) {}

  @AuditLogMeta({
    action: AuditType.USER,
    description: 'User set up creator profile and became a seller',
    severity: AuditSeverity.CRITICAL,
  })
  @RateProfile('transactional')
  @ApiBearerAuth()
  @UseGuards(JwtUsersGuard)
  @Post()
  async createStore(@Request() req: ApiReq, @Body() payload: CreateStoreDto) {
    return this.storeService.createStore(req, payload);
  }

  @AuditLogMeta({
    action: AuditType.USER,
    description: 'Seller retrieved own store',
    severity: AuditSeverity.INFO,
  })
  @ApiBearerAuth()
  @UseGuards(JwtUsersGuard, RoleGuard)
  @Roles(RoleType.SELLER)
  @Get('me')
  async findMyStore(@Request() req: ApiReq) {
    return this.storeService.findMyStore(req);
  }

  @AuditLogMeta({
    action: AuditType.USER,
    description: 'Seller updated store profile or onboarding progress',
    severity: AuditSeverity.WARNING,
  })
  @ApiBearerAuth()
  @UseGuards(JwtUsersGuard, RoleGuard)
  @Roles(RoleType.SELLER)
  @Put('me')
  async updateMyStore(@Request() req: ApiReq, @Body() payload: UpdateStoreDto) {
    return this.storeService.updateMyStore(req, payload);
  }

  @AuditLogMeta({
    action: AuditType.USER,
    description: 'Visitor viewed a storefront',
    severity: AuditSeverity.INFO,
  })
  @Get('public/:code')
  async findPublicStore(@Param('code') code: string) {
    return this.storeService.findPublicStore(code);
  }
}
