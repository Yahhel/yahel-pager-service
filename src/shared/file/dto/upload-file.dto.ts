import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';

export class UploadFileDto {
  @ApiPropertyOptional({
    type: Boolean,
    default: true,
    description:
      'Private files (e.g. paid deliverables) are only served to their owner. Set false for public assets like business logos and product covers.',
  })
  @IsOptional()
  @Transform(({ value }) => value !== false && value !== 'false')
  @IsBoolean()
  private?: boolean;

  @ApiProperty({
    type: 'string',
    format: 'binary',
    description: 'Files to be uploaded',
    isArray: true,
    required: true,
  })
  @IsOptional()
  documents: Express.Multer.File[];
}
