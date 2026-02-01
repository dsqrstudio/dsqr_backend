// Redis client setup for backend

import redis from 'redis'

const client = redis.createClient({
  host: 'localhost',
  port: 6379,
})

client.on('error', (err) => {
  console.error('Redis error:', err)
})

export default client
