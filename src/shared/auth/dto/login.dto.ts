import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, Length } from 'class-validator';
import { NormalizeEmail } from './email.transform';

export class LoginDto {
  @ApiProperty()
  @NormalizeEmail()
  @IsEmail()
  email: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  password: string;
}

export class VerifyTwoFactorLoginDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  tempToken: string;

  @ApiProperty({
    description: '6-digit authenticator code or 8-character backup code',
  })
  @IsString()
  @Length(6, 8)
  token: string;
}

export class RefreshTokenDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}
