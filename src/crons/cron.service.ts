import { Injectable } from '@nestjs/common';
import { redisGet, redisSet } from '@shared/utils';
import { LogLevel } from '@shared/interfaces';
import * as dateFns from 'date-fns';
import { ProductsService } from './products/products.service';

@Injectable()
export class CronService {
  constructor(
    private readonly productsService: ProductsService,
  ) {}

  async run(runAlways = false) {
    const cronAppKey = 'app:cron:run';
    try {
      if (process.env.CRON_SHOULD_RUN !== 'true') {
        const source = 'NOT_RUNNING_CRON';
        return global.dataLogsService.log(
          source,
          {
            source,
            message: 'NOT_RUNNING_CRON',
            env: process.env.NODE_ENV,
          },
          LogLevel.INFO,
        );
      }

      // TO DENOTE CRON IS RUNNING IN ONE ENVIRONMENT AND AVOID RE-RUNNING WHEN APP INIT.
      const result = await redisGet(cronAppKey);
      if (result && !runAlways) {
        const minutesDiff = Math.abs(
          dateFns.differenceInMinutes(new Date(), new Date(result.startDate)),
        );
        if (minutesDiff < 30) {
          const source1 = 'ALREADY_RUNNING_CRON';
          return global.dataLogsService.log(
            source1,
            {
              source: source1,
              message: source1,
              env: process.env.NODE_ENV,
            },
            LogLevel.INFO,
          );
        }
      }

      // TO DENOTE CRON ABOUT TO SET TO RUN STATE IN ONE ENVIRONMENT
      await redisSet(cronAppKey, {
        startDate: new Date().toISOString(),
        running: true,
      });

      global.dataLogsService.log(
        'CRON_STARTED',
        {
          source: 'CRON_STARTED',
          message: 'CRON_STARTED',
          env: process.env.NODE_ENV,
        },
        LogLevel.INFO,
      );

      // TODO: Initialize all your cron services here as sample below.
      // ========= PRODUCT CRON =========//
      this.productsService.notifyProductLevel();
    } catch (e) {
      const source_ = 'UNABLE_TO_RUN_CRON';
      global.dataLogsService.log(
        source_,
        {
          source: source_,
          message: `UNABLE RUN CRON IN THIS ENVIRONMENT`,
          env: process.env.NODE_ENV,
        },
        LogLevel.ERROR,
      );
    }
  }
}
