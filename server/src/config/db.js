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
    // eslint-disable-next-line no-console
    console.log("[db] connected");
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[db] connection error:", err.message);
    process.exit(1);
  }

  mongoose.connection.on("error", (err) => {
    // eslint-disable-next-line no-console
    console.error("[db] runtime error:", err.message);
  });
  mongoose.connection.on("disconnected", () => {
    // eslint-disable-next-line no-console
    console.warn("[db] disconnected");
  });
}
