import { BadRequestException } from '@nestjs/common';
import { Model } from 'mongoose';
import * as dateFns from 'date-fns';
import { faker } from '@faker-js/faker';
import { UAParser } from 'ua-parser-js';
import {
  Country,
  ICountry,
  State,
  IState,
  City,
  ICity,
} from 'country-state-city';
import * as jszip from 'jszip';

import {
  ApiReq,
  LogLevel,
  Country as CountryType,
  State as StateType,
  City as CityType,
} from '../interfaces';
import { redisSet } from './redis.util';
import { phone } from 'phone';
import { CountryConstants } from '@shared/configs/countries.constant';

export const specialCharRegex = /[^a-zA-Z0-9\\s]/g;

export const getDateRangeQuery = (
  value: string[],
  useOnlyCreatedAt = false,
) => {
  const startDate = dateFns.startOfDay(new Date(value[0]));
  const endDate = dateFns.endOfDay(new Date(value[1]));
  if (
    value.length === 2 &&
    startDate.toISOString().localeCompare(endDate.toISOString()) === -1
  ) {
    const dateQuery = { $gte: startDate, $lte: endDate };
    if (useOnlyCreatedAt) {
      return [{ createdAt: dateQuery }];
    }
    return [{ createdAt: dateQuery }, { updatedAt: dateQuery }];
  } else {
    throw new BadRequestException(
      'The first date must be lower than the second date.',
    );
  }
};

export const getApiKey = async (code, type) => {
  const apiKey = faker.string.uuid();
  await redisSet(`${type}:${apiKey}`, {
    code,
  });
  return apiKey;
};

export const firstCapitalize = (value: string): string =>
  value[0].toUpperCase() + value.substring(1).toLowerCase();

export const firstWordCapitalize = (sentence: string): string =>
  sentence
    .split(/[\s_-]/g)
    .filter((a) => !!a)
    .map(firstCapitalize)
    .join(' ');

export const promisifySilent = async (action: Promise<any>, key = null) => {
  try {
    return await action;
  } catch (e) {
    global.dataLogsService.log(
      global.req?.traceId,
      { source: 'promisifySilent', key, message: e.message, stack: e.stack },
      LogLevel.ERROR,
    );
    return null;
  }
};

export const getIpAddress = (req) => {
  return (
    req.headers['x-forwarded-for'] ||
    req.connection.remoteAddress ||
    req.headers.ipAddress
  );
};

// Validate if an id is in an array of mongoDB document
export const hasMatchingId = (array: any[], idToCheck: string) =>
  array?.some((obj) => obj?._id === idToCheck);

export const slug = (val: string) =>
  val.toLowerCase().replace(/[^a-zA-Z0-9]/g, '_');

export const serialize = (obj: object) => {
  const keys = Object.keys(obj);
  if (!keys.length) {
    return '';
  }
  return (
    '?' +
    keys
      .reduce((a, k) => {
        if (obj[k] === null || obj[k] === undefined) return a;

        a.push(k + '=' + encodeURIComponent(obj[k]));

        return a;
      }, [])
      .join('&')
  );
};

export const getBaseUrlWithPath = (req, path) => {
  const protocol = req.get('x-scheme') || req.protocol;
  const host = req.get('x-host') || req.get('host');
  return `${protocol}://${host}/${path}`;
};

export const generateCode = (name: string) =>
  `${name.replace(specialCharRegex, '_')}`.toLowerCase();

export const sleep = (ms: number, data: any = null) =>
  new Promise((resolve) => setTimeout(() => resolve(data), ms));

export const getUserAgent = (req: ApiReq) => {
  const uaParser = new UAParser();
  const uAgent = req.headers['user-agent'] || '';
  return uaParser.setUA(uAgent).getResult();
};

export const removeTrailingSlash = (url: string): string => {
  return url.endsWith('/') ? url.slice(0, -1) : url;
};

