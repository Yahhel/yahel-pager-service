import { ApiProperty } from '@nestjs/swagger';
import {
  IsDefined,
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

class NameCodeDto {
  @ApiProperty()
  @IsDefined()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty()
  @IsDefined()
  @IsString()
  @MinLength(2)
  @MaxLength(3)
  @IsNotEmpty()
  code: string;
}

export class CountryDto extends NameCodeDto {
  @ApiProperty()
  @IsDefined()
  @IsString()
  @MinLength(3)
  @MaxLength(3)
  @IsNotEmpty()
  currency: string;
}

export class StateDto extends NameCodeDto {}

export class CityDto extends NameCodeDto {}
