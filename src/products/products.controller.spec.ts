import { Test, TestingModule } from '@nestjs/testing';
import { ProductsService } from './products.service';
import { DataLogsService } from '@shared/datalogs';
import { TestModule } from '@shared/testkits';
import { ProductsController } from './products.controller';

describe('productController', () => {
  let productController: ProductsController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      imports: [TestModule],
      controllers: [ProductsController],
      providers: [ProductsService],
    }).compile();

    productController = app.get<ProductsController>(
      ProductsController,
    ) as ProductsController;

    global.dataLogsService = app.get<DataLogsService>(DataLogsService);
  });

  describe('productController', () => {
    it('should return true for productController"', () => {
      expect(!!productController).toBe(true);
    });
  });
});