export const isMobile = (req: ApiReq) => {
  const ua = (req.headers['user-agent'] || '').toLowerCase();
  const mobileOs =
    /mobile|ios|android|webos|iphone|ipad|ipod|blackberry|(android|bb\d+|meego).+mobile|avantgo|bada\/|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows (ce|phone)|xda|xiino/gi;
  const uaResult = getUserAgent(req);
  return (
    !!uaResult?.device?.type ||
    mobileOs.test(uaResult?.os?.name) ||
    mobileOs.test(ua) ||
    ua.includes('registry')
  );
};

export const toCamelCase = (
  word: string,
  replaceFrom = '',
  replaceTo = '',
): string => {
  const w = word
    .split(/[\s_-]/g)
    .filter((a) => !!a)
    .map((a) =>
      firstCapitalize(
        a
          .toLowerCase()
          .replace(
            new RegExp(replaceFrom.toLowerCase(), 'g'),
            replaceTo.toLowerCase(),
          ),
      ),
    )
    .join('');
  return w.substring(0, 1).toLowerCase() + w.substring(1);
};

export const removeDuplicateKeys = (arr: any[], key: string) => {
  return [...new Map(arr.map((item) => [item[key], item])).values()];
};

export const passwordMatch = (password: string) => {
  const regex = /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[^A-Za-z\d]).{6,}$/g;
  const isMatcher = password.match(regex);
  if (isMatcher === null)
    throw new BadRequestException(
      'Password must contain a number, special character, alphabet both upper and lower cased, and must be at least of 6 letters.',
    );
  return true;
};

export const validateNumber = (number: string) => {
  if (!number) return true;
  const matcher = number.match(/(([+]){1})?([0-9]){1,14}/g);
  if (!(matcher !== null && matcher[0] === number)) {
    throw new BadRequestException("Phone Number supplied isn't valid.");
  }
  return true;
};

export const validatePhoneNumber = (number: string) => {
  if (!number) return true;
  const matcher = number.match(/(([+]){1})?([0-9]){4,14}/g);
  if (!(matcher !== null && matcher[0] === number)) {
    throw new BadRequestException("Phone Number supplied isn't valid.");
  }
  return true;
};

export const validatePhoneNumberByCountry = (
  number: string,
  countryCode: string,
) => {
  const result = phone(number, { country: countryCode });
  if (!result.isValid)
    throw new BadRequestException("Phone Number supplied isn't valid.");
  return result.phoneNumber.replace('+', '');
};

export const validateDob = (dob: string) => {
  if (!dob) return true;
  const diff = dateFns.differenceInYears(new Date(), new Date(dob));
  if (diff < 16) throw new BadRequestException('Minimum DOB allowed is 16.');
  return true;
};

type field = {
  [key: string]: any;
};

export const checkUnique = async (model: Model<any>, fields: field = {}) => {
  const fieldsArr = [];
  const fieldMapper = Object.keys(fields).map((key) => {
    fieldsArr.push(`${[key]}: ${fields[key]}`);
    return {
      [key]: fields[key],
    };
  });
  const res = await model.findOne({ $or: fieldMapper });
  if (res !== null)
    throw new BadRequestException(
      `This record already exists for "${fieldsArr}"`,
    );
};

// Returns full url along with the url without params
export const getURLInfo = (originalUrl: string) => {
  const position = originalUrl.lastIndexOf('?');
  let pathUrl = originalUrl;
  if (position > -1) {
    pathUrl = originalUrl.substring(0, position);
  }

  const len = pathUrl.length - 1;
  pathUrl = pathUrl[len] === '/' ? pathUrl.substring(0, len) : pathUrl;
  return { pathUrl, originalUrl };
};

export const validateCountry = (countryData: CountryType) => {
  if (!countryData) throw new BadRequestException('Country is required!');

  const country: ICountry = Country.getCountryByCode(countryData?.code);
  if (!country) throw new BadRequestException('Invalid country code!');

  if (country.name?.toLowerCase() !== countryData.name?.toLowerCase())
    throw new BadRequestException('Invalid country name!');

  if (country.currency?.toUpperCase() !== countryData.currency?.toUpperCase())
    throw new BadRequestException('Invalid currency code!');

  return true;
};

