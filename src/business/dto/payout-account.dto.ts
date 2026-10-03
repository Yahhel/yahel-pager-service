import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDefined,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';

export class ResolveAccountDto {
  @ApiProperty({ description: 'Bank code from GET v1/shareables/banks/public' })
  @IsDefined()
  @IsString()
  @IsNotEmpty()
  bankCode: string;

  @ApiProperty({ description: '10-digit NUBAN account number' })
  @IsDefined()
  @Matches(/^\d{10}$/, { message: 'accountNumber must be 10 digits' })
  accountNumber: string;
}

export class LinkPayoutAccountDto extends ResolveAccountDto {
  @ApiPropertyOptional({
    description: 'Required when replacing an existing payout account',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  password?: string;

  @ApiPropertyOptional({
    description:
      'Required when replacing an existing payout account and 2FA is enabled',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  twoFactorToken?: string;
}
