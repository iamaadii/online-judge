import { Submission } from "../models/Submission.js";
import { Problem } from "../models/Problem.js";
import { runInSandbox } from "./runner.js";

function cleanOutput(text) {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const cleaned = [];

  for (let i = 0; i < lines.length; i++) {
    cleaned.push(lines[i].trimEnd());
  }

  return cleaned.join("\n").trim();
}

function decideVerdict(result, expectedOutput) {
  if (result.timedOut) {
    return "Time Limit Exceeded";
  }

  if (result.outputTooLong) {
    return "Output Limit Exceeded";
  }

  if (result.exitCode === 137) {
    return "Memory Limit Exceeded";
  }

  if (result.exitCode !== 0) {
    return "Runtime Error";
  }

  if (cleanOutput(result.stdout) === cleanOutput(expectedOutput)) {
    return "Accepted";
  }

  return "Wrong Answer";
}

export async function judgeSubmission(submissionId) {
  const submission = await Submission.findById(submissionId);

  if (!submission) {
    return;
  }

  try {
    const problem = await Problem.findOne({ slug: submission.problemSlug });

    if (!problem) {
      throw new Error("Problem not found: " + submission.problemSlug);
    }

    submission.verdict = "Running";
    submission.totalTests = problem.testCases.length;
    await submission.save();

    let passed = 0;
    let maxTimeMs = 0;
    let finalVerdict = "Accepted";
    let failedTestNumber = null;
    let errorMessage = "";

    for (let i = 0; i < problem.testCases.length; i++) {
      const testCase = problem.testCases[i];

      const result = await runInSandbox({
        language: submission.language,
        code: submission.code,
        input: testCase.input,
        timeLimitMs: problem.timeLimitMs,
        memoryLimitMb: problem.memoryLimitMb,
      });

      if (result.timeMs > maxTimeMs) {
        maxTimeMs = result.timeMs;
      }

      const verdict = decideVerdict(result, testCase.expectedOutput);

      if (verdict !== "Accepted") {
        finalVerdict = verdict;
        failedTestNumber = i + 1;

        if (verdict === "Runtime Error") {
          errorMessage = result.stderr.trim().slice(0, 500);
        }

        break;
      }

      passed = passed + 1;
    }

    submission.verdict = finalVerdict;
    submission.passedTests = passed;
    submission.failedTestNumber = failedTestNumber;
    submission.maxTimeMs = maxTimeMs;
    submission.errorMessage = errorMessage;
    submission.judgedAt = new Date();
    await submission.save();
  } catch (err) {
    console.log("Judge error:", err.message);
    submission.verdict = "Internal Error";
    submission.judgedAt = new Date();
    await submission.save();
  }
}