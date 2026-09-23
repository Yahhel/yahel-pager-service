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
    if (!query.hasOwnProperty(key)) continue;

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
      case 'excludeAAProducts': {
        if (value[0] === '1') {
          filters.push({
            user: { $nin: process.env.AA_TRADE_AGENT_ACCOUNT_ID },
          });
        }
        break;
      }
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

      /** All Date range use case Queries for all schema models */
      case 'dateRange':
      case 'metricDateRange':
      case 'productDateRange':
      case 'dataLogDateRange':
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
