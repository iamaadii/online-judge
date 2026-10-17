import Redis from "ioredis";

const redis = new Redis({
  host: process.env.REDIS_HOST || "127.0.0.1",
  port: Number(process.env.REDIS_PORT) || 6380,
});

redis.on("error", (error) => {
  console.log("Redis error in submitLimit:", error.message);
});

const MAX_SUBMISSIONS = 5;
const WINDOW_SECONDS = 60;

export async function submitLimit(req, res, next) {
  try {
    const userId = req.userId;
    const key = `submit-limit:${userId}`;

    const count = await redis.incr(key);

    if (count === 1) {
      await redis.expire(key, WINDOW_SECONDS);
    }

    if (count > MAX_SUBMISSIONS) {
      const secondsLeft = await redis.ttl(key);
      res.set("Retry-After", String(secondsLeft));
      return res.status(429).json({
        error: `Too many submissions. Try again in ${secondsLeft} seconds.`,
      });
    }

    next();
  } catch (error) {
    console.log("submitLimit failed, letting request through:", error.message);
    next();
  }
}