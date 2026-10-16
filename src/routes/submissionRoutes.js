import express from "express";
import mongoose from "mongoose";
import { Problem } from "../models/Problem.js";
import { Submission } from "../models/Submission.js";
import { languages } from "../judge/languages.js";
import { judgeSubmission } from "../judge/judge.js";
import { requireLogin } from "../middleware/requireLogin.js";

const router = express.Router();
const MAX_CODE_LENGTH = 20000;

router.post("/", requireLogin, async (req, res) => {
  try {
    const body = req.body || {};
    const problemSlug = String(body.problemSlug || "").trim();
    const language = String(body.language || "").trim();

    let code = "";
    if (typeof body.code === "string") {
      code = body.code;
    }

    if (problemSlug === "" || language === "" || code === "") {
      return res.status(400).json({ message: "problemSlug, language and code are required" });
    }

    if (code.length > MAX_CODE_LENGTH) {
      return res.status(400).json({ message: "Code is too long (max " + MAX_CODE_LENGTH + " characters)" });
    }

    if (!Object.hasOwn(languages, language)) {
      return res.status(400).json({
        message: "Unsupported language. Supported: " + Object.keys(languages).join(", "),
      });
    }

    const problem = await Problem.findOne({ slug: problemSlug });

    if (!problem) {
      return res.status(404).json({ message: "Problem not found" });
    }

    const submission = await Submission.create({
      userId: req.userId,
      problemSlug: problemSlug,
      language: language,
      code: code,
      totalTests: problem.testCases.length,
    });

    judgeSubmission(submission._id).catch((err) => {
      console.log("Judge crashed:", err.message);
    });

    return res.status(202).json({ submissionId: submission._id, verdict: "Pending" });
  } catch (err) {
    console.log("Submit error:", err.message);
    return res.status(500).json({ message: "Something went wrong" });
  }
});

router.get("/", requireLogin, async (req, res) => {
  try {
    const submissions = await Submission.find({ userId: req.userId })
      .sort({ createdAt: -1 })
      .limit(20);

    const list = [];
    for (let i = 0; i < submissions.length; i++) {
      const s = submissions[i];
      list.push({
        id: s._id,
        problemSlug: s.problemSlug,
        language: s.language,
        verdict: s.verdict,
        passedTests: s.passedTests,
        totalTests: s.totalTests,
        createdAt: s.createdAt,
      });
    }

    return res.json({ submissions: list });
  } catch (err) {
    console.log("List submissions error:", err.message);
    return res.status(500).json({ message: "Something went wrong" });
  }
});

router.get("/:id", requireLogin, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid submission id" });
    }

    const submission = await Submission.findOne({ _id: req.params.id, userId: req.userId });

    if (!submission) {
      return res.status(404).json({ message: "Submission not found" });
    }

    return res.json({
      id: submission._id,
      problemSlug: submission.problemSlug,
      language: submission.language,
      code: submission.code,
      verdict: submission.verdict,
      passedTests: submission.passedTests,
      totalTests: submission.totalTests,
      failedTestNumber: submission.failedTestNumber,
      maxTimeMs: submission.maxTimeMs,
      errorMessage: submission.errorMessage,
      createdAt: submission.createdAt,
      judgedAt: submission.judgedAt,
    });
  } catch (err) {
    console.log("Get submission error:", err.message);
    return res.status(500).json({ message: "Something went wrong" });
  }
});

export default router;