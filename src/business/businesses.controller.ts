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
import { BusinessService } from './businesses.service';
import { CreateBusinessDto } from './dto/create-business.dto';
import { UpdateBusinessDto } from './dto/update-business.dto';
import {
  LinkPayoutAccountDto,
  ResolveAccountDto,
} from './dto/payout-account.dto';

@ApiTags('businesses')
@Controller('v1/businesses')
export class BusinessController {
  constructor(private readonly businessService: BusinessService) {}

  @AuditLogMeta({
    action: AuditType.USER,
    description: 'User set up creator profile and became a seller',
    severity: AuditSeverity.CRITICAL,
  })
  @RateProfile('transactional')
  @ApiBearerAuth()
  @UseGuards(JwtUsersGuard)
  @Post()
  async createBusiness(
    @Request() req: ApiReq,
    @Body() payload: CreateBusinessDto,
  ) {
    return this.businessService.createBusiness(req, payload);
  }

  @AuditLogMeta({
    action: AuditType.USER,
    description: 'Seller retrieved own business',
    severity: AuditSeverity.INFO,
  })
  @ApiBearerAuth()
  @UseGuards(JwtUsersGuard, RoleGuard)
  @Roles(RoleType.SELLER)
  @Get('me')
  async findMyBusiness(@Request() req: ApiReq) {
    return this.businessService.findMyBusiness(req);
  }

  @AuditLogMeta({
    action: AuditType.USER,
    description: 'Seller updated business profile or onboarding progress',
    severity: AuditSeverity.WARNING,
  })
  @ApiBearerAuth()
  @UseGuards(JwtUsersGuard, RoleGuard)
  @Roles(RoleType.SELLER)
  @Put('me')
  async updateMyBusiness(
    @Request() req: ApiReq,
    @Body() payload: UpdateBusinessDto,
  ) {
    return this.businessService.updateMyBusiness(req, payload);
  }

  @AuditLogMeta({
    action: AuditType.USER,
    description: 'Seller verified a bank account number',
    severity: AuditSeverity.WARNING,
  })
  @RateProfile('sensitive')
  @ApiBearerAuth()
  @UseGuards(JwtUsersGuard, RoleGuard)
  @Roles(RoleType.SELLER)
  @Post('me/payout-account/resolve')
  async resolvePayoutAccount(
    @Request() req: ApiReq,
    @Body() payload: ResolveAccountDto,
  ) {
    return this.businessService.resolvePayoutAccount(req, payload);
  }

  @AuditLogMeta({
    action: AuditType.USER,
    description: 'Seller linked or changed payout bank account',
    severity: AuditSeverity.CRITICAL,
  })
  @RateProfile('sensitive')
  @ApiBearerAuth()
  @UseGuards(JwtUsersGuard, RoleGuard)
  @Roles(RoleType.SELLER)
  @Put('me/payout-account')
  async linkPayoutAccount(
    @Request() req: ApiReq,
    @Body() payload: LinkPayoutAccountDto,
  ) {
    return this.businessService.linkPayoutAccount(req, payload);
  }

  @AuditLogMeta({
    action: AuditType.USER,
    description: 'Visitor viewed a storefront',
    severity: AuditSeverity.INFO,
  })
  @Get('public/:code')
  async findPublicBusiness(@Param('code') code: string) {
    return this.businessService.findPublicBusiness(code);
  }
}
