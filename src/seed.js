import "dotenv/config";
import mongoose from "mongoose";
import { connectToDatabase } from "./db.js";
import { Problem } from "./models/Problem.js";

const problems = [
    {
        slug: "sum-of-two",
        title: "Sum of Two Numbers",
        difficulty: "easy",
        statement: "Read two integers a and b from one line, separated by a space. Print a + b.",
        timeLimitMs: 2000,
        memoryLimitMb: 128,
        testCases: [
            { input: "3 4", expectedOutput: "7", isSample: true },
            { input: "10 20", expectedOutput: "30", isSample: false },
            { input: "-5 5", expectedOutput: "0", isSample: false },
            { input: "100000 200000", expectedOutput: "300000", isSample: false },
        ],
    },
    {
        slug: "even-or-odd",
        title: "Even or Odd",
        difficulty: "easy",
        statement: "Read one integer n. Print Even if n is even, otherwise print Odd.",
        timeLimitMs: 2000,
        memoryLimitMb: 128,
        testCases: [
            { input: "4", expectedOutput: "Even", isSample: true },
            { input: "7", expectedOutput: "Odd", isSample: false },
            { input: "0", expectedOutput: "Even", isSample: false },
            { input: "-3", expectedOutput: "Odd", isSample: false },
        ],
    },
    {
        slug: "reverse-string",
        title: "Reverse a String",
        difficulty: "easy",
        statement: "Read one line of text. Print the same text reversed.",
        timeLimitMs: 2000,
        memoryLimitMb: 128,
        testCases: [
            { input: "hello", expectedOutput: "olleh", isSample: true },
            { input: "a", expectedOutput: "a", isSample: false },
            { input: "racecar", expectedOutput: "racecar", isSample: false },
            { input: "Judge Day", expectedOutput: "yaD egduJ", isSample: false },
        ],
    },
];

async function seed() {
    await connectToDatabase();

    for (let i = 0; i < problems.length; i++) {
        const problem = problems[i];
        await Problem.findOneAndUpdate({ slug: problem.slug }, problem, { upsert: true });
    }

    console.log("Seeded " + problems.length + " problems");
    await mongoose.disconnect();
}

seed();