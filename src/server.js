import "dotenv/config";
import { app } from "./app.js";
import { connectToDatabase } from "./db.js";

const PORT = process.env.PORT || 3000;

async function start() {
    try {
        await connectToDatabase();
        app.listen(PORT, () => {
            console.log("Server running on port " + PORT);
        });
    } 
    catch (err) {
        console.log("Could not start:", err.message);
        process.exit(1);
    }
}

start();