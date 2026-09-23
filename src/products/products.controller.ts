import {
  Controller,
  Post,
  Body,
  Headers,
} from '@nestjs/common';
import { ApiHeader, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';

@ApiTags('products')
@Controller('v1/products')
export class ProductsController {
  constructor(private readonly productService: ProductsService) {}

  @Post()
  @ApiHeader({ name: 'tenantId' } as any)
  @ApiHeader({ name: 'userId' } as any)
  @ApiHeader({ name: 'countryCode' } as any)
  addTracking(
    @Headers('tenantId') tenantId: string,
    @Headers('userId') userId: string,
    @Headers('countryCode') countryCode: string,
    @Body() createProductDto: CreateProductDto,
  ) {
    createProductDto.tenantId = tenantId;
    createProductDto.userId = userId;
    createProductDto.countryCode = countryCode;
    return this.productService.create(createProductDto);
  }

  
}
