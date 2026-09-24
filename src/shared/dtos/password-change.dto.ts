import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PasswordChangeReason } from '@shared/interfaces';
import {
  IsDefined,
  IsEnum,
  IsNotEmpty,
  IsString,
  IsStrongPassword,
  ValidateIf,
} from 'class-validator';

export class PasswordChangeDTO {
  @ApiProperty({
    enum: PasswordChangeReason,
  })
  @IsDefined()
  @IsNotEmpty()
  @IsEnum(PasswordChangeReason)
  type: PasswordChangeReason;

  @ApiPropertyOptional({
    required: false,
  })
  @ValidateIf((o) => o.type === PasswordChangeReason.USER_INITIATED)
  @IsDefined()
  @IsNotEmpty()
  @IsString()
  oldPassword?: string;

  @ApiProperty()
  @IsDefined()
  @IsNotEmpty()
  @IsStrongPassword()
  newPassword: string;
}
