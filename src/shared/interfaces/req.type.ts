import { Request } from 'express';

type customReq = {
  traceId: string;
  userIpAddress: string;
};

export type ReqHeaders = {
  tenantId: string;
  userId: string;
  countryCode?: string;
} & any;

export type ApiReq = Request & customReq & any;

export enum ReqType {
  MOBILE = 'MOBILE',
  WEB = 'WEB',
}
