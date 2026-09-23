import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import {
  ApiReq,
} from '@shared/interfaces';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Injectable()
export class ProductsService {
  constructor(
  ) {}

  async create(payload: CreateProductDto) {
    return "product created successfully";
  }

  async update(payload: UpdateProductDto, productId: string) {
    return "product updated successfully";
  }

  async updateStatus(
    payload: UpdateStatusDto,
    productId: string,
  ) {
    return "product status updated successfully";
  }

  async findOne(productId: string) {
    return productId || 'TrackingId';
  }

  async remove(productId: string) {
    return "product deleted successfully";
  }

  async findAll(req: ApiReq) {
    return [];
  }
}
