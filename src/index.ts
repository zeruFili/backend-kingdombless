// Application & Entry
export { default as app } from "./app";

// Configuration
export { AppDataSource } from "./config/data-source";
export { authConfig, AuthConfig } from "./config/auth.config";

// Entities (Database Models)
export * from "./entities";

// Enums
export * from "./enums";

// Middlewares & Guards
export * from "./middlewares/auth.middleware";
export * from "./middlewares/error.middleware";
export * from "./middlewares/login-rate-limit.middleware";
export * from "./middlewares/otp-rate-limit.middleware";
export * from "./middlewares/forgot-password-rate-limit.middleware";
export * from "./middlewares/rate-limit.middleware";
export * from "./middlewares/user-upload.middleware";

// Validators (DTOs)
export * from "./validators";

// Services
export * from "./services";

// Controllers
export * from "./controllers/auth.controller";
export * from "./controllers/user.controller";

// Routes
export { default as authRoutes } from "./routes/auth.routes";
export { default as userRoutes } from "./routes/user.routes";
export { default as routes } from "./routes";

// Utility helpers
export * from "./utils/jwt.utils";
export * from "./utils/password.utils";
export * from "./utils/response.utils";
export * from "./utils/user-details.util";
export * from "./utils/user-columns.utils";
export * from "./utils/upload.utils";

// SMS & EthioSMS Modules
export * as ethioSms from "./modules/ethiosms";
export * as sms from "./modules/sms";
