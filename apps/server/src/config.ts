import 'dotenv/config';

export const config = {
  // Server
  port: parseInt(process.env.PORT || '3000', 10),
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  logLevel: process.env.LOG_LEVEL || 'info',

  // Auth
  jwtSecret: process.env.JWT_SECRET || 'development-secret-change-in-production',
  jwtExpiry: '7d',

  // Database
  databaseUrl: process.env.DATABASE_URL || '',

  // Redis
  redisUrl: process.env.REDIS_URL || '',

  // AI Services
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
  inworldApiKey: process.env.INWORLD_API_KEY || '',
  inworldApiSecret: process.env.INWORLD_API_SECRET || '',
  inworldWorkspace: process.env.INWORLD_WORKSPACE || '',
  deepgramApiKey: process.env.DEEPGRAM_API_KEY || '',
  elevenLabsApiKey: process.env.ELEVENLABS_API_KEY || '',

  // Generation
  meshyApiKey: process.env.MESHY_API_KEY || '',

  // Storage
  r2AccessKey: process.env.R2_ACCESS_KEY || '',
  r2SecretKey: process.env.R2_SECRET_KEY || '',
  r2Bucket: process.env.R2_BUCKET || 'genesis-assets',
  r2PublicUrl: process.env.R2_PUBLIC_URL || '',
};

// Validate required config in production
if (process.env.NODE_ENV === 'production') {
  const required = ['jwtSecret', 'databaseUrl', 'anthropicApiKey'];
  for (const key of required) {
    if (!config[key as keyof typeof config]) {
      throw new Error(`Missing required config: ${key}`);
    }
  }
}
