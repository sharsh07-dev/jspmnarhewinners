import { getRedisClient } from './redisClient.js';

const memoryStore = new Map();

function createMemoryExpiry(email, expiresAt) {
  const ttl = expiresAt - Date.now();
  if (ttl <= 0) {
    memoryStore.delete(email);
    return;
  }

  setTimeout(() => {
    memoryStore.delete(email);
  }, ttl);
}

export async function saveOtpEntry(email, entry, ttlSeconds) {
  const client = await getRedisClient();
  if (client) {
    await client.set(`otp:${email}`, JSON.stringify(entry), { EX: ttlSeconds });
    return;
  }

  memoryStore.set(email, entry);
  createMemoryExpiry(email, entry.expiresAt);
}

export async function getOtpEntry(email) {
  const client = await getRedisClient();
  if (client) {
    const raw = await client.get(`otp:${email}`);
    if (!raw) {
      return null;
    }

    const entry = JSON.parse(raw);
    if (Date.now() >= entry.expiresAt) {
      await client.del(`otp:${email}`);
      return null;
    }

    return entry;
  }

  const entry = memoryStore.get(email);
  if (!entry) {
    return null;
  }

  if (Date.now() >= entry.expiresAt) {
    memoryStore.delete(email);
    return null;
  }

  return entry;
}

export async function deleteOtpEntry(email) {
  const client = await getRedisClient();
  if (client) {
    await client.del(`otp:${email}`);
    return;
  }

  memoryStore.delete(email);
}

export async function incrementOtpAttempts(email) {
  const entry = await getOtpEntry(email);
  if (!entry) {
    return null;
  }

  entry.attempts += 1;
  await saveOtpEntry(email, entry, Math.max(0, Math.ceil((entry.expiresAt - Date.now()) / 1000)));
  return entry.attempts;
}
