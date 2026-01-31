require('dotenv').config();
console.log('--- REDIS CONFIG DEBUG ---');
console.log('process.env.REDIS_URL:', process.env.REDIS_URL);
console.log('process.env.REDIS_HOST:', process.env.REDIS_HOST);
console.log('process.env.REDIS_PORT:', process.env.REDIS_PORT);

let redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
};

if (process.env.REDIS_URL) {
  try {
    const redisUrl = new URL(process.env.REDIS_URL);
    redisConfig = {
      host: redisUrl.hostname || 'localhost',
      port: parseInt(redisUrl.port || '6379', 10),
      password: redisUrl.password || undefined,
    };
    console.log('Parsed REDIS_URL successfully:', redisConfig);
  } catch (e) {
    console.error('Failed to parse REDIS_URL, falling back to defaults:', e.message);
  }
}

console.log('Final Redis Config:', redisConfig);
console.log('--------------------------');

const config = {
  port: process.env.PORT || 3000,
  databaseUrl: process.env.DATABASE_URL,
  redis: redisConfig,
  github: {
    clientId: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
    callbackUrl: process.env.GITHUB_CALLBACK_URL,
  },
  jwtSecret: process.env.JWT_SECRET || 'default_secret',
};

module.exports = config;
