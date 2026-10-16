import mongoose from "mongoose";

const submissionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  problemSlug: { type: String, required: true },
  language: { type: String, required: true },
  code: { type: String, required: true },
  verdict: {
    type: String,
    enum: [
      "Pending",
      "Running",
      "Accepted",
      "Wrong Answer",
      "Time Limit Exceeded",
      "Memory Limit Exceeded",
      "Output Limit Exceeded",
      "Runtime Error",
      "Internal Error",
    ],
    default: "Pending",
  },
  passedTests: { type: Number, default: 0 },
  totalTests: { type: Number, default: 0 },
  failedTestNumber: { type: Number, default: null },
  maxTimeMs: { type: Number, default: 0 },
  errorMessage: { type: String, default: "" },
  createdAt: { type: Date, default: Date.now },
  judgedAt: { type: Date, default: null },
});

submissionSchema.index({ userId: 1, createdAt: -1 });

export const Submission = mongoose.model("Submission", submissionSchema);