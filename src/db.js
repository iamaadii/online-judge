import mongoose from "mongoose";

export async function connectToDatabase() {
    await mongoose.connect(process.env.MONGO_URL);
    console.log("Connected to MongoDB");
}