import "reflect-metadata";
import express from "express";
import cors from "cors";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

import { AppDataSource } from "./config/data-source";
import { errorHandler, notFound } from "./middlewares/error.middleware";
import authRoutes from "./routes/auth.routes";
import userRoutes from "./routes/user.routes";

const app = express();
const PORT = process.env.PORT || 3001;

const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:3000",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:3000",
];

const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    if (
      !origin ||
      allowedOrigins.includes(origin) ||
      /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
    ) {
      return callback(null, true);
    }
    return callback(null, true);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Static uploads serving for avatars/profile images
app.use("/uploads", express.static(path.join(process.cwd(), process.env.UPLOAD_DIR || "uploads")));

// Health check endpoint
app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

// Mount modular routes
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/users", userRoutes);

// Central error handlers
app.use(notFound);
app.use(errorHandler);

// If run directly as a standalone server
if (require.main === module) {
  AppDataSource.initialize()
    .then(() => {
      console.log("Database connected successfully");
      app.listen(PORT, () => {
        console.log(`Authentication server is running on http://localhost:${PORT}`);
      });
    })
    .catch((error) => {
      console.error("Database connection failed:", error);
      process.exit(1);
    });
}

export default app;
