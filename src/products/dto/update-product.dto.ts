import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDefined,
  IsNotEmpty,
  IsPositive,
  IsString,
} from 'class-validator';

export class UpdateProductDto {
  @ApiProperty()
  @IsDefined()
  @IsPositive()
  quantity: number;

  @ApiProperty()
  @IsDefined()
  @IsString()
  @IsNotEmpty()
  userId: string;

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
