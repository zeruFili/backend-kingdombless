import nodemailer from "nodemailer";
import dotenv from "dotenv";
import {
  PASSWORD_RESET_REQUEST_TEMPLATE,
  PASSWORD_RESET_SUCCESS_TEMPLATE,
  VERIFICATION_EMAIL_TEMPLATE,
} from "./emailtemplates";
import { AppError } from "../middlewares/error.middleware";

dotenv.config();

const getEmailUser = () => process.env.Email_User || process.env.EMAIL_USER || "";
const getEmailPass = () => process.env.Email_Password || process.env.EMAIL_PASSWORD || "";

export const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: getEmailUser(),
    pass: getEmailPass(),
  },
});

export const sendVerificationEmail = async (email: string, verificationToken: string): Promise<any> => {
  const fromUser = getEmailUser();
  const mailOptions = {
    from: `"Authentication Service" <${fromUser}>`,
    to: email,
    subject: "Verify your email",
    html: VERIFICATION_EMAIL_TEMPLATE.replace("{verificationCode}", verificationToken),
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    return info;
  } catch (error) {
    console.error("Error sending verification email:", error);
    throw new Error(`Error sending verification email: ${error}`);
  }
};

export const sendWelcomeEmail = async (email: string, name: string): Promise<any> => {
  const fromUser = getEmailUser();
  const mailOptions = {
    from: `"Authentication Service" <${fromUser}>`,
    to: email,
    subject: "Welcome to the Platform!",
    html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Welcome!</title>
</head>
<body style="margin: 0; padding: 24px 0; background-color: #F4EFE3; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #4A5568;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #FFFFFF; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(15, 29, 58, 0.08); border: 1px solid #E2DFD9;">
    <div style="background: linear-gradient(135deg, #0F1D3A 0%, #1A335C 100%); padding: 32px 24px; text-align: center; border-bottom: 3px solid #D4A853;">
      <h1 style="margin: 0; color: #FFFFFF; font-size: 24px; font-weight: 700;">
        Welcome to the Platform!
      </h1>
    </div>
    <div style="padding: 36px 32px 28px 32px;">
      <p style="margin-top: 0; font-size: 16px; color: #0F1D3A; font-weight: 600;">Welcome, ${name || "User"}!</p>
      <p style="font-size: 14px; color: #4A5568;">
        Your account has been registered and verified successfully.
      </p>
    </div>
  </div>
</body>
</html>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    return info;
  } catch (error) {
    console.error("Error sending welcome email:", error);
    throw new Error(`Error sending welcome email: ${error}`);
  }
};

export const sendPasswordResetEmail = async (email: string, resetURL: string): Promise<any> => {
  const fromUser = getEmailUser();
  const mailOptions = {
    from: `"Authentication Service" <${fromUser}>`,
    to: email,
    subject: "Reset your password",
    html: PASSWORD_RESET_REQUEST_TEMPLATE.replace("{resetURL}", resetURL),
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    return info;
  } catch (error) {
    console.error("Error sending password reset email:", error);
    throw new Error(`Error sending password reset email: ${error}`);
  }
};

export const sendResetSuccessEmail = async (email: string): Promise<any> => {
  const fromUser = getEmailUser();
  const mailOptions = {
    from: `"Authentication Service" <${fromUser}>`,
    to: email,
    subject: "Password Reset Successful",
    html: PASSWORD_RESET_SUCCESS_TEMPLATE,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    return info;
  } catch (error) {
    console.error("Error sending password reset success email:", error);
    throw new Error(`Error sending password reset success email: ${error}`);
  }
};

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

export class EmailService {
  async sendPasswordResetEmail(to: string, userNameOrResetUrl: string, rawToken?: string): Promise<void> {
    let resetUrl: string;
    if (rawToken) {
      resetUrl = `${FRONTEND_URL}/reset-password/${rawToken}`;
    } else {
      resetUrl = userNameOrResetUrl;
    }

    try {
      await sendPasswordResetEmail(to, resetUrl);
    } catch (err: any) {
      console.error("Email send failed:", err.message);
      throw new AppError(500, "Unable to send reset email. Please try again later.");
    }
  }

  async sendResetSuccessEmail(to: string): Promise<void> {
    try {
      await sendResetSuccessEmail(to);
    } catch (err: any) {
      console.warn("[EmailService] Failed to send reset success email:", err.message);
    }
  }

  async sendWelcomeEmail(to: string, name: string): Promise<void> {
    try {
      await sendWelcomeEmail(to, name);
    } catch (err: any) {
      console.warn("[EmailService] Failed to send welcome email:", err.message);
    }
  }

  async sendOtpEmail(to: string, _userName: string, otp: string, _purpose?: string): Promise<void> {
    try {
      await sendVerificationEmail(to, otp);
    } catch (err: any) {
      console.warn("[EmailService] Failed to send OTP email:", err.message);
      throw err;
    }
  }

  async sendVerificationEmail(to: string, verificationToken: string): Promise<void> {
    await sendVerificationEmail(to, verificationToken);
  }
}

export const emailService = new EmailService();
