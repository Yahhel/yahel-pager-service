import { ApiProperty } from '@nestjs/swagger';
import { IsDefined, IsNotEmpty, IsString } from 'class-validator';

export class CreateProductDto {
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
