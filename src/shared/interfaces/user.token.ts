import { User } from '@shared/schemas';
import { ReqType } from './req.type';

export interface UserTokenData {
  refreshToken: string;
  accessToken: string;
  revokeToken: string;
  tokenType: ReqType;
  user: User & any;
}

export interface UserToken {
  accessToken: string;
  refreshToken: string;
}
