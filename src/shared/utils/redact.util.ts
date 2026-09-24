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
  'oldPassword',
  'newPassword',
  'accessToken',
  'refreshToken',
  'tempToken',
  'token',
  'twoFactorToken',
  'twoFactorSecret',
  'backupCodes',
  'secret',
  'manualEntryKey',
  'qrCodeUrl',
]);

export const redactRecord = (data) => {
  const redactObj = (obj) => {
    if (obj === null || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map((r) => redactObj(r));
    Object.keys(obj).forEach((key) => {
      obj[key] = redactedKeys.has(key) ? redactStr : redactObj(obj[key]);
    });
    return obj;
  };
  try {
    return redactObj(JSON.parse(JSON.stringify(data)));
  } catch (e) {
    return data;
  }
};
