import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDefined,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateAuditLogDto {
  @ApiProperty()
  @IsDefined()
  @IsString()
  @IsNotEmpty()
  actionBy: string;

  @ApiProperty()
  @IsDefined()
  @IsString()
  @IsNotEmpty()
  actionType: string;

  @ApiProperty()
  @IsDefined()
  @IsString()
  @IsNotEmpty()
  serviceName: string;

  @ApiProperty()
  @IsDefined()
  @IsString()
  @IsNotEmpty()
  action: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  severity?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  requestUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  requestMethod?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  requestActionBy?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  requestModelType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  requestReference?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ipAddress?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  actionSuccessful?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  responseStatus?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  latencyMs?: number;

  @ApiPropertyOptional()
  @IsOptional()
  requestData?: any;

  @ApiPropertyOptional()
  @IsOptional()
  responseData?: any;
}
