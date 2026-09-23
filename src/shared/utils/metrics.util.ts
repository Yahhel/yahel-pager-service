import { BadRequestException } from '@nestjs/common';
import * as dateFns from 'date-fns';
import { toCamelCase, addLeadingZero } from './helper.util';

export enum ByValueType {
  HOUR = 'HOUR',
  DAY = 'DAY',
  DAY_OF_WEEK = 'DAY_OF_WEEK',
  WEEK = 'WEEK',
  MONTH = 'MONTH',
}

export enum GroupBy {
  CREATED_BY = 'CREATED_BY',
  DELETED_BY = 'DELETED_BY',
  UPDATED_BY = 'UPDATED_BY',
  PRODUCT_ID = 'PRODUCT_ID',
  PRODUCT_USER = 'PRODUCT_USER',
  TRADE_PRODUCT_ID = 'TRADE_PRODUCT_ID',
  TRADE_STATE = 'TRADE_STATE',
  TRADE_CITY = 'TRADE_CITY',
  TRADE_BUYER = 'TRADE_BUYER',
  TRADE_SELLER = 'TRADE_SELLER',
  SELLER_TYPE = 'SELLER_TYPE',
}

export const byValueTypes = [...new Set(Object.values(ByValueType))];

export const groupBys = [...new Set(Object.values(GroupBy))];

export const groupByKeys = groupBys.map((a) => toCamelCase(a));

