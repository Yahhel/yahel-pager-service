import * as path from 'path';
import * as express from 'express';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from '@nestjs/common';
import {
  AuditContextGuard,
  AuditLogInterceptor,
  LogInterceptor,
} from '@shared/interceptors';
import { AllExceptionsFilter } from '@shared/exceptions';
import { DataLogsService } from '@shared/datalogs';
import { ThrottlerGuard } from '@nestjs/throttler';
import { configs } from '@shared/configs';
import * as cloudinary from 'cloudinary';
import {  startRedis } from '@shared/utils';
import * as bodyParser from 'body-parser';
import { processNigeriaStateLGAs } from '@shared/configs/countries.constant';
import { ValidatePipe } from '@shared/validators';

function buildSwaggerDocument(app: any) {
  const config = new DocumentBuilder()
    .addBearerAuth()
    .setTitle('Yahhel Pager Backend Documentation')
    .setDescription('All API description and usage')
    .setExternalDoc('Postman Collection', '/docs/api-json')
    .setVersion('1.0')
    .addTag('auth')
    .addTag('users')
    .addTag('admins-users')
    .addTag('admins-audit-logs')
    .addTag('products')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs/api', app, document);
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  const logInterceptor = app.get<LogInterceptor>(LogInterceptor);
  const auditLogInterceptor = app.get<AuditLogInterceptor>(AuditLogInterceptor);
  const throttlerGuard = app.get<ThrottlerGuard>(ThrottlerGuard);
  const auditContextGuard = app.get<AuditContextGuard>(AuditContextGuard);
  const allExceptionsFilter = app.get<AllExceptionsFilter>(AllExceptionsFilter);

  // Add this to global for easy access anywhere in the app.
  global.dataLogsService = app.get<DataLogsService>(DataLogsService);

  app.useGlobalFilters(allExceptionsFilter);
  app.useGlobalInterceptors(logInterceptor, auditLogInterceptor);
  // Audit context first so throttled requests are still audited
  app.useGlobalGuards(auditContextGuard, throttlerGuard);
  app.useGlobalPipes(new ValidatePipe({ whitelist: true }));
  app.setGlobalPrefix('api');
  app.useLogger(app.get(Logger));
  app.use(bodyParser.json({ limit: '100mb' }));
  app.use(bodyParser.urlencoded({ limit: '100mb', extended: true }));
  app.use(
    '/docs/structures',
    express.static(path.join(__dirname, '../documentation')),
  );

  buildSwaggerDocument(app);
  cloudinary.v2.config(configs().cloudinary);
  await app.listen(process.env.PORT || 3333);
  console.log(`Yahhel Pager application is running on: ${await app.getUrl()}`);
  console.log('Redis Connecting...');
  await startRedis();
}

bootstrap();
