import { PasswordResetStatus, RoleType } from '@shared/interfaces';

export class LoginResponseDto {
  accessToken: string;
  refreshToken: string;
  expireDurationSeconds: number;
  roles?: RoleType[];
  passwordResetStatus?: PasswordResetStatus;
  twoFactorEnabled?: boolean;
}
