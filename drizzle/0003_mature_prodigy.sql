ALTER TABLE "user_verification_tokens" RENAME TO "userOTPs";--> statement-breakpoint
ALTER TABLE "userOTPs" DROP CONSTRAINT "user_verification_tokens_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "userOTPs" ADD CONSTRAINT "userOTPs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;