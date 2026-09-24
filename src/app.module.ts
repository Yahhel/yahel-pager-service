import { Logger, Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DataLogsModule } from '@shared/datalogs';
import { AuditLogInterceptor, LogInterceptor } from '@shared/interceptors';
import { AllExceptionsFilter } from '@shared/exceptions';
import { RateLimitModule, RateLimitGuard } from '@shared/rate-limit';
import { DBModule } from '@shared/schemas';
import { AuthModule } from './shared/auth/auth.module';
import { UsersModule } from './user/users.module';
import { AuditLogModule } from '@shared/audit-logs';
import { JwtUserStrategy } from '@shared/auth/strategies/jwt.user.strategy';
import { JwtAdminStrategy } from '@shared/auth/strategies/jwt.admin.strategy';
import { PassportModule } from '@nestjs/passport';
import { ProductsModule } from './products';

@Module({
  imports: [
    RateLimitModule,
    DBModule,
    PassportModule,
    DataLogsModule,
    AuthModule,
    UsersModule,
    AuditLogModule,
    ProductsModule,
  ],
  controllers: [AppController],
  providers: [
    Logger,
    AppService,
    RateLimitGuard,
    LogInterceptor,
    JwtUserStrategy,
    JwtAdminStrategy,
    AuditLogInterceptor,
    AllExceptionsFilter,
  ],
  exports: [AppService, Logger, LogInterceptor, AllExceptionsFilter],
})
export class AppModule {}