export const getMetricsGroupId = (req, dateField = 'createdAt') => {
  const {
    byValue,
    byValueType,
    metricDateRange,
    dayOfWeekWithDateRange,
    groupBy,
  } = req.query;
  const currentDate = new Date();
  const amount = -1 * +byValue;
  let startDate = null;
  let endDate = null;
  let groupId = null;
  const forHour = {
    year: { $year: `$${dateField}` },
    month: { $month: `$${dateField}` },
    day: { $dayOfMonth: `$${dateField}` },
    hour: { $hour: `$${dateField}` },
  };
  const forDay = {
    year: { $year: `$${dateField}` },
    month: { $month: `$${dateField}` },
    day: { $dayOfMonth: `$${dateField}` },
  };
  const forDayOfWeek = {
    year: { $year: `$${dateField}` },
    dayOfWeek: { $dayOfWeek: `$${dateField}` },
  };
  const forWeek = {
    year: { $year: `$${dateField}` },
    week: { $week: `$${dateField}` },
  };
  const forMonth = {
    year: { $year: `$${dateField}` },
    month: { $month: `$${dateField}` },
  };

  let groupByUniqueProjection = {};
  // let groupByUniqueAddFields: any = {};

  const addGroupBy = (groupId) => {
    if (!groupBy) return;
    const groupBys = groupBy
      .split(',')
      .filter((g) => !!g)
      .map((gp) => gp.trim());
    for (const groupBy_ of groupBys) {
      switch (groupBy_) {
        case GroupBy.CREATED_BY:
          groupId.createdBy = '$createdBy';
          break;
        case GroupBy.DELETED_BY:
          groupId.deletedBy = '$deletedBy';
          break;
        case GroupBy.UPDATED_BY:
          groupId.updatedBy = '$updatedBy';
          break;
        case GroupBy.PRODUCT_ID:
          groupId._id = '$_id';
          groupByUniqueProjection = {
            ...groupByUniqueProjection,
            productName: { $first: '$name' },
          };
          break;
        case GroupBy.PRODUCT_USER:
          groupId.user = '$user';
          groupByUniqueProjection = {
            ...groupByUniqueProjection,
            user: { $first: '$user' },
          };
          break;
        case GroupBy.TRADE_PRODUCT_ID:
          groupId.product = '$product';
          groupByUniqueProjection = {
            ...groupByUniqueProjection,
            productId: { $first: '$product' },
          };
          break;
        case GroupBy.TRADE_STATE:
          groupId.state = '$state';
          groupByUniqueProjection = {
            ...groupByUniqueProjection,
            state: { $first: '$state' },
          };
          break;
        case GroupBy.TRADE_CITY:
          groupId.city = '$city';
          groupByUniqueProjection = {
            ...groupByUniqueProjection,
            state: { $first: '$city' },
          };
          break;
        case GroupBy.TRADE_SELLER:
          groupId.seller = '$seller';
          groupByUniqueProjection = {
            ...groupByUniqueProjection,
            seller: { $first: '$seller' },
          };
          break;
        case GroupBy.TRADE_BUYER:
          groupId.buyer = '$buyer';
          groupByUniqueProjection = {
            ...groupByUniqueProjection,
            buyer: { $first: '$buyer' },
          };
          break;
        case GroupBy.SELLER_TYPE:
          groupId.type = '$type';
          groupByUniqueProjection = {
            ...groupByUniqueProjection,
            type: { $first: '$type' },
          };
          break;
      }
    }
  };

  if (byValue && byValueType) {
    switch (byValueType) {
      case ByValueType.HOUR:
        if (+byValue > 24)
          throw new BadRequestException(
            'By hour must not be more than 24 hours',
          );
        startDate = dateFns.addHours(currentDate, amount).toISOString();
        groupId = forHour;
        break;
      case ByValueType.DAY:
        if (+byValue > 31)
          throw new BadRequestException('By Day must not be more than 31 days');
        startDate = dateFns.addDays(currentDate, amount).toISOString();
        groupId = forDay;
        break;
      case ByValueType.DAY_OF_WEEK:
        if (+byValue > 366)
          throw new BadRequestException(
            'By Day of week must not be more than 366 days',
          );
        startDate = dateFns.addDays(currentDate, amount).toISOString();
        groupId = forDayOfWeek;
        break;
      case ByValueType.WEEK:
        if (+byValue > 31)
          throw new BadRequestException(
            'By Week must be not more than 31 weeks',
          );
        startDate = dateFns.addWeeks(currentDate, amount).toISOString();
        groupId = forWeek;
        break;
      case ByValueType.MONTH:
        if (+byValue > 12)
          throw new BadRequestException(
            'By Month must not be more than 12 months',
          );
        startDate = dateFns.addMonths(currentDate, amount).toISOString();
        groupId = forMonth;
        break;
    }
    endDate = new Date().toISOString();
    req.query.metricDateRange = [startDate, endDate].toString(); // append it to aid query builder.
  } else if (metricDateRange) {
    const dates = metricDateRange.split(',').map((a) => a.trim());
    const diff = dateFns.differenceInDays(
      new Date(dates[1]),
      new Date(dates[0]),
    );

    if (diff > 366)
      throw new BadRequestException(
        'Date range difference should not be more than a year',
      );
    if (diff <= 1) {
      // max of 24 hours
      groupId = forHour;
    } else if (diff <= 31) {
      // max of 31 weeks
      groupId = forDay;
    } else if (diff <= 217) {
      // max of 31 weeks
      groupId = forWeek;
    } else if (diff <= 366 && dayOfWeekWithDateRange === '1') {
      // max of 366 days
      groupId = forDayOfWeek;
    } else if (diff <= 366) {
      // max of 12 months
      groupId = forMonth;
    }
  }

  if (!groupId)
    throw new BadRequestException(
      'Metrics supplied cannot be carried out due to out of bound. ' +
        'Please use either "byValue and byValueType" or "metricDateRange" with metrics',
    );

  addGroupBy(groupId);

  return { groupId, groupByUniqueProjection };
};

export const sortMetrics = (result, sortType = 'id') => {
  if (!result) return result;

  const withId = (r) => {
    let type = ByValueType.HOUR;
    let id = '';
    if (r._id.year) id += addLeadingZero(r._id.year);
    if (r._id.month) {
      type = ByValueType.MONTH;
      id += '-' + addLeadingZero(r._id.month);
    }
    if (r._id.week) {
      type = ByValueType.WEEK;
      id += '-' + addLeadingZero(r._id.week);
    }
    if (r._id.dayOfWeek) {
      type = ByValueType.DAY_OF_WEEK;
      id += '-' + addLeadingZero(r._id.dayOfWeek);
    }
    if (r._id.day) {
      type = ByValueType.DAY;
      id += '-' + addLeadingZero(r._id.day);
    }
    if (r._id.hour) {
      type = ByValueType.HOUR;
      id += '-' + addLeadingZero(r._id.hour);
    }
    r.id = id;
    r.type = type;
    r._id = undefined;
    return r;
  };

  if (!Array.isArray(result)) {
    return withId(result);
  }

  return result
    .map((r) => withId(r))
    .sort((a, b) => {
      if (typeof a[sortType] === 'number') return b[sortType] - a[sortType];
      return a[sortType].localeCompare(b[sortType]);
    });
};
