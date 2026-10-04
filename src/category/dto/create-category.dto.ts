import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsMongoId,
  IsEnum,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CategoryEntityModules, EntityModule } from '@shared/interfaces';

export class CreateCategoryDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  name: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  @MaxLength(300)
  description?: string;

  @ApiProperty({ enum: CategoryEntityModules })
  @IsEnum(EntityModule, {
    message: `module must be one of: ${CategoryEntityModules.join(', ')}`,
  })
  @IsString()
  @IsNotEmpty()
  module: EntityModule;

  @ApiPropertyOptional({
    description: 'Top-level category this one sits under',
  })
  @IsMongoId()
  @IsOptional()
  parentCategoryId?: string;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
