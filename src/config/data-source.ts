import "reflect-metadata";
import { DataSource } from "typeorm";
import dotenv from "dotenv";
import { User } from "../entities/User";
import { LocalCredential } from "../entities/LocalCredential";
import { AuthIdentity } from "../entities/AuthIdentity";
import { PasswordResetToken } from "../entities/PasswordResetToken";
import { OtpVerification } from "../entities/otp-verification";

dotenv.config();

export const AppDataSource = new DataSource({
  type: "postgres",
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT) || 5432,
  username: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || "postgres",
  database: process.env.DB_NAME || "auth_db",

  synchronize: process.env.NODE_ENV !== "production",
  logging: process.env.NODE_ENV === "development",
  ssl:
    process.env.DB_SSL === "true" || process.env.DB_SSL === "require"
      ? { rejectUnauthorized: false }
      : false,

  entities: [
    User,
    LocalCredential,
    AuthIdentity,
    PasswordResetToken,
    OtpVerification,
  ],
  migrations: [__dirname + "/../migrations/**/*.{ts,js}"],
  subscribers: [],
});
