const redactStr = '__REDACTED__';

const redactedKeys = new Set([
  'name',
  'logo',
  'description',
  'website',
  'phone',
  'address',
  'postalCode',
  'socialUsername',
  'firstName',
  'lastName',
  'username',
  'beneficiaryAccountNo',
  'beneficiaryName',
  'password',
  'accessToken',
]);

export const redactRecord = (data) => {
  const redactObj = (obj) => {
    if (typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) {
      obj = obj.map((r) => redactObj(r));
    } else {
      Object.keys(obj).forEach((key) => {
        if (Array.isArray(obj[key])) {
          obj[key] = obj[key].map((r) => redactObj(r));
        }
        if (redactedKeys.has(key)) {
          obj[key] = redactStr;
        }
      });
    }
    return obj;
  };
  try {
    return redactObj(JSON.parse(JSON.stringify(data)));
  } catch (e) {
    return data;
  }
};
