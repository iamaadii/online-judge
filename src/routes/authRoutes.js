import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { User } from "../models/User.js";
import { requireLogin } from "../middleware/requireLogin.js";

const router = express.Router();

router.post("/signup", async (req, res) => {
    try {
        const body = req.body || {};
        const name = String(body.name || "").trim();
        const email = String(body.email || "").trim().toLowerCase();
        const password = String(body.password || "");

        if (name === "" || email === "" || password === "") {
            return res.status(400).json({ message: "name, email and password are required" });
        }

        if (password.length < 6) {
            return res.status(400).json({ message: "password must be at least 6 characters" });
        }

        const passwordHash = await bcrypt.hash(password, 10);

        await User.create({ name: name, email: email, passwordHash: passwordHash });

        return res.status(201).json({ message: "Account created" });
    } 
    catch (err) {
        if (err.code === 11000) {
            return res.status(409).json({ message: "Email already registered" });
        }
        console.log("Signup error:", err.message);
        return res.status(500).json({ message: "Something went wrong" });
    }
});

router.post("/login", async (req, res) => {
    try {
        const body = req.body || {};
        const email = String(body.email || "").trim().toLowerCase();
        const password = String(body.password || "");

        if (email === "" || password === "") {
            return res.status(400).json({ message: "email and password are required" });
        }

        const user = await User.findOne({ email: email });

        if (!user) {
            return res.status(401).json({ message: "Wrong email or password" });
        }

        const passwordMatches = await bcrypt.compare(password, user.passwordHash);

        if (!passwordMatches) {
            return res.status(401).json({ message: "Wrong email or password" });
        }

        const token = jwt.sign({ userId: user._id.toString() }, process.env.JWT_SECRET, {
            expiresIn: "1d",
        });

        return res.json({ token: token });
    } 
    catch (err) {
        console.log("Login error:", err.message);
        return res.status(500).json({ message: "Something went wrong" });
    }
});

router.get("/me", requireLogin, async (req, res) => {
    try {
        const user = await User.findById(req.userId);

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        return res.json({ id: user._id, name: user.name, email: user.email });
    }
    catch (err) {
        console.log("Me error:", err.message);
        return res.status(500).json({ message: "Something went wrong" });
    }
});

export default router;