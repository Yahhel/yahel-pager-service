import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDefined,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class SocialLinksDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl()
  website?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl()
  instagram?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl()
  x?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl()
  tiktok?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl()
  youtube?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl()
  facebook?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl()
  linkedin?: string;
}

export class CreateStoreDto {
  @ApiProperty()
  @IsDefined()
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  displayName: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  bio?: string;

  @ApiPropertyOptional({
    description: 'File ID of a public (private=false) image uploaded by you',
  })
  @IsOptional()
  @IsMongoId()
  profilePhoto?: string;

  @ApiPropertyOptional({ type: SocialLinksDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => SocialLinksDto)
  socialLinks?: SocialLinksDto;
}
