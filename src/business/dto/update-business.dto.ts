import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { ValidateDynamicObject } from '@shared/validators';
import { SocialLinksDto } from './create-business.dto';

export class StageTrackerEntryDto {
  @ApiProperty({ required: true })
  @IsString()
  @IsNotEmpty()
  step: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  version?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  completed?: boolean;
}

export class UpdateBusinessDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  displayName?: string;

  @ApiPropertyOptional({
    description:
      'Storefront handle: 3-30 lowercase letters, numbers, - or _, starting and ending with a letter or number',
  })
  @IsOptional()
  @Transform(({ value }) => value?.toLowerCase())
  @Matches(/^[a-z0-9][a-z0-9_-]{1,28}[a-z0-9]$/, {
    message:
      'code must be 3-30 lowercase letters, numbers, - or _, starting and ending with a letter or number',
  })
  code?: string;

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

  @ApiPropertyOptional({
    type: 'object',
    description:
      'Onboarding progress tracked by the client, e.g. { "profile": { "step": "profile", "completed": true } }. Send completed=false to un-mark a step.',
    additionalProperties: {
      type: 'object',
      properties: {
        step: { type: 'string' },
        version: { type: 'string' },
        completed: { type: 'boolean' },
      },
    },
  })
  @IsOptional()
  @ValidateDynamicObject(StageTrackerEntryDto, {
    allowNull: false,
    allowUndefined: true,
  })
  stageTracker?: Record<string, StageTrackerEntryDto>;
}
