export default () => ({
  app: {
    env: process.env.NODE_ENV ?? 'development',
    port: parseInt(process.env.PORT ?? '3000', 10),
    // Comma-separated list, e.g. "https://app.example.com,https://admin.example.com".
    // A bare "*" reflects any origin — fine for local dev, not recommended in production.
    corsOrigins: (process.env.CORS_ORIGIN ?? '*').split(',').map((origin) => origin.trim()),
  },
  throttle: {
    ttlMs: parseInt(process.env.THROTTLE_TTL_MS ?? '60000', 10),
    limit: parseInt(process.env.THROTTLE_LIMIT ?? '100', 10),
    authTtlMs: parseInt(process.env.THROTTLE_AUTH_TTL_MS ?? '60000', 10),
    authLimit: parseInt(process.env.THROTTLE_AUTH_LIMIT ?? '10', 10),
  },
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET,
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
  },
  cache: {
    redisUrl: process.env.REDIS_URL,
    ttlSeconds: parseInt(process.env.CACHE_TTL_SECONDS ?? '60', 10),
  },
});
