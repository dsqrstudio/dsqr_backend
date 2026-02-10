// Redis client setup for backend

import redis from 'redis';

const client = redis.createClient({
  socket: {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
  },
  password: process.env.REDIS_PASSWORD || undefined,
});

client.on('error', (err) => {
  console.error('Redis error:', err);
});

// For Redis v4+, must connect before use
client.connect().catch(console.error);

export default client
