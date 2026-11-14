import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateAuthSchema1710000000000 implements MigrationInterface {
  name = "CreateAuthSchema1710000000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Create enum types if not exists
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "user_role_enum" AS ENUM('user', 'admin', 'church', 'company', 'ministry');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "user_status_enum" AS ENUM('pending', 'active', 'inactive', 'suspended');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // 2. Ensure pgcrypto extension for gen_random_uuid
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`);

    // 3. Create user table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "user" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "full_name" character varying(255) NOT NULL,
        "email" character varying(255) NOT NULL,
        "password_hash" character varying(255),
        "phone" character varying(20),
        "phone_verified_at" TIMESTAMP WITH TIME ZONE,
        "email_verified_at" TIMESTAMP WITH TIME ZONE,
        "profile_image" character varying(255),
        "website" character varying(255),
        "education" text,
        "achievement" text,
        "professional_experience" text,
        "status" "user_status_enum" NOT NULL DEFAULT 'pending',
        "is_active" boolean NOT NULL DEFAULT true,
        "rank" smallint NOT NULL DEFAULT 1,
        "role" "user_role_enum" NOT NULL,
        "last_login_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "UQ_user_email" UNIQUE ("email")
      );
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_user_email" ON "user" ("email");`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_user_status" ON "user" ("status");`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_user_role" ON "user" ("role");`);

    // 4. Create local_credentials table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "local_credentials" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "password_hash" character varying(255) NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "UQ_local_credentials_user_id" UNIQUE ("user_id"),
        CONSTRAINT "FK_local_credentials_user" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE
      );
    `);

    // 5. Create auth_identities table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "auth_identities" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "provider" character varying(50) NOT NULL,
        "provider_user_id" character varying(255) NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "UQ_auth_identities_provider_sub" UNIQUE ("provider", "provider_user_id"),
        CONSTRAINT "FK_auth_identities_user" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE
      );
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_auth_identities_user_id" ON "auth_identities" ("user_id");`);

    // 6. Create password_reset_token table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "password_reset_token" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "userId" uuid NOT NULL,
        "tokenHash" character varying(255) NOT NULL,
        "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL,
        "used" boolean NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        CONSTRAINT "FK_password_reset_token_user" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE
      );
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_password_reset_token_userId" ON "password_reset_token" ("userId");`);

    // 7. Create otp_verifications table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "otp_verifications" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" uuid,
        "identifier" character varying(255) NOT NULL,
        "otp_hash" character varying(255) NOT NULL,
        "purpose" character varying(50) NOT NULL,
        "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "attempts" integer NOT NULL DEFAULT 0,
        "used_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        CONSTRAINT "FK_otp_verifications_user" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE
      );
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_otp_verifications_identifier" ON "otp_verifications" ("identifier");`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_otp_verifications_purpose" ON "otp_verifications" ("purpose");`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_otp_verifications_expires_at" ON "otp_verifications" ("expires_at");`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_otp_verifications_user_id" ON "otp_verifications" ("user_id");`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_otp_verifications_identifier_purpose" ON "otp_verifications" ("identifier", "purpose");`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "otp_verifications" CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS "password_reset_token" CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS "auth_identities" CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS "local_credentials" CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS "user" CASCADE;`);
    await queryRunner.query(`DROP TYPE IF EXISTS "user_status_enum";`);
    await queryRunner.query(`DROP TYPE IF EXISTS "user_role_enum";`);
  }
}
