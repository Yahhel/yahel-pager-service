import { Inject, Injectable } from '@nestjs/common';
import { Types } from 'mongoose';

import { User, UserModel } from '@shared/schemas';

import { CreateAuditLogDto } from './dto/create-auditlog.dto';
import {
  getPagingParams,
  getPaginated,
  redactRecord,
  isValidObjectId,
} from '@shared/utils';
import { ApiReq, LogLevel } from '@shared/interfaces';
import {
  AuditLog,
  AuditLogDocument,
  AuditLogModel,
} from '@shared/schemas/audit.log.schema';

@Injectable()
export class AuditLogService {
  constructor(
    @Inject(AuditLog.name)
    private readonly auditLogModel: AuditLogModel,
    @Inject(User.name)
    private readonly userModel: UserModel,
  ) {}

  async create(payload: CreateAuditLogDto) {
    const source = 'createLog';
    try {
      await this.auditLogModel.create({
        ...payload,
        requestData: JSON.stringify(redactRecord(payload.requestData) || {}),
        responseData: JSON.stringify(redactRecord(payload.responseData) || {}),
      });
    } catch (error) {
      global.dataLogsService.log(
        source,
        { source, stack: error.stack, message: error.message, payload },
        LogLevel.ERROR,
      );
    }
    return {
      message: 'Audit logs added successfully',
      action: payload.action,
      serviceName: payload.serviceName,
    };
  }

  async findAll({ req }: { req: ApiReq }) {
    const { page, currentLimit, skip, order, dbQuery } = getPagingParams(req);

    const [records, count] = await Promise.all([
      this.auditLogModel
        .find(dbQuery, {}, { lean: true })
        .sort({ createdAt: order })
        .skip(skip)
        .limit(currentLimit),
      this.auditLogModel.countDocuments(dbQuery),
    ] as any);

    return getPaginated<AuditLogDocument>(
      { page, count, limit: currentLimit },
      await this.processAuditLogMapping(records),
    );
  }

  private async processAuditLogMapping(records: AuditLogDocument[]) {
    if (!records.length) {
      return records;
    }

    const formatLogData = (a: any) => {
      a.requestData = JSON.parse(a.requestData || '{}');
      a.responseData = JSON.parse(a.responseData || '{}');
      return a;
    };

    const userIds = [
      ...new Set(
        records
          .map((a) => a.actionBy)
          .filter((id) => id && isValidObjectId(id)),
      ),
    ];

    if (!userIds.length) {
      return records.map((a) => formatLogData(a));
    }

    const users = await this.userModel
      .find(
        { _id: { $in: userIds.map((id) => new Types.ObjectId(id)) } },
        { firstName: 1, lastName: 1, email: 1, roles: 1 },
      )
      .lean();

    const mappedUsers = users.reduce((result, user) => {
      result[user._id.toString()] = user;
      return result;
    }, {});

    return records.map((a: any) => {
      const user = mappedUsers[a.actionBy];
      if (user) {
        a.actionByUser = user;
      }
      return formatLogData(a);
    });
  }
}
