// Redis client setup for backend

import redis from 'redis'


const client = redis.createClient({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD || undefined, // Only set if needed
})

client.on('error', (err) => {
  console.error('Redis error:', err)
})

export default client
