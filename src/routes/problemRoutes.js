import express from "express";
import { Problem } from "../models/Problem.js";

const router = express.Router();

router.get("/", async (req, res) => {
    try {
        const problems = await Problem.find({}, "slug title difficulty").sort({ title: 1 });
        const list = [];
        for (let i = 0; i < problems.length; i++) {
            list.push({
                slug: problems[i].slug,
                title: problems[i].title,
                difficulty: problems[i].difficulty,
            });
        }
        return res.json({ problems: list });
    } 
    catch (err) {
        console.log("List problems error:", err.message);
        return res.status(500).json({ message: "Something went wrong" });
    }
});

router.get("/:slug", async (req, res) => {
    try {
        const problem = await Problem.findOne({ slug: String(req.params.slug) });

        if (!problem) {
            return res.status(404).json({ message: "Problem not found" });
        }

        const sampleTests = [];
        for (let i = 0; i < problem.testCases.length; i++) {
            const testCase = problem.testCases[i];
            if (testCase.isSample === true) {
                sampleTests.push({
                    input: testCase.input,
                    expectedOutput: testCase.expectedOutput,
                });
            }
        }
        return res.json({
            slug: problem.slug,
            title: problem.title,
            difficulty: problem.difficulty,
            statement: problem.statement,
            timeLimitMs: problem.timeLimitMs,
            memoryLimitMb: problem.memoryLimitMb,
            sampleTests: sampleTests,
            totalTestCases: problem.testCases.length,
        });
    }
    catch (err) {
        console.log("Get problem error:", err.message);
        return res.status(500).json({ message: "Something went wrong" });
    }
});

export default router;