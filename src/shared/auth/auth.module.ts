import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { DBModule } from '@shared/schemas';
import { JwtModule } from '@nestjs/jwt';
import { JwtUserStrategy } from './strategies/jwt.user.strategy';
import { JwtAdminStrategy } from './strategies/jwt.admin.strategy';
import { PassportModule } from '@nestjs/passport';
import { JwtAdminsGuard, JwtUsersGuard, RoleGuard } from './guards';
import { getTokenExpirationSeconds } from '@shared/utils';

@Module({
  imports: [
    DBModule,
    PassportModule,
    JwtModule.registerAsync({
      useFactory: () => ({
        secret: process.env.JWT_SECRET,
        signOptions: { expiresIn: getTokenExpirationSeconds() },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    PassportModule,
    JwtModule,
    AuthService,
    JwtUserStrategy,
    JwtAdminStrategy,
    JwtUsersGuard,
    JwtAdminsGuard,
    RoleGuard,
  ],
  exports: [AuthService],
})
export class AuthModule {}
