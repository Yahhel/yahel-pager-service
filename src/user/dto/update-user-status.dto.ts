import { ApiProperty } from '@nestjs/swagger';
import { IsDefined, IsEnum, IsNotEmpty } from 'class-validator';
import { UserStatus } from '@shared/interfaces';

export class UpdateUserStatusDto {
  @ApiProperty({ enum: UserStatus })
  @IsDefined()
  @IsNotEmpty()
  @IsEnum(UserStatus)
  status: UserStatus;
}
