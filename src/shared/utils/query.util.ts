import { Types } from 'mongoose';
import { getDateRangeQuery, regexEscape } from './helper.util';

export const buildQuery = (
  query: any,
  defaultQuery: any = null,
  locationQuery = null,
): any => {
  const filters: Array<any> = [];

  const regexSearches = (searchFields, value) => {
    return searchFields
      .map(({ key, type }) =>
        value.map((s) => {
          const numb = parseFloat(s);
          const numSearch: any = { [key]: numb ? numb : -0.0001 };
          const strSearch = {
            [key]: {
              $regex: regexEscape(decodeURIComponent(s)),
              $options: 'i',
            },
          };
          return type === 'number' ? numSearch : strSearch;
        }),
      )
      .flat(Infinity);
  };

  const getInQuery = (value) => ({
    $in: value.map((v) => new Types.ObjectId(v)),
  });

  const getNotInQuery = (value) => ({
    $nin: value.map((v) => new Types.ObjectId(v)),
  });

  for (const key in query) {
    let searchFields = [];
    // Express 5 query objects have a null prototype
    if (!Object.prototype.hasOwnProperty.call(query, key)) continue;

    const v = decodeURIComponent(query[key] || '');
    if (!v) continue;

    const value: any[] = v
      .split(/[,\s]/g)
      .filter((s: string) => !!s)
      .map((s: string) => s.trim());

    if (!value || !value.length) continue;

    switch (key) {
      /** All Product Queries */
      case 'productIds':
        filters.push({
          _id: getInQuery(value),
        });
        break;
      case 'productByProductTypeIds':
        filters.push({
          productType: getInQuery(value),
        });
        break;
      case 'productByDeleted':
        filters.push({ deleted: value[0] === '1' });
        break;
      case 'productActive':
        filters.push({ active: '1' === value[0] || 'true' === value[0] });
        break;
      case 'productByStatus':
        filters.push({ status: { $in: value } });
        break;
      case 'productQuantity':
        filters.push({ quantity: { $gte: +value[0] } });
        break;
      case 'productLowStock':
        filters.push({ quantity: { $lte: +value[0] } });
        break;
      case 'productSearch':
        searchFields = [
          { key: 'name' },
          { key: 'city' },
          { key: 'state' },
          { key: 'quantity', type: 'number' },
          { key: 'sellingPrice', type: 'number' },
          { key: 'description' },
        ];
        filters.push({ $or: regexSearches(searchFields, value) });
        break;

      /** All Logs Queries */
      case 'logSearch':
        searchFields = [
          { key: 'data.requestUrl' },
          { key: 'data.response' },
          { key: 'data.request' },
        ];
        filters.push({ $or: regexSearches(searchFields, value) });
        break;
      case 'logTraceIds':
        filters.push({ traceId: { $in: value } });
        break;
      case 'logLevels':
        filters.push({ level: { $in: value } });
        break;
      case 'logTypes':
        filters.push({ 'data.logType': { $in: value } });
        break;
      case 'logStatusCodes':
        filters.push({ 'data.statusCode': { $in: value.map((v) => +v) } });
        break;
      case 'logApiMethods':
        filters.push({ 'data.method': { $in: value } });
        break;
      case 'logIpAddresses':
        filters.push({ 'data.ipAddress': { $in: value } });
        break;

      /** All User Queries */
      case 'userByIds':
        filters.push({
          _id: getInQuery(value),
        });
        break;
      case 'userByRoles':
        filters.push({ roles: { $in: value } });
        break;
      case 'userByStatuses':
        filters.push({ status: { $in: value } });
        break;
      case 'userByEmailVerified':
        filters.push({
          emailVerification: '1' === value[0] || 'true' === value[0],
        });
        break;
      case 'userSearch':
        searchFields = [
          { key: 'firstName' },
          { key: 'lastName' },
          { key: 'email' },
          { key: 'phone' },
        ];
        filters.push({ $or: regexSearches(searchFields, value) });
        break;

      /** Audit Logs Queries */
      case 'auditLogSearch':
        searchFields = [
          { key: 'actionBy' },
          { key: 'actionType' },
          { key: 'serviceName' },
          { key: 'action' },
          { key: 'requestUrl' },
          { key: 'requestMethod' },
          { key: 'requestActionBy' },
          { key: 'requestModelType' },
          { key: 'requestReference' },
          { key: 'ipAddress' },
          { key: 'description' },
        ];
        filters.push({ $or: regexSearches(searchFields, value) });
        break;
      case 'auditLogByRequestActionBy':
        searchFields = [{ key: 'requestActionBy' }];
        filters.push({ $or: regexSearches(searchFields, value) });
        break;
      case 'auditLogByUserActionBy':
        searchFields = [{ key: 'actionBy' }];
        filters.push({ $or: regexSearches(searchFields, value) });
        break;
      case 'auditLogByRequestMethod':
        filters.push({ requestMethod: { $in: value } });
        break;
      case 'auditLogByModelType':
        searchFields = [{ key: 'requestModelType' }];
        filters.push({ $or: regexSearches(searchFields, value) });
        break;
      case 'auditLogByRequestReferences':
        filters.push({ requestReference: { $in: value } });
        break;
      case 'auditLogByIds':
        filters.push({ _id: getInQuery(value) });
        break;
      case 'auditLogBySuccess':
        filters.push({
          actionSuccessful: { $in: value.map((v) => v === 'true') },
        });
        break;
      case 'auditLogByServiceNames':
        searchFields = [{ key: 'serviceName' }];
        filters.push({ $or: regexSearches(searchFields, value) });
        break;

      /** All Date range use case Queries for all schema models */
      case 'dateRange':
      case 'metricDateRange':
      case 'productDateRange':
      case 'dataLogDateRange':
      case 'userDateRange':
      case 'auditLogDateRange':
        filters.push({
          $or: getDateRangeQuery(value, true),
        });
        break;
    }
  }

  // Attach default query to filter
  if (defaultQuery) {
    filters.unshift(defaultQuery);
  }

  // No location at this stage of filter query
  const dbQueryNoLocation = filters.length ? { $and: [...filters] } : {};

  // Attach location query to filter
  if (locationQuery) {
    filters.unshift(locationQuery);
  }

  const dbQuery = filters.length ? { $and: filters } : {};

  return { dbQuery, dbQueryNoLocation };
};
