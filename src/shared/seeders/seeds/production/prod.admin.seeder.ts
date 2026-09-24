import { Inject, Injectable } from '@nestjs/common';
import { configs } from '../../../configs';
import { PasswordResetStatus, RoleType } from '../../../interfaces';
import { User, UserModel } from '../../../schemas';
import { BcryptUtil } from '../../../utils';
import { Seeder } from '../Seeder';

@Injectable()
export class ProdAdminSeeder implements Seeder {
  constructor(
    @Inject(User.name)
    private readonly userModel: UserModel,
  ) {}

  async seed() {
    const { email, password, firstName, lastName } = configs().seedAdmin;
    if (!email || !password) {
      console.log('ProdAdminSeeder skipped: SEED_ADMIN_EMAIL/PASSWORD not set');
      return;
    }

    const exists = await this.userModel.exists({ roles: RoleType.ADMIN });
    if (exists) return;

    // Forced password change and 2FA setup happen on first login
    await this.userModel.create({
      firstName,
      lastName,
      email: email.trim().toLowerCase(),
      password: await BcryptUtil.generateHash(password),
      roles: [RoleType.ADMIN],
      emailVerification: true,
      passwordResetStatus: PasswordResetStatus.REQUIRED,
    });
  }

  async drop() {
    return null;
  }
}
