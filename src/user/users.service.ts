import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { randomUUID } from 'crypto';
import { User, UserModel } from '@shared/schemas';
import {
  ApiReq,
  EmailFrom,
  RoleType,
  USER_BASIC_FIELDS,
  UserStatus,
} from '@shared/interfaces';
import {
  accessLogoutAll,
  getPaginated,
  getPagingParams,
  isValidObjectId,
  stripEmptyFields,
} from '@shared/utils';
import { getMailTemplate, sendMail } from '@shared/utils/mailtrap.util';
import { UserUpdateDto } from './dto/user-update.dto';
import { InviteUserDto } from './dto/invite-user.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';

const ADMIN_INVITATION_EXPIRE_SECONDS = 48 * 3600;

@Injectable()
export class UserService {
  constructor(
    @Inject(User.name)
    private userModel: UserModel,
  ) {}

  async updateUser(req: ApiReq, payload: UserUpdateDto) {
    const updatedUser = await this.userModel.findOneAndUpdate(
      { _id: new Types.ObjectId(req.user._id) },
      {
        $set: stripEmptyFields({
          firstName: payload.firstName,
          lastName: payload.lastName,
          phone: payload.phone,
        }),
      },
      { new: true, lean: true, projection: USER_BASIC_FIELDS },
    );

    if (!updatedUser) {
      throw new NotFoundException('User not found');
    }

    return updatedUser;
  }

  async becomeSeller(req: ApiReq) {
    const updatedUser = await this.userModel.findOneAndUpdate(
      { _id: new Types.ObjectId(req.user._id), emailVerification: true },
      { $addToSet: { roles: RoleType.SELLER } },
      { new: true, lean: true, projection: USER_BASIC_FIELDS },
    );

    if (!updatedUser) {
      throw new BadRequestException(
        'Verify your email before becoming a seller',
      );
    }

    return updatedUser;
  }

  async findAll(req: ApiReq) {
    const { page, currentLimit, skip, order, dbQuery } = getPagingParams(req);

    const [records, count] = await Promise.all([
      this.userModel
        .find(dbQuery, USER_BASIC_FIELDS, { lean: true })
        .sort({ createdAt: order })
        .skip(skip)
        .limit(currentLimit),
      this.userModel.countDocuments(dbQuery),
    ] as any);

    return getPaginated({ page, count, limit: currentLimit }, records);
  }

  async findOne(userId: string) {
    if (!isValidObjectId(userId)) {
      throw new BadRequestException('Invalid identification provisioned.');
    }

    const user = await this.userModel
      .findById(userId, USER_BASIC_FIELDS)
      .lean();

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async updateStatus(
    req: ApiReq,
    userId: string,
    payload: UpdateUserStatusDto,
  ) {
    if (!isValidObjectId(userId)) {
      throw new BadRequestException('Invalid identification provisioned.');
    }
    if (userId === req.user._id?.toString()) {
      throw new BadRequestException('You cannot change your own status');
    }

    const updatedUser = await this.userModel.findOneAndUpdate(
      { _id: new Types.ObjectId(userId) },
      { $set: { status: payload.status } },
      { new: true, lean: true, projection: USER_BASIC_FIELDS },
    );

    if (!updatedUser) {
      throw new NotFoundException('User not found');
    }

    if (payload.status !== UserStatus.ACTIVE) {
      await accessLogoutAll(userId);
    }

    return updatedUser;
  }

  async inviteUser(req: ApiReq, inviteUserDto: InviteUserDto) {
    // The random password is never shared; the invitee sets their own with the emailed code
    const user = await this.userModel.createUser({
      ...inviteUserDto,
      password: randomUUID(),
      roles: [RoleType.ADMIN],
    });

    const token = await this.userModel.generateAuthCode(
      'forgot_password',
      user._id.toString(),
      ADMIN_INVITATION_EXPIRE_SECONDS,
    );

    sendMail({
      to: user.email,
      from: EmailFrom.HELLO,
      subject: "You've been invited as a Yahhel admin",
      template: getMailTemplate().adminInvitation,
      templateVariables: {
        token,
        firstName: user.firstName,
        email: user.email,
      },
    });

    return { message: 'Invitation sent successfully.' };
  }
}
