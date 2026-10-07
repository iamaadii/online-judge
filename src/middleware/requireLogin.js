import jwt from "jsonwebtoken";

export function requireLogin(req, res, next) {
    const header = req.headers.authorization;

    if (!header || !header.startsWith("Bearer ")) {
        return res.status(401).json({ message: "Please log in first" });
    }

    const token = header.split(" ")[1];

    try {
        const data = jwt.verify(token, process.env.JWT_SECRET);
        req.userId = data.userId;
        next();
    } catch (err) {
        return res.status(401).json({ message: "Invalid or expired token" });
    }
}