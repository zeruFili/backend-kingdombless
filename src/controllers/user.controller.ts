import { Request, Response, NextFunction } from "express";
import { validate } from "class-validator";
import { plainToInstance } from "class-transformer";
import { AuthRequest } from "../middlewares/auth.middleware";
import { AppError } from "../middlewares/error.middleware";
import {
  CreateUserDto,
  UpdateUserDto,
  UpdateUserRoleDto,
  UpdateUserStatusDto,
} from "../validators/user.dto";
import { UserRole } from "../enums/user-role.enum";
import { UserStatus } from "../enums/user-status.enum";
import { userService } from "../services/user.service";
import {
  cleanupUploadedFiles,
  getUploadedFilePath,
} from "../utils/upload.utils";
import { USER_UPLOAD_SUBFOLDER } from "../middlewares/user-upload.middleware";

function resolveUserProfileImage(req: Request): string | undefined {
  return (
    getUploadedFilePath(req, "profileImage", USER_UPLOAD_SUBFOLDER) ||
    getUploadedFilePath(req, "profile_image", USER_UPLOAD_SUBFOLDER) ||
    getUploadedFilePath(req, "avatar", USER_UPLOAD_SUBFOLDER) ||
    getUploadedFilePath(req, "image", USER_UPLOAD_SUBFOLDER) ||
    getUploadedFilePath(req, "attachmentFiles", USER_UPLOAD_SUBFOLDER) ||
    (typeof req.body.profileImage === "string" ? req.body.profileImage : undefined) ||
    (typeof req.body.profile_image === "string" ? req.body.profile_image : undefined) ||
    (typeof req.body.avatar === "string" ? req.body.avatar : undefined)
  );
}

async function validateDto<T extends object>(dtoClass: new () => T, plain: object): Promise<T> {
  const instance = plainToInstance(dtoClass, plain);
  const errors = await validate(instance, {
    whitelist: true,
    forbidNonWhitelisted: false,
  });

  if (errors.length > 0) {
    const messages = errors
      .map((e) => Object.values(e.constraints || {}))
      .flat()
      .join(", ");
    throw new AppError(400, messages);
  }

  return instance;
}

export class UserController {
  async findAll(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
      const role = req.query.role as UserRole | undefined;
      const search = req.query.search as string | undefined;
      const status = req.query.status as UserStatus | undefined;

      let is_active: boolean | undefined;
      if (req.query.is_active !== undefined) {
        is_active = req.query.is_active === "true";
      }

      const result = await userService.findAll(page, limit, role, is_active, search, status);
      res.status(200).json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }

  async findById(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await userService.findById(req.params.id as string);
      res.status(200).json({ success: true, data: user });
    } catch (err) {
      next(err);
    }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const profileImage = resolveUserProfileImage(req);
      const body = {
        ...req.body,
        full_name: req.body.full_name || req.body.name,
        phone: typeof req.body.phone === "string" && req.body.phone.trim() ? req.body.phone.trim() : undefined,
        otpMethod: req.body.otpMethod || req.body.otp_method || (req.body.phone ? "sms" : "email"),
        ...(profileImage ? { profileImage } : {}),
      };

      const dto = await validateDto(CreateUserDto, body);
      const result = await userService.create({
        full_name: dto.full_name,
        email: dto.email,
        password: dto.password,
        role: dto.role,
        phone: dto.phone,
        status: dto.status,
        is_active: dto.is_active,
        profileImage: dto.profileImage,
        otp: dto.otp,
        otpMethod: dto.otpMethod,
      });

      if (result.requiresOtp) {
        cleanupUploadedFiles(req);
        res.status(200).json({
          success: true,
          requiresOtp: true,
          message: result.message,
          data: {
            identifier: result.identifier,
            otpMethod: result.otpMethod,
            expiresAt: result.expiresAt,
          },
        });
        return;
      }

      res.status(201).json({
        success: true,
        message: "User created successfully",
        data: result.user,
      });
    } catch (err) {
      cleanupUploadedFiles(req);
      next(err);
    }
  }

  async update(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const profileImage = resolveUserProfileImage(req);
      const body = {
        ...req.body,
        ...(req.body.name || req.body.fullName ? { full_name: req.body.name || req.body.fullName } : {}),
        phone: typeof req.body.phone === "string" && req.body.phone.trim() ? req.body.phone.trim() : undefined,
        ...(profileImage ? { profileImage } : {}),
      };

      const dto = await validateDto(UpdateUserDto, body);
      const currentUser = req.user ? { id: req.user.id, role: req.user.role } : undefined;
      const user = await userService.update(req.params.id as string, dto, currentUser);

      res.status(200).json({
        success: true,
        message: "User updated successfully",
        data: user,
      });
    } catch (err) {
      cleanupUploadedFiles(req);
      next(err);
    }
  }

  async updateRole(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const dto = await validateDto(UpdateUserRoleDto, req.body);
      const user = await userService.updateRole(req.params.id as string, dto.role);
      res.status(200).json({
        success: true,
        message: "User role updated successfully",
        data: user,
      });
    } catch (err) {
      next(err);
    }
  }

  async updateStatus(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const dto = await validateDto(UpdateUserStatusDto, req.body);
      const user = await userService.updateStatus(req.params.id as string, dto.status);
      res.status(200).json({
        success: true,
        message: "User status updated successfully",
        data: user,
      });
    } catch (err) {
      next(err);
    }
  }

  async softDelete(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      await userService.softDelete(req.params.id as string);
      res.status(200).json({
        success: true,
        message: "User deactivated successfully",
      });
    } catch (err) {
      next(err);
    }
  }
}

export const userController = new UserController();
