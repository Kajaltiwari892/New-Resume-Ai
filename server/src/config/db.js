import mongoose from "mongoose";
import { env } from "./env.js";

mongoose.set("strictQuery", true);

export async function connectDB() {
  try {
    await mongoose.connect(env.mongoUri, {
      serverSelectionTimeoutMS: 10_000,
      socketTimeoutMS: 45_000,
      autoIndex: env.nodeEnv !== "production",
    });
    console.log("[db] connected");
  } catch (err) {
    console.error("[db] connection error:", err.message);
    process.exit(1);
  }

  mongoose.connection.on("error", (err) => {
    console.error("[db] runtime error:", err.message);
  });
  mongoose.connection.on("disconnected", () => {
    console.warn("[db] disconnected");
  });
}
