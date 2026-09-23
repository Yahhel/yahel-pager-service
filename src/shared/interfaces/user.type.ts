
import { ApprovalStatus } from './config.type';
import {
  City,
  cityRaw,
  Country,
  countryRaw,
  State,
  stateRaw,
} from './country.type';

export enum RoleType {
  TRACE_SELLER = 'TRACE_SELLER',
  TRACE_BUYER = 'TRACE_BUYER',
  TRACE_ADMIN = 'TRACE_ADMIN',
  FARMER = 'FARMER',
}

export enum Gender {
  MALE = 'MALE',
  FEMALE = 'FEMALE',
}

export type LocationDetail = {
  type: string;
  coordinates: number[][][];
};

export const LocationDetailRaw = {
  type: { type: String, enum: ['Polygon'], required: true },
  coordinates: { type: [[Number]], required: true },
};

export const RoleTypes = [...new Set(Object.values(RoleType))];

export const Genders = [...new Set(Object.values(Gender))];

export type ValidateUserDetailsResponse = {
  _id: string;
  firstName: string;
  lastName: string;
  phone: string;
  username: string;
  business?: {
    _id: string;
    name: string;
    phone: string;
    email: string;
    type: string;
  };
};
