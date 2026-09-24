import { Logger, Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DataLogsModule } from '@shared/datalogs';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import {
  AuditContextGuard,
  AuditLogInterceptor,
  AuditLogRecorder,
  LogInterceptor,
} from '@shared/interceptors';
import { AllExceptionsFilter } from '@shared/exceptions';
import { DBModule } from '@shared/schemas';
import { AuthModule } from '@shared/auth';
import { AuditLogsModule } from '@shared/audit-logs';
import { ProductsModule } from './products';
import { UsersModule } from './users';

@Module({
  imports: [
    ThrottlerModule.forRoot([{
      ttl: +process.env.RATE_LIMIT_TTL,
      limit: +process.env.RATE_LIMIT_REQUEST_SIZE,
    }]),
    DBModule,
    DataLogsModule,
    AuthModule,
    UsersModule,
    AuditLogsModule,
    ProductsModule
  ],
  controllers: [AppController],
  providers: [
    AppService,
    Logger,
    ThrottlerGuard,
    AuditLogRecorder,
    AuditContextGuard,
    LogInterceptor,
    AuditLogInterceptor,
    AllExceptionsFilter,
  ],
  exports: [AppService, Logger, LogInterceptor, AllExceptionsFilter],
})
export class AppModule {}
