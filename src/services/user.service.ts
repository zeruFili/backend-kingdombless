import { FindOptionsWhere, ILike } from "typeorm";
import bcrypt from "bcryptjs";
import { AppDataSource } from "../config/data-source";
import { User } from "../entities/User";
import { LocalCredential } from "../entities/LocalCredential";
import { UserRole } from "../enums/user-role.enum";
import { UserStatus } from "../enums/user-status.enum";
import { AppError } from "../middlewares/error.middleware";
import { pickAdminUserFields, AdminUserOutput } from "../utils/response.utils";
import { getUserDetails, UserDetails } from "../utils/user-details.util";
import { deleteFile } from "../utils/upload.utils";
import { otpService } from "./otp.service";
import { emailService } from "./email.service";
import { OtpPurpose } from "../enums/otp-purpose.enum";

interface PaginatedResult<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

interface CreateUserInput {
  full_name: string;
  email: string;
  password: string;
  role: UserRole;
  phone?: string;
  status?: UserStatus;
  is_active?: boolean;
  profileImage?: string | null;
  otp?: string;
  otpMethod?: "sms" | "email";
}

interface UpdateUserInput {
  full_name?: string;
  email?: string;
  phone?: string;
  password?: string;
  status?: UserStatus;
  role?: UserRole;
  profileImage?: string | null;
}

export interface CurrentUser {
  id?: string;
  role?: UserRole;
}

const userRepo = () => AppDataSource.getRepository(User);
const parsedBcryptCost = Number(process.env.BCRYPT_COST);
const BCRYPT_COST = Number.isFinite(parsedBcryptCost) && parsedBcryptCost > 0 ? parsedBcryptCost : 12;

function sanitizeUser(user: User): UserDetails {
  const image = user.profileImage ?? null;
  return {
    id: user.id,
    fullName: user.full_name,
    full_name: user.full_name,
    email: user.email,
    role: user.role,
    status: user.status,
    is_active: user.is_active,
    profileImage: image,
    profile_image: image,
    avatar: image,
    phone: user.phone ?? null,
    last_login_at: user.last_login_at ?? null,
    created_at: user.created_at ?? null,
    createdAt: user.created_at ?? null,
    registeredAt: user.created_at ? user.created_at.toISOString() : null,
    updated_at: user.updated_at ?? null,
    updatedAt: user.updated_at ?? null,
  };
}

