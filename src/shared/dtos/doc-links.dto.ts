import { ApiProperty } from '@nestjs/swagger';
import { IsDefined, IsNotEmpty, IsString } from 'class-validator';

export class DocLinksDto {
  @ApiProperty()
  @IsDefined()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty()
  @IsDefined()
  @IsString()
  @IsNotEmpty()
  link: string;
}
