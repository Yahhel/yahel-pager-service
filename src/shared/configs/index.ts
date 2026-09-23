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
      tls: ['production', 'stage', 'development'].includes(
        process.env.NODE_ENV.toLowerCase().trim(),
      ),
      rejectUnauthorized: false,
      connectTimeout: 300_000,
      pingInterval: 1000,
    },
    url: process.env.REDIS_URL,
  },
  mailgun: {
    apiKey: process.env.MAIL_GUN_API_KEY,
    domain: process.env.MAIL_GUN_DOMAIN,
    defaultEmailReceiver: process.env.MAIL_GUN_DEFAULT_EMAIL,
    defaultEmailFrom: {
      hello: 'Ope From Yahhel <hello@yahhel.com>',
      support: 'Ope From Yahhel <support@yahhel.com>',
      engineering: 'Ope From Yahhel <engineering@yahhel.com>',
      marketing: 'Ope From Yahhel <marketing@yahhel.com>',
      finance: 'Ope From Yahhel <finance@yahhel.com>',
    },
    defaultEmailTo: {
      support: 'support@yahhel.com',
    },
    templates: {
      termsAndConditions: 'trace-updated-terms-and-conditions',
      traceTradeTermination: 'trace-trade-termination',
    },
  }
});
