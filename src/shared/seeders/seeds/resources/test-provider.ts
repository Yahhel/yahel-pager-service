import { configs } from '../../../configs/index';

const defaultEmail = configs().mailgun.defaultEmailTo.support;
const testProviderConfig = [
  { label: 'Product/Sample Name', valueType: 'string' },
  { label: 'Quantity', valueType: 'number' },
  { label: 'Analysis Requirement', valueType: 'string' },
  { label: 'Handling Instructions', valueType: 'string' },
];

export default [
  {
    name: 'China Certification & Inspection Group (CCIC)',
    description: 'China Certification & Inspection Group (CCIC)',
    email: defaultEmail,
    testProviderConfig,
  },
  {
    name: 'Bureau Veritas (BV)',
    description: 'Bureau Veritas (BV)',
    email: 'aqacsales@bureauveritas.com',
    testProviderConfig,
  },
  {
    name: 'Societe Generale de Surveillance (SGS)',
    description: 'Societe Generale de Surveillance (SGS)',
    email: 'adeyinka.adebayo@sgs.com',
    testProviderConfig,
  },
  {
    name: 'AA Testing Providers (STP)',
    description: 'AA Testing Providers',
    email: defaultEmail,
    testProviderConfig,
  },
  {
    name: 'Cotecna',
    description: 'Cotecna',
    email: 'tunji.adewuyi@cotecna.-nigeria.com',
    testProviderConfig,
  },
  {
    name: 'CCBC',
    description: 'CCBC TESTING LABORATORY',
    email: 'sales1@ccbclab.com',
    testProviderConfig,
  },
  {
    name: 'EYE VIEW',
    description: 'EYE VIEW INSPECTION LTD',
    email: 'eyeviewinspectionltd2007@gmail.com',
    testProviderConfig,
  },
];
