import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsDateString,
  IsDefined,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateProductDto {
  @ApiProperty()
  @IsDefined()
  @IsPositive()
  deliveredQuantity: number;

  @ApiProperty()
  @IsDefined()
  @IsString()
  @IsNotEmpty()
  tradeId: string;

  @ApiProperty()
  @IsString()
  @IsOptional()
  processFlowId: string;

  @ApiProperty()
  @IsDefined()
  @IsString()
  @IsNotEmpty()
  userId: string;

  @ApiProperty()
  @IsOptional()
  @IsDateString()
  expectedDeliveryDate: Date;

  @ApiProperty()
  @IsDefined()
  @IsString()
  @IsNotEmpty()
  tenantId: string;

  @ApiProperty()
  @IsDefined()
  @IsString()
  @IsNotEmpty()
  countryCode: string;
}
