import { createClient } from 'redis';
import { config } from '../../config/index.js';

let client = null;

export async function getRedisClient() {
  if (!config.redisUrl) {
    return null;
  }

  if (client) {
    return client;
  }

  client = createClient({ url: config.redisUrl });
  client.on('error', (error) => console.error('Redis client error:', error));
  await client.connect();
  return client;
}