export const validateState = (countryCode: string, stateData: StateType) => {
  if (!stateData) throw new BadRequestException('State is required!');

  const state: IState = State.getStateByCodeAndCountry(
    stateData?.code,
    countryCode,
  );
  if (!state) throw new BadRequestException('Invalid state code!');

  if (state.name?.toLowerCase() !== stateData.name?.toLowerCase())
    throw new BadRequestException('Invalid state code or name!');

  return true;
};

export const getCityOfStateAndCountry = (
  countryCode: string,
  stateCode: string,
): ICity[] => {
  const key = `${countryCode}_${stateCode}`.toUpperCase();
  if (CountryConstants[key]) return CountryConstants[key];
  return City.getCitiesOfState(countryCode, stateCode).map((a) => ({
    ...a,
    name: a.name.replace(/[\s]/g, '-'),
  }));
};

export const validateCity = (
  countryCode: string,
  stateCode: string,
  cityData: CityType,
) => {
  if (!cityData) return true;
  const cities: ICity[] = getCityOfStateAndCountry(countryCode, stateCode);
  const city = cities.find((c) => c.name === cityData?.name);
  if (!city) throw new BadRequestException('Invalid city provided!');

  return true;
};

export const addTenantQuery = (req: ApiReq, queryField: string) => {
  if (req.query?.tenantId && req.query?.[queryField])
    req.query[queryField] += ',' + req.query.tenantId;

  if (req.query?.tenantId && !req.query?.[queryField])
    req.query[queryField] = req.query.tenantId;
};

// Helper function to generate random numbers
export function getRandomNumbers(length) {
  let result = '';
  for (let i = 0; i < length; i++) {
    result += Math.floor(Math.random() * 10);
  }
  return result;
}

export const generateOrderNumber = () => {
  // Helper function to generate random letters
  function getRandomLetters(length) {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += letters.charAt(Math.floor(Math.random() * letters.length));
    }
    return result;
  }

  // Get current date in MMYY format
  const today = new Date();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const year = String(today.getFullYear()).slice(-2);

  // Generate the order number components
  const randomLetters1 = getRandomLetters(2);
  const randomNumbers = getRandomNumbers(4);
  const randomLetters2 = getRandomLetters(2);
  const datePart = `${month}${year}`;

  // Concatenate all components to create the order number
  return `${randomLetters1}${randomNumbers}${randomLetters2}${datePart}`;
};

export const addLeadingZero = (value) => {
  const v = String(value);
  return v.length > 1 ? v : `0${v}`;
};

export const generateTransactionReference = () => {
  const uuid = faker.string.uuid();
  return `DFS-TRC-${uuid}`;
};

export const zipFile = async (files: { fileName: string; file: any }[]) => {
  const zip = new jszip();

  await Promise.all(
    files.map((file) => {
      zip.file(file.fileName, file.file);
    }),
  );

  return await zip.generateAsync({ type: 'nodebuffer' });
};


export const arrayIntersection = (arr1: any[], arr2: any[]): any[] => {
  return arr1.filter((value) => arr2.includes(value));
};


export const regexEscape = (str: string) => {
  str = str.replace(/[-\/\\^$*+?.()%|[\]{}]/g, '\\$&');
  return new RegExp(str);
};

export const stripEmptyFields = (obj: any) => {
  if (Array.isArray(obj)) {
    return obj.map((item) => stripEmptyFields(item));
  } else if (obj !== null && typeof obj === 'object') {
    return Object.keys(obj).reduce((acc, key) => {
      const value = obj[key];

      if (![null, undefined].includes(value)) {
        if (typeof value === 'object') {
          acc[key] = stripEmptyFields(value);
        } else {
          acc[key] = value;
        }
      }

      return acc;
    }, {});
  }

  return obj;
};

export const isTestEnv = () =>
  ['stage', 'development', 'local'].includes(
    process.env.NODE_ENV?.trim()?.toLowerCase(),
  );
