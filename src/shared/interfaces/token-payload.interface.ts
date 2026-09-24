export interface ItokenPayload {
  email: string;
  phoneNumber?: string;
  role?: string;
  username?: string;
  sub?: string;
  exp?: number;
  iat?: string;
}

export type TokenDecoded = {
  email: string;
  iat: number;
  exp: number;
};
