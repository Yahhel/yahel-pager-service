import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ApiReq } from '../interfaces';
import { AuditLog, AuditLogModel } from '../schemas';
import { getPaginated, getPagingParams } from '../utils';

@Injectable()
export class AuditLogsService {
  constructor(
    @Inject(AuditLog.name)
    private readonly auditLogModel: AuditLogModel,
  ) {}

  async findAll(req: ApiReq) {
    const { page, currentLimit, skip, order, dbQuery } = getPagingParams(req);
    const [records, count] = await Promise.all([
      this.auditLogModel
        .find(dbQuery)
        .sort({ createdAt: order })
        .skip(skip)
        .limit(currentLimit)
        .lean(),
      this.auditLogModel.countDocuments(dbQuery),
    ]);
    return getPaginated({ page, count, limit: currentLimit }, records);
  }

  async findOne(auditLogId: string) {
    const auditLog = await this.auditLogModel.findById(auditLogId).lean();
    if (!auditLog) throw new NotFoundException('Audit log not found');
    return auditLog;
  }
}
