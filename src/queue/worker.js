import "dotenv/config";
import { Worker } from "bullmq";
import { connectToDatabase } from "../db.js";
import { judgeSubmission } from "../judge/judge.js";
import { redisConnection } from "./judgeQueue.js";

await connectToDatabase();

const concurrency = Number(process.env.JUDGE_CONCURRENCY) || 2;

const worker = new Worker(
    "judge",
    async (job) => {
        console.log("Judging submission", job.data.submissionId);
        await judgeSubmission(job.data.submissionId);
    },
    { connection: redisConnection, concurrency }
);

worker.on("completed", (job) => {
    console.log("Done:", job.data.submissionId);
});

worker.on("failed", (job, error) => {
    console.log("Failed:", job?.data.submissionId, error.message);
});

console.log(`Worker started. Judging ${concurrency} at a time.`);