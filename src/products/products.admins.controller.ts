import {
  Controller,
  Post,
  Body,
} from '@nestjs/common';
import { ApiTags, ApiQuery } from '@nestjs/swagger';
import { CreateProductDto } from './dto/create-product.dto';
import { ProductsService } from './products.service';

@ApiTags('admins')
@Controller('v1/admins/products')
export class ProductsAdminsController {
  constructor(private readonly productService: ProductsService) {}

  @Post()
  addProduct(@Body() CreateProductDto: CreateProductDto) {
    return this.productService.create(CreateProductDto);
  }
}
