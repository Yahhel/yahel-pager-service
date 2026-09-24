import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Length } from 'class-validator';

export class EnableTwoFactorDto {
  @ApiProperty({ description: '6-digit code from the authenticator app' })
  @IsString()
  @Length(6, 6)
  token: string;
}

export class ConfirmTwoFactorDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  password: string;

  @ApiProperty({
    description: '6-digit authenticator code or 8-character backup code',
  })
  @IsString()
  @Length(6, 8)
  token: string;
}
