import { Test, TestingModule } from '@nestjs/testing';
import { ProductsService } from './products.service';
import { TestModule } from '@shared/testkits';
import { DataLogsService } from '@shared/datalogs';

describe('Cron ProductsService', () => {
  let productsService: ProductsService;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      imports: [TestModule],
      controllers: [],
      providers: [ProductsService],
    }).compile();

    productsService = app.get<ProductsService>(
      ProductsService,
    ) as ProductsService;

    global.dataLogsService = app.get<DataLogsService>(DataLogsService);
  });

  describe('productsService', () => {
    it('should return true for ProductsService"', () => {
      expect(!!productsService).toBe(true);
    });
  });
});
