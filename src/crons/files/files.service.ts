import { schedule } from 'node-cron';
import { Inject, Injectable } from '@nestjs/common';
import { LogLevel } from '@shared/interfaces';
import { File, FileModel, User, UserModel } from '@shared/schemas';
import { configs } from '@shared/configs';

const PURGE_BATCH_SIZE = 500;

@Injectable()
export class FilesService {
  constructor(
    @Inject(File.name)
    private readonly fileModel: FileModel,
    @Inject(User.name)
    private readonly userModel: UserModel,
  ) {}

  async purgeFiles() {
    const source = 'purgeFiles';
    global.dataLogsService.log(
      source,
      {
        source,
        message:
          'Started cron processing, Running daily at 2:00 AM to purge deleted and unattached files',
      },
      LogLevel.INFO,
    );
    schedule('0 2 * * *', async () => {
      try {
        const result = await this.runPurge();
        global.dataLogsService.log(
          source,
          { source, message: 'Completed running.', ...result },
          LogLevel.INFO,
        );
      } catch (e) {
        global.dataLogsService.log(
          source,
          { source, stack: e.stack, message: e.message },
          LogLevel.ERROR,
        );
      }
    });
  }

  async runPurge() {
    const { deletedFileRetentionDays, unattachedFileRetentionHours } =
      configs().storage;
    const deletedBefore = new Date(
      Date.now() - deletedFileRetentionDays * 24 * 3600 * 1000,
    );
    const unattachedBefore = new Date(
      Date.now() - unattachedFileRetentionHours * 3600 * 1000,
    );

    let purgedFiles = 0;
    let deletedObjects = 0;
    // Batches keep each run's memory and query size bounded
    for (;;) {
      const result = await this.fileModel.purgeFiles({
        userModel: this.userModel,
        deletedBefore,
        unattachedBefore,
        batchSize: PURGE_BATCH_SIZE,
      });
      purgedFiles += result.purgedFiles;
      deletedObjects += result.deletedObjects;
      if (result.purgedFiles < PURGE_BATCH_SIZE) break;
    }
    return { purgedFiles, deletedObjects };
  }
}
