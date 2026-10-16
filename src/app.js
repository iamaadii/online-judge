import express from "express";
import authRoutes from "./routes/authRoutes.js";
import problemRoutes from "./routes/problemRoutes.js";
import submissionRoutes from "./routes/submissionRoutes.js";

export const app = express();
app.use(express.json());

app.get("/health", (req, res) => {
    res.json({ status: "ok" });
});

app.use("/auth", authRoutes);
app.use("/problems", problemRoutes);
app.use("/submissions", submissionRoutes);