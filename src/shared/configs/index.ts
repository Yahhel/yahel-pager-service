export const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret)
    throw new Error('JWT_SECRET is not set. Add it to your .env file.');
  return secret;
};

export const configs = () => ({
  cloudinary: {
    cloud_name: process.env.CLOUDINARY_NAME,
    api_key: process.env.CLOUDINARY_KEY,
    api_secret: process.env.CLOUDINARY_SECRET,
  },
  dbConfig: {
    autoIndex: false,
    readPreference: 'secondaryPreferred',
    maxPoolSize: 25,
    minPoolSize: 2,
    socketTimeoutMS: 30000, // Set the timeout for idle connections
    maxIdleTimeMS: 60000,
  },
  redisConfig: {
    socket: {
      tls: process.env.REDIS_TLS
        ? process.env.REDIS_TLS === 'true'
        : ['production', 'stage', 'development'].includes(
            process.env.NODE_ENV.toLowerCase().trim(),
          ),
      rejectUnauthorized: false,
      connectTimeout: 300_000,
      pingInterval: 1000,
    },
    url: process.env.REDIS_URL,
  },
  auth: {
    accessTokenTtlSeconds: (+process.env.JWT_EXPIRES_MINUTES || 60) * 60,
    refreshTokenTtlSeconds:
      (+process.env.REFRESH_TOKEN_TTL_DAYS || 10) * 24 * 3600,
    twoFactorChallengeTtlSeconds: 5 * 60,
    twoFactorSetupTtlSeconds: 10 * 60,
    emailVerificationTtlSeconds: 10 * 60,
    passwordResetTtlSeconds: 10 * 60,
    adminInviteTtlSeconds: 48 * 3600,
    maxCodeAttempts: 5,
    throttleLimit: +process.env.AUTH_RATE_LIMIT_REQUEST_SIZE || 5,
    testToken: process.env.TEST_TOKEN || '123456',
    appName: process.env.PLATFORM_STARTER_NAME || 'Yahhel',
  },
  mailtrap: {
    apiKey: process.env.MAILTRAP_API_KEY,
    defaultEmailFrom: {
      hello: { name: 'Yahhel', email: 'hello@yahhel.com' },
      support: { name: 'Yahhel Support', email: 'support@yahhel.com' },
    },
    templates: {
      welcome: process.env.MAILTRAP_TEMPLATE_WELCOME,
      emailVerification: process.env.MAILTRAP_TEMPLATE_EMAIL_VERIFICATION,
      passwordReset: process.env.MAILTRAP_TEMPLATE_PASSWORD_RESET,
      passwordChanged: process.env.MAILTRAP_TEMPLATE_PASSWORD_CHANGED,
      adminInvite: process.env.MAILTRAP_TEMPLATE_ADMIN_INVITE,
    },
  },
  seedAdmin: {
    email: process.env.SEED_ADMIN_EMAIL,
    password: process.env.SEED_ADMIN_PASSWORD,
    firstName: process.env.SEED_ADMIN_FIRST_NAME || 'Platform',
    lastName: process.env.SEED_ADMIN_LAST_NAME || 'Admin',
  },
});
