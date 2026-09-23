import { Module } from '@nestjs/common';
import { ProductsService } from './products.service';
import { DBModule } from '@shared/schemas';
import { ProductsAdminsController } from './products.admins.controller';
import { ProductsController } from './products.controller';

@Module({
  imports: [DBModule],
  controllers: [ProductsController, ProductsAdminsController],
  providers: [ProductsService],
})
export class ProductsModule {}
