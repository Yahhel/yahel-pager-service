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
  mailtrap: {
    apiKey: process.env.MAILTRAP_API_KEY,
    // When set, mail goes to this Mailtrap testing inbox instead of real recipients
    inboxId: +process.env.MAILTRAP_INBOX_ID || undefined,
    defaultEmailReceiver: 'tech@yahhel.com',
    defaultEmailTo: {
      support: 'support@yahhel.com',
      engineering: 'engineering@yahhel.com',
      marketing: 'marketing@yahhel.com',
    },
    defaultEmailFrom: {
      hello: 'Yahhel <hello@yahhel.com>',
      support: 'Yahhel Support <support@yahhel.com>',
      engineering: 'Yahhel Engineering <engineering@yahhel.com>',
      marketing: 'Yahhel Marketing <marketing@yahhel.com>',
      finance: 'Yahhel Finance <finance@yahhel.com>',
      noreply: 'Noreply <noreply@yahhel.com>',
    },
    templates: {
      generalWelcome: '',
      generalEmailVerification: '',
      generalPasswordChange: '',
      generalPasswordChangeSuccess: '',
      adminInvitation: '',
    },
  },
  app: {
    appName: process.env.PLATFORM_STARTER_NAME || 'Yahhel',
    testToken: process.env.TEST_RESET_TOKEN || '123456',
  },
  seedAdmin: {
    email: process.env.SEED_ADMIN_EMAIL,
    password: process.env.SEED_ADMIN_PASSWORD,
    firstName: process.env.SEED_ADMIN_FIRST_NAME || 'Platform',
    lastName: process.env.SEED_ADMIN_LAST_NAME || 'Admin',
  },
});
