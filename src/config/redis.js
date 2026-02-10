// Redis client setup for backend

import redis from 'redis';

const client = redis.createClient({
  socket: {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    tls: true, // Required for Upstash and other cloud Redis providers
  },
  password: process.env.REDIS_PASSWORD || undefined,
});

client.on('error', (err) => {
  console.error('Redis error:', err);
});

client.connect().catch(console.error);

export default client
