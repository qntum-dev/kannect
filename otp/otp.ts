import { api, APIError } from "encore.dev/api";
import { IsEmail, MaxLen, MinLen } from "encore.dev/validate";
import { generateOtp } from "../utils/generateOTP";
import { eq } from "drizzle-orm";
import { userTable } from "../db/schemas";
import { db } from "../db/db";
import { mail, otp } from "~encore/clients";
import { getAuthData } from "~encore/auth";
import { compare, genSalt,hash } from "bcrypt-ts";
import { validatePassword } from "../utils/validate";

// working verify otp code
export const sendVerifyOTP = api({
    expose: true, auth: false, method: "GET", path: "/otp/sendVerifyOTP/:uid"
}, async ({ uid }: {
    uid: string
}): Promise<{ status: string }> => {
    console.log(uid);

    const find_user = await db.query.userTable.findFirst({
        where: eq(userTable.id, uid)
    });

    if (!find_user) {
        throw APIError.notFound("User not found")
    }

    if (find_user.isVerified) {
        return {
            status: "already_verified"
        }
    }

    try {
        const otp = generateOtp();
        const expiry = new Date(Date.now() + 10 * 60 * 1000);

        await mail.send({
            mail_addr: find_user.email,
            mail_body: otp,
            subject: "Verification OTP for Kannect"
        });

        await db.update(userTable).set({
            verificationOtp: otp,
            verificationOtpExpiresAt: expiry
        }).returning();
    } catch (error) {
        throw APIError.notFound("Failed to send verification OTP, please resend the OTP")
    }


    return {
        status: "sent_otp"
    };
});


export const verifyEmailOTP = api({
    auth: true,
    expose: true,
    path: "/otp/verify-email",
    method: "POST"
}, async ({ otp }: {
    otp: string & MinLen<6> & MaxLen<6>
}): Promise<{ status: string }> => {

    const { userID: uid } = getAuthData()!;

    const user = await db.query.userTable.findFirst({
        where: eq(userTable.id, uid)
    });

    if (!user) {
        throw APIError.notFound("User not found");
    }

    if (user.isVerified) {
        return { status: "already_verified" };
    }

    if (user.verificationOtp !== otp) {
        throw APIError.unauthenticated("Incorrect OTP");
    }

    if (!user.verificationOtpExpiresAt || user.verificationOtpExpiresAt.getTime() < Date.now()) {
        throw APIError.unauthenticated("OTP expired! Generate a new OTP");
    }

    await db.update(userTable).set({
        isVerified: true,
        verificationOtp: null,
        verificationOtpExpiresAt: null
    }).where(eq(userTable.id, uid)).returning();

    return {
        status: "Email Verified successfully"
    };
});

export const verifyForgotPasswordOTP = api({
    auth: true,
    expose: true,
    path: "/otp/verify-forgot-password",
    method: "POST"
}, async ({ otp, new_password }: {
    otp: string & MinLen<6> & MaxLen<6>,
    new_password: string & MinLen<8>
}): Promise<{ status: string }> => {

    const { userID: uid } = getAuthData()!;

    const user = await db.query.userTable.findFirst({
        where: eq(userTable.id, uid)
    });

    if (!user) {
        throw APIError.notFound("User not found");
    }

    if (user.resetPasswordOtp !== otp) {
        throw APIError.unauthenticated("Incorrect OTP");
    }

    if (!user.resetPasswordExpiresAt || user.resetPasswordExpiresAt.getTime() < Date.now()) {
        throw APIError.unauthenticated("OTP expired! Generate a new OTP");
    }

    const valid = validatePassword(new_password, user.email);
    
    if (valid !== "ok") {
        throw APIError.invalidArgument(valid);
    }
    const isSamePassword=await compare(new_password,user.password)
    if(isSamePassword){
        throw APIError.invalidArgument("New Password cannot be same as the current one");
    }
    
    const salt = await genSalt(10);
    const hashedPassword = await hash(new_password, salt);

    await db.update(userTable).set({
        password: hashedPassword,
        resetPasswordOtp: null,
        resetPasswordExpiresAt: null
    }).where(eq(userTable.id, uid)).returning();

    return {
        status: "Password reset successfully"
    };
});



export const sendResetOTP = api({
    expose: true, auth: false, method: "GET", path: "/otp/sendResetOTP/:email"
}, async ({ email }: {
    email: string
}): Promise<{ status: string }> => {
    console.log(email);

    const find_user = await db.query.userTable.findFirst({
        where: eq(userTable.email, email)
    });

    if (!find_user) {
        throw APIError.notFound("User not found")
    }


    try {
        const otp = generateOtp();
        const expiry = new Date(Date.now() + 10 * 60 * 1000);

        await mail.send({
            mail_addr: find_user.email,
            mail_body: otp,
            subject: "Reset Password OTP for Kannect"
        });

        await db.update(userTable).set({
            resetPasswordOtp: otp,
            resetPasswordExpiresAt: expiry
        }).returning();
    } catch (error) {
        throw APIError.notFound("Failed to send verification OTP, please resend the OTP")
    }


    return {
        status: "sent_otp"
    };
});