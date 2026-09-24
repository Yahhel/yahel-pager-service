import {
  Body,
  Controller,
  Post,
  Req,
  Request,
  Get,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { CreateUserDto } from '../dtos/create-user.dto';
import { VerifyEmailDto } from '@shared/dtos/verify-email.dto';
import { SendEmailVerificationTokenDto } from '@shared/dtos/send-email-verification-token.dto';
import {
  ConfirmPasswordDto,
  Disable2FADto,
  Enable2FADto,
  GenerateBackupCodesDto,
  LoginDto,
  Verify2FALoginDto,
} from '@shared/dtos/login.dto';
import { LoginResponseDto } from '@shared/dtos/login-response.dto';
import { RefreshTokenDto } from '@shared/dtos/refresh-token.dto';
import { ApiReq, AuditSeverity, AuditType } from '@shared/interfaces';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtUsersGuard } from './guards';
import { ForgotPasswordDTO, ResetPasswordDTO } from '@shared/dtos';
import { AuditLogMeta } from '@shared/decorators';
import { PasswordChangeDTO } from '@shared/dtos/password-change.dto';
import { RateProfile } from '@shared/rate-limit';

@ApiTags('auth')
@Controller('v1/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @AuditLogMeta({
    action: AuditType.USER,
    description: 'User initiated signup request via public API endpoint',
    severity: AuditSeverity.CRITICAL,
  })
  @RateProfile('sensitive')
  @Post('signup')
  async registerUser(@Req() req: Request, @Body() body: CreateUserDto) {
    return await this.authService.createUser(body);
  }

  @AuditLogMeta({
    action: AuditType.USER,
    description:
      'User attempted email verification using public verification endpoint',
    severity: AuditSeverity.ERROR,
  })
  @RateProfile('sensitive')
  @Post('verify-email/public')
  async verifyEmail(@Req() req: Request, @Body() body: VerifyEmailDto) {
    return await this.authService.verifyEmail(body);
  }

  @AuditLogMeta({
    action: AuditType.USER,
    description: 'User attempted to confirm password',
    severity: AuditSeverity.CRITICAL,
  })
  @ApiBearerAuth()
  @UseGuards(JwtUsersGuard)
  @Post('confirm-password')
  async confirmUserPassword(
    @Request() req: ApiReq,
    @Body() body: ConfirmPasswordDto,
  ) {
    return await this.authService.confirmUserPassword(req, body);
  }

  @AuditLogMeta({
    action: AuditType.USER,
    description:
      'User requested email verification token for account validation',
    severity: AuditSeverity.CRITICAL,
  })
  @RateProfile('sensitive')
  @Post('/email-verification/send')
  async sendEmailVerificationToken(
    @Request() req: ApiReq,
    @Body() body: SendEmailVerificationTokenDto,
  ) {
    return await this.authService.sendEmailVerificationToken(body);
  }

  @AuditLogMeta({
    action: AuditType.USER,
    description: 'User attempted login via public login endpoint',
    severity: AuditSeverity.CRITICAL,
  })
  @RateProfile('sensitive')
  @Post('login')
  async login(
    @Body() loginDto: LoginDto,
    @Request() req: ApiReq,
  ): Promise<
    LoginResponseDto | { requiresTwoFactor: boolean; tempToken: string }
  > {
    return this.authService.login(req, loginDto);
  }

  @AuditLogMeta({
    action: AuditType.USER,
    description: 'User requested to refresh authentication token',
    severity: AuditSeverity.ERROR,
  })
  @ApiBearerAuth()
  @Post('refresh-token')
  async refreshToken(
    @Body() refreshTokenDto: RefreshTokenDto,
    @Request() req: ApiReq,
  ) {
    return this.authService.refreshToken(req, refreshTokenDto);
  }

  @AuditLogMeta({
    action: AuditType.USER,
    description: 'User logged out',
    severity: AuditSeverity.INFO,
  })
  @ApiBearerAuth()
  @UseGuards(JwtUsersGuard)
  @Post('logout')
  async logout(@Request() req: ApiReq) {
    return this.authService.logout(req);
  }

  @AuditLogMeta({
    action: AuditType.USER,
    description: 'User attempted to change thier password',
    severity: AuditSeverity.CRITICAL,
  })
  @ApiBearerAuth()
  @UseGuards(JwtUsersGuard)
  @Post('password-change')
  async passwordChange(
    @Body() passwordChangeDTO: PasswordChangeDTO,
    @Request() req: ApiReq,
  ) {
    return this.authService.changePassword(req, passwordChangeDTO);
  }

  @AuditLogMeta({
    action: AuditType.USER,
    description: 'Authenticated user fetched own profile information',
    severity: AuditSeverity.ERROR,
  })
  @ApiBearerAuth()
  @UseGuards(JwtUsersGuard)
  @Get('me')
  getUserProfile(@Request() req: ApiReq) {
    return this.authService.findMe(req);
  }

  @AuditLogMeta({
    action: AuditType.USER,
    description: 'User requested password reset via public endpoint',
    severity: AuditSeverity.CRITICAL,
  })
  @RateProfile('sensitive')
  @Post('forgot-password/public')
  async forgotPassword(@Body() forgotPasswordDTO: ForgotPasswordDTO) {
    return this.authService.forgotPassword(forgotPasswordDTO);
  }

  @AuditLogMeta({
    action: AuditType.USER,
    description: 'User attempted to reset password with provided reset token',
    severity: AuditSeverity.CRITICAL,
  })
  @RateProfile('sensitive')
  @Post('reset-password/public')
  async resetPassword(@Body() resetPasswordDTO: ResetPasswordDTO) {
    return this.authService.resetPassword(resetPasswordDTO);
  }

  @AuditLogMeta({
    action: AuditType.USER,
    description: 'User initiated 2FA setup process',
    severity: AuditSeverity.CRITICAL,
  })
  @ApiBearerAuth()
  @UseGuards(JwtUsersGuard)
  @Post('2fa/setup')
  async setup2FA(@Request() req: ApiReq): Promise<{
    secret: string;
    qrCodeUrl: string;
    manualEntryKey: string;
  }> {
    return this.authService.setup2FA(req);
  }

  @AuditLogMeta({
    action: AuditType.USER,
    description: 'User attempted to enable 2FA authentication',
    severity: AuditSeverity.CRITICAL,
  })
  @ApiBearerAuth()
  @UseGuards(JwtUsersGuard)
  @Post('2fa/enable')
  async enable2FA(
    @Body() enable2FADto: Enable2FADto,
    @Request() req: ApiReq,
  ): Promise<{
    message: string;
    backupCodes: string[];
  }> {
    return this.authService.enable2FA(req, enable2FADto);
  }

  @AuditLogMeta({
    action: AuditType.USER,
    description: 'User attempted to disable 2FA authentication',
    severity: AuditSeverity.CRITICAL,
  })
  @ApiBearerAuth()
  @UseGuards(JwtUsersGuard)
  @Post('2fa/disable')
  async disable2FA(
    @Body() disable2FADto: Disable2FADto,
    @Request() req: ApiReq,
  ): Promise<{ message: string }> {
    return this.authService.disable2FA(req, disable2FADto);
  }

  @AuditLogMeta({
    action: AuditType.USER,
    description: 'User requested new 2FA backup codes',
    severity: AuditSeverity.CRITICAL,
  })
  @ApiBearerAuth()
  @UseGuards(JwtUsersGuard)
  @Post('2fa/backup-codes')
  async generateBackupCodes(
    @Body() generateBackupCodesDto: GenerateBackupCodesDto,
    @Request() req: ApiReq,
  ): Promise<{ backupCodes: string[] }> {
    return this.authService.generateBackupCodes(req, generateBackupCodesDto);
  }

  @AuditLogMeta({
    action: AuditType.USER,
    description: 'User checked 2FA status',
    severity: AuditSeverity.WARNING,
  })
  @ApiBearerAuth()
  @UseGuards(JwtUsersGuard)
  @Get('2fa/status')
  async get2FAStatus(@Request() req: ApiReq): Promise<{
    twoFactorEnabled: boolean;
    backupCodesRemaining: number;
  }> {
    return this.authService.get2FAStatus(req);
  }

  @AuditLogMeta({
    action: AuditType.USER,
    description: 'User attempted to complete 2FA verification during login',
    severity: AuditSeverity.CRITICAL,
  })
  @RateProfile('sensitive')
  @Post('2fa/verify')
  async verify2FALogin(
    @Body() verify2FALoginDto: Verify2FALoginDto,
    @Request() req: ApiReq,
  ): Promise<LoginResponseDto> {
    return this.authService.verify2FALogin(req, verify2FALoginDto);
  }
}
