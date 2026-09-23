import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { Model, Types } from 'mongoose';
import { DataLog, DataLogDocument } from '../schemas';
import {
  generateCode,
  getIpAddress,
  getPaginated,
  getPagingParams,
  getUserAgent,
  isMobile,
  redactRecord,
  serialize,
} from '../utils';
import * as dateFns from 'date-fns';
import {
  ApiReq,
  DataLogType,
  LogLevel,
  ReqType,
  AccessType,
} from '../interfaces';

@Injectable()
export class DataLogsService {
  constructor(
    @Inject(DataLog.name)
    private readonly dataLogModel: Model<DataLogDocument>,
  ) {}

  async findAll(req: ApiReq) {
    const { page, currentLimit, skip, order, dbQuery } = getPagingParams(req);
    const [records, count] = await Promise.all([
      this.dataLogModel
        .aggregate([{ $match: dbQuery }], { allowDiskUse: true })
        .sort({ createdAt: order })
        .allowDiskUse(true)
        .skip(skip)
        .limit(currentLimit),
      this.dataLogModel.countDocuments(dbQuery),
    ] as any);
    return getPaginated<DataLogDocument>(
      { page, count, limit: currentLimit },
      records,
    );
  }

  async remove(id: string) {
    const record = await this.dataLogModel.deleteOne({
      _id: new Types.ObjectId(id),
    });
    return record.deletedCount > 0;
  }

  async findIpDetails(ipAddress: string, project = {}) {
    return this.dataLogModel.findOne({ 'data.ipAddress': ipAddress }, project);
  }

  async findOne(query, project = {}, options = {}) {
    return this.dataLogModel.findOne(query, project, options);
  }

  async findOneAndUpdate(query, record = {}, options = {}) {
    return this.dataLogModel.findOneAndUpdate(query, { $set: record }, options);
  }

  public errorReqResLog(
    traceId: string,
    req: ApiReq,
    err: any,
    beforeTime: any,
  ) {
    if (err.response) err.response.stack = err?.stack;
    this.reqResLog(traceId, req, err.response, beforeTime, LogLevel.ERROR);
  }

  public successReqResLog(
    traceId: string,
    req: ApiReq,
    res: any,
    beforeTime: any,
  ) {
    this.reqResLog(traceId, req, res, beforeTime, LogLevel.INFO);
  }

  async publicLog(req: ApiReq, source: string) {
    if (
      ![ReqType.WEB, ReqType.MOBILE].includes(<ReqType>source.toUpperCase())
    ) {
      throw new BadRequestException(
        'Please specify MOBILE OR WEB for logSource',
      );
    }
    const data = {
      source: source.toUpperCase(),
      ...(req.query || {}),
      ...(req.body || {}),
      loggedInUser: req?.headers?.userId || {},
      logType: DataLogType.PUBLIC_APP,
    };
    return this.log(req.traceId, data, LogLevel.INFO);
  }

  async log(
    traceId: string,
    logData: any,
    level: LogLevel,
    req: ApiReq = {},
    res: any = {},
  ) {
    setImmediate(async () => {
      if (
        Object.keys(req).length > 0 &&
        req.traceId &&
        Object.keys(res).length > 0
      ) {
        if (typeof res?.data === 'object') {
          res.data = Array.isArray(res.data)
            ? res.data.push(logData)
            : { ...res.data, ...logData };
        }
        this.reqResLog(req.traceId, req, res, Date.now(), level);
      } else {
        try {
          const data = {
            response: JSON.stringify(redactRecord(logData)),
            ...redactRecord(logData || {}),
            logType: logData?.logType || DataLogType.USER,
          };
          const logMode = process.env.LOG_MODE === 'INLINE' ? undefined : 2;
          console[level.toLowerCase()](JSON.stringify(data, null, logMode));
          if (
            !process.env.LOG_TO_DATABASE ||
            process.env.LOG_TO_DATABASE === 'true' ||
            process.env.LOG_TO_DATABASE === '1'
          ) {
            await this.dataLogModel.create({
              data,
              traceId,
              level,
              logType: logData?.logType || DataLogType.USER,
            });
          }
        } catch (e) {
          console.error('LOGGER FAILURE: ', e.stack);
        }
      }
      this.removeLogsByDaysAgo(+process.env.LOG_DELETE_DAYS);
    });
    return { status: true };
  }

  async reqResLog(
    traceId: string,
    req: ApiReq,
    response: any,
    beforeTime: any,
    level: string,
  ) {
    setImmediate(async () => {
      try {
        const afterTime = Date.now();
        const { query, body, headers, protocol, originalUrl, method } = req;
        const res = response?.data
          ? JSON.parse(JSON.stringify(response?.data || response || {}))
          : {};
        const resData = { ...res, stack: response?.stack };
        const data = {
          traceId,
          beforeTime,
          afterTime,
          level,
          request: JSON.stringify(
            redactRecord({ ...(body || {}), ...(query || {}) }),
          ),
          loggedInUser: req?.headers?.userId,
          method,
          responseTime: afterTime - beforeTime,
          response: JSON.stringify(redactRecord(resData)),
          userAgent: headers['user-agent'] || 'UNKNOWN',
          userAgentDetails: getUserAgent(req),
          ipAddress: getIpAddress(req) || 'UNKNOWN',
          statusCode: response?.statusCode || response?.status || 'UNKNOWN',
          userType: originalUrl?.includes('admins/')
            ? AccessType.ADMIN
            : AccessType.USER,
          requestUrl:
            protocol + '://' + headers.host + originalUrl + serialize(query),
          logType: resData?.logType || DataLogType.SYSTEM,
          source: isMobile(req) ? ReqType.MOBILE : ReqType.WEB,
        };
        const logData = { data, traceId, level, logType: data.logType };
        const logMode = process.env.LOG_MODE === 'INLINE' ? undefined : 2;
        console[level.toLowerCase()](JSON.stringify(logData, null, logMode));
        if (
          !process.env.LOG_TO_DATABASE ||
          process.env.LOG_TO_DATABASE === 'true' ||
          process.env.LOG_TO_DATABASE === '1'
        ) {
          await this.dataLogModel.create(logData);
        }
      } catch (e) {
        console.error('LOGGER FAILURE: ', e.stack);
      }
      this.removeLogsByDaysAgo(+process.env.LOG_DELETE_DAYS);
    });
  }

  public async removeLogsByDaysAgo(days = 10) {
    try {
      const daysAgo = dateFns.subDays(new Date(), days);
      const serviceCode = generateCode(process.env.PLATFORM_STARTER_NAME);
      await this.dataLogModel.deleteMany(
        { createdAt: { $lte: daysAgo }, traceId: { $ne: serviceCode } },
        { batchSize: 50 },
      );
    } catch (e) {
      console.error('LOGGER FAILURE: ', e.stack);
    }
  }
}
