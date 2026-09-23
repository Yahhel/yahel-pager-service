import { NestFactory } from '@nestjs/core';
import { startRedis } from '@shared/utils';
import { DataLogsService } from '@shared/datalogs';
import { CronModule } from './cron.module';
import { CronService } from './cron.service';

async function bootstrap() {
  const app = await NestFactory.create(CronModule);
  // Add this to global for easy access anywhere in the app.
  global.dataLogsService = app.get<DataLogsService>(DataLogsService);

  const cronService = app.get<CronService>(CronService);

  console.log('Redis Connecting...');
  await startRedis();

  // Start all cron processes.
  cronService.run(true);

  await app.listen(process.env.CRON_PORT || 3200);
  console.log(`AA Cron application is running on: ${await app.getUrl()}`);
}

bootstrap();
