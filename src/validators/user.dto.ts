import {
  IsString,
  IsIn,
  IsEnum,
  IsOptional,
  IsEmail,
  IsBoolean,
  Length,
  MinLength,
  Matches,
  IsUrl,
  ValidateIf,
} from "class-validator";
import { Transform } from "class-transformer";
import { UserRole } from "../enums/user-role.enum";
import { UserStatus } from "../enums/user-status.enum";

export class CreateUserDto {
  @IsString()
  @Length(1, 255)
  full_name: string;

  @IsEmail()
  @Length(1, 255)
  email: string;

  @IsString()
  @MinLength(8)
  @Length(8, 128)
  @Matches(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\da-zA-Z]).{8,128}$/,
    {
      message:
        "Password must include uppercase, lowercase, digit, and special character",
    }
  )
  password: string;

  @IsIn(
    [
      UserRole.Church,
      UserRole.Company,
      UserRole.User,
      UserRole.Ministry,
    ],
    {
      message: "Admin role cannot be assigned during user creation",
    }
  )
  role: UserRole;

  @IsOptional()
  @ValidateIf((_obj, value) => !!value)
  @IsString()
  @Matches(/^(\+?[1-9]\d{1,14}|0[79]\d{8}|[79]\d{8})$/, {
    message: "Invalid phone number format",
  })
  phone?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{6}$/, {
    message: "OTP must be a 6-digit number",
  })
  otp?: string;

  @IsOptional()
  @IsIn(["sms", "email"], {
    message: "OTP method must be either 'sms' or 'email'",
  })
  otpMethod?: "sms" | "email";

  @IsOptional()
  @IsUrl()
  @Length(1, 255)
  website?: string;

  @IsOptional()
  @IsString()
  education?: string;

  @IsOptional()
  @IsString()
  achievement?: string;

  @IsOptional()
  @IsString()
  professional_experience?: string;

  @IsOptional()
  @ValidateIf((_obj, value) => value !== null)
  @IsString()
  @Length(1, 255)
  profileImage?: string | null;

  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

export class UpdateUserDto {
  @IsOptional()
  @Transform(({ value, obj }) => value ?? obj?.fullName ?? obj?.name)
  @IsString()
  @Length(1, 255)
  full_name?: string;

  @IsOptional()
  @IsEmail()
  @Length(1, 255)
  email?: string;

  @IsOptional()
  @ValidateIf((_obj, value) => !!value)
  @IsString()
  @Matches(/^(\+?[1-9]\d{1,14}|0[79]\d{8}|[79]\d{8})$/, {
    message: "Invalid phone number format",
  })
  phone?: string;

  @IsOptional()
  @IsUrl()
  @Length(1, 255)
  website?: string;

  @IsOptional()
  @IsString()
  education?: string;

  @IsOptional()
  @IsString()
  achievement?: string;

  @IsOptional()
  @Transform(({ value, obj }) => value ?? obj?.professionalExperience)
  @IsString()
  professional_experience?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  @Length(8, 128)
  @Matches(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\da-zA-Z]).{8,128}$/,
    {
      message:
        "Password must include uppercase, lowercase, digit, and special character",
    }
  )
  password?: string;

  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @IsOptional()
  @ValidateIf((_obj, value) => value !== null)
  @IsString()
  @Length(1, 255)
  profileImage?: string | null;
}

export class UpdateUserRoleDto {
  @IsEnum(UserRole)
  role: UserRole;
}

export class UpdateUserStatusDto {
  @IsEnum(UserStatus)
  status: UserStatus;
}
