import { Schema as MongooseSchema } from 'mongoose';
import { raw } from '@nestjs/mongoose';
import { config } from 'process';

export type ConfigurationOptionTemplate = {
  label: string;
  value: string;
};

export enum VatType {
  FIXED = 'FIXED',
  PERCENTAGE = 'PERCENTAGE',
}

export const VatTypes = Object.values(VatType);

export type ConfigurationFormTypeTemplate =
  | 'input'
  | 'select'
  | 'multi-select'
  | 'textarea';

export type ConfigurationValueTemplate =
  | string
  | number
  | string[]
  | number[]
  | object
  | object[]
  | boolean;

export type ConfigurationValueTypeTemplate =
  | 'string'
  | 'object'
  | 'boolean'
  | 'url'
  | 'email'
  | 'number'
  | 'base64'
  | 'alpha-numeric'
  | 'array-string'
  | 'array-url'
  | 'array-email'
  | 'array-alpha-numeric'
  | 'array-number'
  | 'array-base64'
  | 'array-object';

export class FieldsConfigurationTemplate {
  label: string;
  key: string;
  value: ConfigurationValueTemplate;
  required: boolean;
  valueType: ConfigurationValueTypeTemplate;
  formType: ConfigurationFormTypeTemplate;
  formOptions?: ConfigurationOptionTemplate[];
}

export const FieldsConfigTemplateRawSchema = {
  label: { type: String, default: '' },
  key: { type: String, default: '' },
  value: { type: MongooseSchema.Types.Mixed, default: null },
  valueType: { type: String, default: '' },
  formType: { type: String, default: '' },
  formOptions: [
    {
      label: { type: String, default: '' },
      key: { type: String, default: '' },
      value: { type: String, default: '' },
    },
  ],
};

export type CountryTemplateConfig = {
  countryCode: string;
  currencyCode: string;
  vat: number;
  vatType: string;
  isVatEnabled: boolean;
  isEnabled: boolean;
};

export class ConfigurationTemplate {
  countries?: {
    [key: string]: CountryTemplateConfig;
  };
}

export const CountryTemplateConfigRawSchema = {
  countries: raw({
    type: Map,
    of: {
      countryCode: { type: String, required: true },
      currencyCode: { type: String, required: true },
      vat: { type: Number, default: 0 },
      vatType: { type: String, default: VatType.FIXED, enum: VatTypes },
      isVatEnabled: { type: Boolean, default: false },
      isEnabled: { type: Boolean, default: false },
    },
  }),
};

export enum ApprovalStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
  AWAITING_APPROVAL = 'AWAITING_APPROVAL',
}

export const ApprovalStatuses = Object.values(ApprovalStatus);
