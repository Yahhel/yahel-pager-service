import { NestFactory } from '@nestjs/core';
import { DbIndexesModule } from './db.indexes.module';

async function dbIndexes() {
  NestFactory.create(DbIndexesModule)
    .then(async (app) => {
      const dbIndexesModule = app.get<DbIndexesModule>(DbIndexesModule);
      await dbIndexesModule.runIndexes();
      await app.close();
      console.log('Indexes Successful');
      process.exit(0);
    })
    .catch(async (e) => {
      console.log('Indexes Failed', e.stack);
      process.exit(0);
    });
}

dbIndexes();
