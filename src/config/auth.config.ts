import dotenv from "dotenv";

dotenv.config();

export interface AuthConfig {
  jwt: {
    secret: string;
    refreshSecret: string;
    accessTokenTtl: string;
    refreshTokenTtl: string;
    resetTokenTtl: string;
  };
  bcryptCost: number;
  googleClientId?: string;
  otp: {
    requireVerification: boolean;
    expiryMinutes: number;
    maxAttempts: number;
    resendCooldownMs: number;
  };
}

export const authConfig: AuthConfig = {
  jwt: {
    secret: process.env.JWT_SECRET || "default_jwt_secret_change_in_production",
    refreshSecret: process.env.JWT_REFRESH_SECRET || "default_refresh_secret",
    accessTokenTtl: process.env.ACCESS_TOKEN_TTL || "7d",
    refreshTokenTtl: process.env.JWT_REFRESH_EXPIRES_IN || "7d",
    resetTokenTtl: process.env.RESET_TOKEN_TTL || "15d",
  },
  bcryptCost: Number(process.env.BCRYPT_COST) || 12,
  googleClientId: process.env.GOOGLE_CLIENT_ID,
  otp: {
    requireVerification: process.env.REQUIRE_OTP_VERIFICATION !== "false",
    expiryMinutes: Number(process.env.OTP_EXPIRY_MINUTES) || 10,
    maxAttempts: Number(process.env.MAX_OTP_ATTEMPTS) || 5,
    resendCooldownMs: Number(process.env.OTP_RESEND_COOLDOWN_MS) || 60000,
  },
};
