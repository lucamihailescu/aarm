import { createClient } from "redis";
import process from "node:process";

// Ensure this matches your .env URL
const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

// Main client for querying Redis cache
export const redisClient = createClient({ url: REDIS_URL });

// Pub/Sub requires a dedicated client
export const redisPubSub = createClient({ url: REDIS_URL });

redisClient.on("error", (err) => console.error("Redis Client Error", err));
redisPubSub.on("error", (err) => console.error("Redis PubSub Error", err));

export async function connectRedis() {
  if (!redisClient.isOpen) {
    await redisClient.connect();
  }
  if (!redisPubSub.isOpen) {
    await redisPubSub.connect();
  }
}
