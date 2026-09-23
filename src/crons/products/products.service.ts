import { schedule } from 'node-cron';
import { Injectable, Inject } from '@nestjs/common';
import { Model } from 'mongoose';
import { LogLevel } from '@shared/interfaces';

@Injectable()
export class ProductsService {
  constructor(
  ) {}

  async notifyProductLevel() {
    const source = 'notifyProductLevel';
    global.dataLogsService.log(
      source,
      {
        source,
        message:
          'Started cron processing, Running once every Monday to Friday by 7:30 AM',
      },
      LogLevel.INFO,
    );
    schedule('30 7 * * 1-5', async () => {
      try {
        global.dataLogsService.log(
          source,
          { source, message: 'Completed running.' },
          LogLevel.INFO,
        );
      } catch (e) {
        global.dataLogsService.log(
          source,
          { source, stack: e.status, message: e.message },
          LogLevel.ERROR,
        );
      }
    });
  }
}
