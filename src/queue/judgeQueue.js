import { Queue } from "bullmq";

export const redisConnection = {
    host: process.env.REDIS_HOST || "127.0.0.1",
    port: Number(process.env.REDIS_PORT) || 6380,
};

export const judgeQueue = new Queue("judge", { connection: redisConnection });

export async function addJudgeJob(submissionId) {
    await judgeQueue.add(
        "judge-submission",
        { submissionId: String(submissionId) },
        {
            jobId: String(submissionId),
            removeOnComplete: true,
            removeOnFail: 100,
        }
    );
}