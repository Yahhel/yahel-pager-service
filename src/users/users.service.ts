import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuthStoreService } from '@shared/auth';
import { configs } from '@shared/configs';
import {
  ApiReq,
  AuthCodePurpose,
  AuthUser,
  EmailFrom,
  USER_PUBLIC_FIELDS,
  UserRole,
  UserStatus,
} from '@shared/interfaces';
import { User, UserModel } from '@shared/schemas';
import {
  BcryptUtil,
  generateOtpCode,
  getMailTemplate,
  getPaginated,
  getPagingParams,
  isDuplicateKeyError,
  randomToken,
  sendMail,
  stripEmptyFields,
} from '@shared/utils';
import { InviteAdminDto, UpdateProfileDto, UpdateUserStatusDto } from './dto';

const publicProjection = USER_PUBLIC_FIELDS.split(' ').reduce(
  (acc, field) => ({ ...acc, [field]: 1 }),
  {} as Record<string, 1>,
);

@Injectable()
export class UsersService {
  constructor(
    @Inject(User.name)
    private readonly userModel: UserModel,
    private readonly authStore: AuthStoreService,
  ) {}

  async updateProfile(authUser: AuthUser, dto: UpdateProfileDto) {
    const user = await this.userModel.findOneAndUpdate(
      { _id: authUser._id },
      {
        $set: stripEmptyFields({
          firstName: dto.firstName,
          lastName: dto.lastName,
          phone: dto.phone,
        }),
      },
      { new: true, lean: true, projection: publicProjection },
    );
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async becomeSeller(authUser: AuthUser) {
    if (authUser.roles.includes(UserRole.SELLER))
      throw new BadRequestException('You are already a seller');

    const user = await this.userModel.findOneAndUpdate(
      { _id: authUser._id, emailVerified: true },
      { $addToSet: { roles: UserRole.SELLER } },
      { new: true, lean: true, projection: publicProjection },
    );
    if (!user)
      throw new BadRequestException(
        'Verify your email before becoming a seller',
      );

    await this.authStore.syncUserRoles(authUser._id, user.roles);
    return user;
  }

  async findAll(req: ApiReq) {
    const { page, currentLimit, skip, order, dbQuery } = getPagingParams(req);
    const [records, count] = await Promise.all([
      this.userModel
        .find(dbQuery, publicProjection)
        .sort({ createdAt: order })
        .skip(skip)
        .limit(currentLimit)
        .lean(),
      this.userModel.countDocuments(dbQuery),
    ]);
    return getPaginated({ page, count, limit: currentLimit }, records);
  }

  async findOne(userId: string) {
    const user = await this.userModel.findById(userId, publicProjection).lean();
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async updateStatus(
    authUser: AuthUser,
    userId: string,
    { status }: UpdateUserStatusDto,
  ) {
    if (userId === authUser._id)
      throw new BadRequestException('You cannot change your own status');

    const user = await this.userModel.findOneAndUpdate(
      { _id: userId },
      { status },
      { new: true, lean: true, projection: publicProjection },
    );
    if (!user) throw new NotFoundException('User not found');

    if (status === UserStatus.DISABLED)
      await this.authStore.revokeUserSessions(userId);
    return user;
  }

  async inviteAdmin(dto: InviteAdminDto) {
    this.authStore.assertAvailable();
    let user;
    try {
      // The random password is never shared; the invitee sets their own via the emailed code
      user = await this.userModel.create({
        ...dto,
        password: await BcryptUtil.generateHash(randomToken()),
        roles: [UserRole.ADMIN],
      });
    } catch (e) {
      if (isDuplicateKeyError(e))
        throw new ConflictException('A user with this email already exists');
      throw e;
    }

    const code = generateOtpCode();
    await this.authStore.setCode(
      AuthCodePurpose.PASSWORD_RESET,
      user._id.toString(),
      code,
      configs().auth.adminInviteTtlSeconds,
    );
    sendMail({
      to: user.email,
      from: EmailFrom.HELLO,
      subject: "You've been invited as a Yahhel admin",
      template: getMailTemplate().adminInvite,
      templateVariables: { firstName: user.firstName, email: user.email, code },
    });

    return this.findOne(user._id.toString());
  }
}
