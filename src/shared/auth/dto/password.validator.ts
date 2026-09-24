import { applyDecorators } from '@nestjs/common';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

const PASSWORD_REGEX = /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[^A-Za-z\d]).+$/;

export const IsStrongPassword = () =>
  applyDecorators(
    IsString(),
    MinLength(8),
    // bcrypt ignores input beyond 72 bytes
    MaxLength(72),
    Matches(PASSWORD_REGEX, {
      message:
        'Password must contain upper and lower case letters, a number and a special character.',
    }),
  );
