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
      hello: 'Ope From AA <hello@aa.com>',
      support: 'Ope From AA <support@aa.com>',
      engineering: 'Ope From AA <engineering@aa.com>',
      marketing: 'Ope From AA <marketing@aa.com>',
      finance: 'Ope From AA <finance@aa.com>',
    },
    defaultEmailTo: {
      support: 'support@aa.com',
    },
    templates: {
      termsAndConditions: 'trace-updated-terms-and-conditions',
      traceTradeTermination: 'trace-trade-termination',
    },
    templateConfigs: {
      'trace-updated-terms-and-conditions': {
        subject: 'Terms And Conditions Updated For Trade',
        sender: 'Ope From AA <hello@aa.com>',
        title: 'Trace Updated Terms and Conditions',
        description: 'Updated Terms and Conditions Email',
      },
      'trace-trade-termination': {
        subject: 'Trade Termination Alert',
        sender: 'Ope From AA <hello@aa.com>',
        title: 'Trace Trade Termination',
        description: 'Email to notify trade termination',
      }
    },
  }
});
