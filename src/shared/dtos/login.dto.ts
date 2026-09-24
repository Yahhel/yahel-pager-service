import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDefined,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class LoginDto {
  @ApiProperty()
  @IsDefined()
  @IsEmail()
  @IsNotEmpty()
  @Transform(({ value }) => value?.toLowerCase())
  email: string;

  @ApiProperty()
  @IsDefined()
  @IsString()
  @IsNotEmpty()
  password: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  twoFactorToken?: string;
}

export class Enable2FADto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  token: string;
}

export class Disable2FADto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  password: string;
}

export class Verify2FALoginDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  tempToken: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  twoFactorToken: string;
}

export class GenerateBackupCodesDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  password: string;
}

export class ConfirmPasswordDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  password: string;
}
