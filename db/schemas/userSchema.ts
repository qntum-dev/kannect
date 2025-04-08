import { pgTable, uuid, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const userTable = pgTable("user", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  about: text('about'),
  password: text("password").notNull(),
  name: text("name").notNull(),
  lastLogin: timestamp("last_login", { withTimezone: true }).defaultNow(),
  isVerified: boolean("is_verified").default(false),
  resetPasswordOtp: text("reset_password_otp"),
  resetPasswordExpiresAt: timestamp("reset_password_expires_at", { withTimezone: true }),
  verificationOtp: text("verification_otp"),
  verificationOtpExpiresAt: timestamp("verification_otp_expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  // isPassKeyAuth:boolean("is_pass_key_auth")
});
