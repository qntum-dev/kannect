import { api, APIError } from "encore.dev/api";
import { IsEmail, MaxLen, MinLen } from "encore.dev/validate";
import { generateOtp } from "../utils/generateOTP";
import { and, eq } from "drizzle-orm";
import { users } from "../db/schemas";
import { db } from "../db/db";
import { mail, otp } from "~encore/clients";
import { getAuthData } from "~encore/auth";
import { compare, genSalt, hash } from "bcrypt-ts";
import { validatePassword } from "../utils/validate";
import { userOTPs } from "../db/schemas/authSchema";

// working verify otp code
export const sendVerifyOTP = api({
    expose: true, auth: false, method: "GET", path: "/otp/sendVerifyOTP/:public_id"
}, async ({ public_id }: {
    public_id: string
}): Promise<{ status: string }> => {
    console.log(public_id);

    const find_user = await db.query.users.findFirst({
        where: eq(users.publicId, public_id)
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

        await db.insert(userOTPs).values({
            userId: find_user.id,
            token: otp,
            expiresAt: expiry
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
    // try {
        
    // } catch (error) {
    //     console.log(error);
    //     return {
    //         status: "error"
    //     }
    // }

    const { userID: public_id } = getAuthData()!;

        const user = await db.query.users.findFirst({
            where: eq(users.publicId, public_id)
        });
        if (!user) {
            throw APIError.notFound("User not found")
        }
        if (user.isVerified) {
            return { status: "already_verified" };
        }
        const userToken = await db.query.userOTPs.findFirst({
            where: and(
                eq(userOTPs.tokenType, "email_otp"),
                eq(userOTPs.userId, user.id)
            ),
            orderBy: (table, { desc }) => [desc(table.createdAt)],

        });

        if (!user) {
            throw APIError.notFound("User not found");
        }

        if (!userToken) {
            throw APIError.notFound("No otp found resend the otp");

        }
        

        if (userToken.token !== otp) {
            throw APIError.unauthenticated("Incorrect OTP");
        }

        const isExpired = userToken.expiresAt < new Date();

        if (isExpired) {
            throw APIError.unauthenticated("OTP expired! Generate a new OTP");
        }

        await db.delete(userOTPs).where(eq(userOTPs.userId, user.id)).returning();

        await db.update(users).set({
            isVerified:true
        })

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

    const { userID: public_id } = getAuthData()!;

    const user = await db.query.users.findFirst({
        where: eq(users.publicId, public_id)
    });
    if (!user) {
        throw APIError.notFound("User not found")
    }
    
    console.log(user.id);
    
    const userToken = await db.query.userOTPs.findFirst({
        where: and(
            eq(userOTPs.tokenType, "forgot_otp"),
            eq(userOTPs.userId, user.id)
        ),
        orderBy: (table, { desc }) => [desc(table.createdAt)],

    });

    if (!user) {
        throw APIError.notFound("User not found");
    }
    if (!userToken) {
        throw APIError.notFound("No otp found resend the otp");

    }
    if (userToken.token !== otp) {
        throw APIError.unauthenticated("Incorrect OTP");
    }
    const isExpired = userToken.expiresAt < new Date();

    if (isExpired) {
        throw APIError.unauthenticated("OTP expired! Generate a new OTP");
    }
    await db.delete(userOTPs).where(eq(userOTPs.userId, user.id)).returning();

    const valid = validatePassword(new_password, user.email);

    if (valid !== "ok") {
        throw APIError.invalidArgument(valid);
    }
    const isSamePassword = await compare(new_password, user.passwordHash)
    if (isSamePassword) {
        throw APIError.invalidArgument("New Password cannot be same as the current one");
    }

    const salt = await genSalt(10);
    const hashedPassword = await hash(new_password, salt);

    await db.update(users).set({
        passwordHash: hashedPassword
    }).where(eq(users.id, user.id)).returning();

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

    const find_user = await db.query.users.findFirst({
        where: eq(users.email, email)
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


        await db.insert(userOTPs).values({
            userId: find_user.id,
            token: otp,
            expiresAt: expiry,
            tokenType: "forgot_otp"
        }).returning();


    } catch (error) {
        throw APIError.notFound("Failed to send verification OTP, please resend the OTP")
    }


    return {
        status: "sent_otp"
    };
});