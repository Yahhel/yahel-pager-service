import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDefined,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class UpdateStatusDto {
  @ApiProperty()
  @IsDefined()
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  @ApiPropertyOptional()
  status?: string;

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
