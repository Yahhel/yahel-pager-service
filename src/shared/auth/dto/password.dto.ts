import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsNumberString,
  IsString,
  Length,
} from 'class-validator';
import { NormalizeEmail } from './email.transform';
import { IsStrongPassword } from './password.validator';

export class ChangePasswordDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  oldPassword: string;

  @ApiProperty()
  @IsStrongPassword()
  newPassword: string;
}

export class ForgotPasswordDto {
  @ApiProperty()
  @NormalizeEmail()
  @IsEmail()
  email: string;
}

export class ResetPasswordDto {
  @ApiProperty()
  @NormalizeEmail()
  @IsEmail()
  email: string;

  @ApiProperty()
  @IsNumberString()
  @Length(6, 6)
  code: string;

  @ApiProperty()
  @IsStrongPassword()
  newPassword: string;
}

export class VerifyEmailDto {
  @ApiProperty()
  @IsNumberString()
  @Length(6, 6)
  code: string;
}
