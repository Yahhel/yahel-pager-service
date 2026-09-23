import { Test, TestingModule } from '@nestjs/testing';
import { TestModule } from '../testkits';
import { DataLogsController } from './data.logs.controller';
import { DataLogsService } from './data.logs.service';

describe('DataLogsController', () => {
  let dataLogsController: DataLogsController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      imports: [TestModule],
      controllers: [DataLogsController],
      providers: [DataLogsService],
    }).compile();

    dataLogsController = app.get<DataLogsController>(
      DataLogsController,
    ) as DataLogsController;

    global.dataLogsService = app.get<DataLogsService>(DataLogsService);
  });

  describe('dataLogsController', () => {
    it('should return true for dataLogsController"', () => {
      expect(!!dataLogsController).toBe(true);
    });
  });
});
