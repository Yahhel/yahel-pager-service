import { StorageProvider } from '../interfaces/storage.type';

export const configs = () => ({
  paystack: {
    secret: process.env.PAYSTACK_SECRET,
    baseUrl: process.env.PAYSTACK_BASE_URL || 'https://api.paystack.co',
  },
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
      payoutAccountChanged: '',
    },
  },
  storage: {
    provider: (process.env.STORAGE_PROVIDER ||
      StorageProvider.AZURE) as StorageProvider,
    deletedFileRetentionDays: +process.env.FILE_DELETED_RETENTION_DAYS || 30,
    unattachedFileRetentionHours:
      +process.env.FILE_UNATTACHED_RETENTION_HOURS || 24,
    fileLinkTtlSeconds: +process.env.FILE_LINK_TTL_SECONDS || 300,
    // Audio/video links are reusable because players make many range requests
    mediaLinkTtlSeconds: +process.env.FILE_MEDIA_LINK_TTL_SECONDS || 2 * 3600,
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
