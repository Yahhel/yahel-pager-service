import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { configs } from '../configs';
import { AllowRestricted, AuditLogMeta } from '../decorators';
import { ApiReq, AuditSeverity } from '../interfaces';
import { AuthService } from './auth.service';
import {
  ChangePasswordDto,
  ConfirmTwoFactorDto,
  EnableTwoFactorDto,
  ForgotPasswordDto,
  LoginDto,
  RefreshTokenDto,
  ResetPasswordDto,
  SignupDto,
  VerifyEmailDto,
  VerifyTwoFactorLoginDto,
} from './dto';
import { JwtAuthGuard } from './guards';
import { TwoFactorService } from './two-factor.service';

const STRICT_THROTTLE = {
  default: {
    limit: () => configs().auth.throttleLimit,
    ttl: 60_000,
  },
};

@ApiTags('auth')
@Controller('v1/auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly twoFactorService: TwoFactorService,
  ) {}

  @AuditLogMeta({
    description: 'User signed up',
    severity: AuditSeverity.WARNING,
  })
  @Throttle(STRICT_THROTTLE)
  @Post('signup')
  signup(@Request() req: ApiReq, @Body() dto: SignupDto) {
    return this.authService.signup(req, dto);
  }

  @AuditLogMeta({
    description: 'User login attempt',
    severity: AuditSeverity.WARNING,
  })
  @Throttle(STRICT_THROTTLE)
  @HttpCode(HttpStatus.OK)
  @Post('login')
  login(@Request() req: ApiReq, @Body() dto: LoginDto) {
    return this.authService.login(req, dto);
  }

  @AuditLogMeta({
    description: 'User completed 2FA login challenge',
    severity: AuditSeverity.WARNING,
  })
  @Throttle(STRICT_THROTTLE)
  @HttpCode(HttpStatus.OK)
  @Post('2fa/verify')
  verifyTwoFactorLogin(
    @Request() req: ApiReq,
    @Body() dto: VerifyTwoFactorLoginDto,
  ) {
    return this.authService.verifyTwoFactorLogin(req, dto);
  }

  @AuditLogMeta({ description: 'User refreshed access token' })
  @HttpCode(HttpStatus.OK)
  @Post('refresh-token')
  refreshToken(@Request() req: ApiReq, @Body() dto: RefreshTokenDto) {
    return this.authService.refreshToken(req, dto);
  }

  @AuditLogMeta({ description: 'User logged out' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @AllowRestricted()
  @HttpCode(HttpStatus.OK)
  @Post('logout')
  logout(@Request() req: ApiReq) {
    return this.authService.logout(req.user);
  }

  @AuditLogMeta({ description: 'User fetched own profile' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @AllowRestricted()
  @Get('me')
  me(@Request() req: ApiReq) {
    return this.authService.me(req.user);
  }

  @AuditLogMeta({
    description: 'User changed password',
    severity: AuditSeverity.CRITICAL,
  })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @AllowRestricted()
  @HttpCode(HttpStatus.OK)
  @Post('password-change')
  changePassword(@Request() req: ApiReq, @Body() dto: ChangePasswordDto) {
    return this.authService.changePassword(req.user, dto);
  }

  @AuditLogMeta({ description: 'User requested email verification code' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Throttle(STRICT_THROTTLE)
  @HttpCode(HttpStatus.OK)
  @Post('email-verification/send')
  sendEmailVerification(@Request() req: ApiReq) {
    return this.authService.sendEmailVerification(req.user);
  }

  @AuditLogMeta({
    description: 'User verified email',
    severity: AuditSeverity.WARNING,
  })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Throttle(STRICT_THROTTLE)
  @HttpCode(HttpStatus.OK)
  @Post('verify-email')
  verifyEmail(@Request() req: ApiReq, @Body() dto: VerifyEmailDto) {
    return this.authService.verifyEmail(req.user, dto);
  }

  @AuditLogMeta({
    description: 'User requested password reset',
    severity: AuditSeverity.WARNING,
  })
  @Throttle(STRICT_THROTTLE)
  @HttpCode(HttpStatus.OK)
  @Post('forgot-password')
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @AuditLogMeta({
    description: 'User reset password with code',
    severity: AuditSeverity.CRITICAL,
  })
  @Throttle(STRICT_THROTTLE)
  @HttpCode(HttpStatus.OK)
  @Post('reset-password')
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @AuditLogMeta({
    description: 'User started 2FA setup',
    severity: AuditSeverity.WARNING,
  })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @AllowRestricted()
  @HttpCode(HttpStatus.OK)
  @Post('2fa/setup')
  setupTwoFactor(@Request() req: ApiReq) {
    return this.twoFactorService.setup(req.user);
  }

  @AuditLogMeta({
    description: 'User enabled 2FA',
    severity: AuditSeverity.CRITICAL,
  })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @AllowRestricted()
  @HttpCode(HttpStatus.OK)
  @Post('2fa/enable')
  enableTwoFactor(@Request() req: ApiReq, @Body() dto: EnableTwoFactorDto) {
    return this.twoFactorService.enable(req.user, dto);
  }

  @AuditLogMeta({
    description: 'User disabled 2FA',
    severity: AuditSeverity.CRITICAL,
  })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Throttle(STRICT_THROTTLE)
  @HttpCode(HttpStatus.OK)
  @Post('2fa/disable')
  disableTwoFactor(@Request() req: ApiReq, @Body() dto: ConfirmTwoFactorDto) {
    return this.twoFactorService.disable(req.user, dto);
  }

  @AuditLogMeta({
    description: 'User regenerated 2FA backup codes',
    severity: AuditSeverity.CRITICAL,
  })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Throttle(STRICT_THROTTLE)
  @HttpCode(HttpStatus.OK)
  @Post('2fa/backup-codes')
  regenerateBackupCodes(
    @Request() req: ApiReq,
    @Body() dto: ConfirmTwoFactorDto,
  ) {
    return this.twoFactorService.regenerateBackupCodes(req.user, dto);
  }

  @AuditLogMeta({ description: 'User checked 2FA status' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @AllowRestricted()
  @Get('2fa/status')
  twoFactorStatus(@Request() req: ApiReq) {
    return this.twoFactorService.status(req.user);
  }
}
