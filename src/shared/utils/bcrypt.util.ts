import * as bcrypt from 'bcryptjs';

export class BcryptUtil {
  static async generateHash(value: string) {
    return bcrypt.hash(value, 12);
  }

  static async verify(value: string, hash?: string) {
    if (!value || !hash) return false;
    return bcrypt.compare(value, hash);
  }
}
