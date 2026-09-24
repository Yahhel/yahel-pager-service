import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { getJwtSecret } from '../configs';
import { DBModule } from '../schemas';
import { AuthStoreService } from './auth-store.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { TwoFactorService } from './two-factor.service';

@Module({
  imports: [
    DBModule,
    PassportModule,
    JwtModule.registerAsync({
      useFactory: () => ({ secret: getJwtSecret() }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, AuthStoreService, TwoFactorService, JwtStrategy],
  exports: [AuthStoreService],
})
export class AuthModule {}
