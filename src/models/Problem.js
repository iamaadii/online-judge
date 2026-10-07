import mongoose from "mongoose";

const testCaseSchema = new mongoose.Schema(
    {
        input: { type: String, required: true },
        expectedOutput: { type: String, required: true },
        isSample: { type: Boolean, default: false },
    },
    { _id: false }
);

const problemSchema = new mongoose.Schema({
    slug: { type: String, required: true, unique: true },
    title: { type: String, required: true },
    difficulty: { type: String, enum: ["easy", "medium", "hard"], required: true },
    statement: { type: String, required: true },
    timeLimitMs: { type: Number, default: 2000 },
    memoryLimitMb: { type: Number, default: 128 },
    testCases: [testCaseSchema],
});

export const Problem = mongoose.model("Problem", problemSchema);