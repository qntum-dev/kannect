CREATE TABLE "user" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"about" text,
	"password" text NOT NULL,
	"name" text NOT NULL,
	"last_login" timestamp with time zone DEFAULT now(),
	"is_verified" boolean DEFAULT false,
	"reset_password_otp" text,
	"reset_password_expires_at" timestamp with time zone,
	"verification_otp" text,
	"verification_otp_expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