export class UserService {
  async findAll(
    page: number = 1,
    limit: number = 20,
    role?: UserRole,
    is_active?: boolean,
    search?: string,
    status?: UserStatus
  ): Promise<PaginatedResult<AdminUserOutput>> {
    const skip = (page - 1) * limit;
    const where: FindOptionsWhere<User>[] = [];

    const baseConditions: FindOptionsWhere<User> = {};
    if (role !== undefined) baseConditions.role = role;
    if (is_active !== undefined) baseConditions.is_active = is_active;
    if (status !== undefined) baseConditions.status = status;

    if (search && search.trim()) {
      const trimmedSearch = search.trim();
      where.push(
        { ...baseConditions, full_name: ILike(`%${trimmedSearch}%`) },
        { ...baseConditions, email: ILike(`%${trimmedSearch}%`) },
        { ...baseConditions, phone: ILike(`%${trimmedSearch}%`) }
      );
    } else {
      where.push(baseConditions);
    }

    const [users, total] = await userRepo().findAndCount({
      where: where.length === 1 ? where[0] : where,
      skip,
      take: limit,
      order: { created_at: "DESC" },
      relations: ["localCredential"],
    });

    return {
      data: users.map((u) => pickAdminUserFields(u)!),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findById(id: string): Promise<UserDetails> {
    const user = await getUserDetails(id);
    if (!user) {
      throw new AppError(404, "User not found");
    }
    return user;
  }

  async create(data: CreateUserInput): Promise<{ user: UserDetails; requiresOtp?: boolean; identifier?: string; otpMethod?: string; expiresAt?: Date; message?: string }> {
    const normalizedEmail = data.email.trim().toLowerCase();
    const existing = await userRepo().findOne({ where: { email: normalizedEmail } });
    if (existing) {
      throw new AppError(409, "Email already exists");
    }

    const requireOtp = process.env.REQUIRE_OTP_VERIFICATION !== "false";
    const otpMethod = (data.otpMethod || (data.phone ? "sms" : "email")).toLowerCase() as "sms" | "email";
    const targetIdentifier =
      otpMethod === "email"
        ? normalizedEmail
        : data.phone
        ? data.phone.trim()
        : normalizedEmail;

    if (requireOtp && !data.otp) {
      if (otpMethod === "sms" && !data.phone) {
        throw new AppError(400, "Phone number is required for SMS OTP verification.");
      }
      const sendResult = await otpService.generateAndSendOtp(targetIdentifier, OtpPurpose.REGISTER);
      const channelMessage =
        otpMethod === "email"
          ? `Verification code sent to your email (${targetIdentifier}). Please enter the OTP to complete registration.`
          : "Verification code sent to your phone via SMS. Please enter the OTP to complete registration.";
      return {
        user: null as any,
        requiresOtp: true,
        identifier: sendResult.identifier,
        otpMethod,
        expiresAt: sendResult.expiresAt,
        message: channelMessage,
      };
    }

    const password_hash = await bcrypt.hash(data.password, BCRYPT_COST);

    return await AppDataSource.transaction(async (manager) => {
      let otpRecordId: string | null = null;
      if (data.otp && targetIdentifier) {
        const verifyResult = await otpService.verifyOtp(
          targetIdentifier,
          data.otp,
          OtpPurpose.REGISTER,
          manager
        );
        otpRecordId = verifyResult.record.id;
      }

      const isSmsOtp = otpMethod === "sms" && !!otpRecordId;
      const isEmailOtp = otpMethod === "email" && !!otpRecordId;

      const user = manager.getRepository(User).create({
        full_name: data.full_name,
        email: normalizedEmail,
        password_hash,
        role: data.role,
        phone: data.phone ? data.phone.trim() : undefined,
        status: data.status || UserStatus.ACTIVE,
        is_active: data.is_active !== undefined ? data.is_active : true,
        profileImage: data.profileImage || undefined,
        phoneVerifiedAt: isSmsOtp ? new Date() : null,
        emailVerifiedAt: isEmailOtp ? new Date() : null,
      });

      const saved = await manager.getRepository(User).save(user);

      const localCred = manager.getRepository(LocalCredential).create({
        userId: saved.id,
        passwordHash: password_hash,
      });
      await manager.getRepository(LocalCredential).save(localCred);

      if (otpRecordId) {
        await otpService.linkUser(otpRecordId, saved.id, manager);
      }

      try {
        await emailService.sendWelcomeEmail(saved.email, saved.full_name);
      } catch (welcomeErr: any) {
        console.warn("[UserService] Welcome email notice:", welcomeErr?.message);
      }

      return { user: sanitizeUser(saved) };
    });
  }

  async update(
    id: string,
    data: UpdateUserInput,
    currentUser?: CurrentUser
  ): Promise<UserDetails> {
    const user = await userRepo().findOne({ where: { id } });
    if (!user) {
      throw new AppError(404, "User not found");
    }

    const isSelf = currentUser?.id === id;
    const isAdmin = currentUser?.role === UserRole.Admin;

    if (!isSelf && !isAdmin) {
      throw new AppError(403, "You can only update your own profile");
    }

    if (data.email && data.email !== user.email) {
      const existing = await userRepo().findOne({
        where: { email: data.email.trim().toLowerCase() },
      });
      if (existing) {
        throw new AppError(409, "Email already in use");
      }
      user.email = data.email.trim().toLowerCase();
    }

    if (data.full_name !== undefined) user.full_name = data.full_name;
    if (data.phone !== undefined) user.phone = data.phone;

    if (data.profileImage !== undefined) {
      if (user.profileImage && user.profileImage !== data.profileImage) {
        deleteFile(user.profileImage);
      }
      user.profileImage = data.profileImage;
    }

    if (data.password) {
      user.password_hash = await bcrypt.hash(data.password, BCRYPT_COST);
      try {
        const localCredRepo = AppDataSource.getRepository(LocalCredential);
        let cred = await localCredRepo.findOne({ where: { userId: user.id } });
        if (cred) {
          cred.passwordHash = user.password_hash;
          await localCredRepo.save(cred);
        } else {
          cred = localCredRepo.create({
            userId: user.id,
            passwordHash: user.password_hash,
          });
          await localCredRepo.save(cred);
        }
      } catch (err: any) {
        console.warn("[UserService] LocalCredential update notice:", err?.message);
      }
    }

    if (isAdmin) {
      if (data.status !== undefined) user.status = data.status;
      if (data.role !== undefined) user.role = data.role;
    }

    user.updated_at = new Date();
    const updated = await userRepo().save(user);
    return sanitizeUser(updated);
  }

  async updateRole(id: string, role: UserRole): Promise<UserDetails> {
    const user = await userRepo().findOne({ where: { id } });
    if (!user) {
      throw new AppError(404, "User not found");
    }

    user.role = role;
    user.updated_at = new Date();
    const updated = await userRepo().save(user);
    return sanitizeUser(updated);
  }

  async updateStatus(id: string, status: UserStatus): Promise<UserDetails> {
    const user = await userRepo().findOne({ where: { id } });
    if (!user) {
      throw new AppError(404, "User not found");
    }

    user.status = status;
    user.is_active = status === UserStatus.ACTIVE;
    user.updated_at = new Date();
    const updated = await userRepo().save(user);
    return sanitizeUser(updated);
  }

  async softDelete(id: string): Promise<void> {
    const user = await userRepo().findOne({ where: { id } });
    if (!user) {
      throw new AppError(404, "User not found");
    }

    user.is_active = false;
    user.status = UserStatus.INACTIVE;
    user.updated_at = new Date();
    await userRepo().save(user);
  }
}

export const userService = new UserService();
