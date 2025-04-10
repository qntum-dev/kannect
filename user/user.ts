import { api, APIError, ErrCode, Header } from "encore.dev/api";
import { MinLen, IsEmail } from "encore.dev/validate";
import { db } from "../db/db";
import { users } from "../db/schemas/userSchema";
import { eq, lt } from "drizzle-orm";
import { validatePassword } from "../utils/validate";
import { compare, genSalt, hash } from "bcrypt-ts";
import jwt from "jsonwebtoken";
import { secret } from "encore.dev/config";
import { generateOtp } from "../utils/generateOTP";
import cron from 'node-cron';
import { mail, otp } from "~encore/clients";
import { userOTPs } from "../db/schemas/authSchema";
import { nanoid } from "nanoid";

interface ReqBody {
    name: string & MinLen<1>;
    email: string & IsEmail;
    about?: string;
    password: string & MinLen<8>;
}

interface Response {
    message: string;
    authorisation: Header<"Set-Cookie">
}
const jwt_secret = secret("JWT_SECRET");



cron.schedule('0 3 * * *', async () => {
    const now = new Date();

    await db.delete(userOTPs).where(lt(userOTPs.expiresAt, now));

    console.log('Expired OTPs cleaned up');
});


export const create = api<ReqBody, Response>({
    method: "POST",
    expose: true,
    path: "/user/create"
}, async ({ email, name, about, password }): Promise<Response> => {

    const existingEmail = await db.query.users.findMany({
        where: eq(users.email, email)
    });

    if (existingEmail.length > 0) {
        console.log(existingEmail);
        throw APIError.alreadyExists("user already exists")
    }
    const valid = validatePassword(password, email)

    if (valid !== "ok") {
        throw APIError.invalidArgument(valid)

    }

    const salt = await genSalt(10);
    const hashedPassword = await hash(password, salt);


    const [user] = await db.insert(users).values({
        username: `${name.split(" ")[0]}-${nanoid(6)}`,
        publicId:nanoid(),
        name,
        email,
        about,
        passwordHash: hashedPassword,
    }).returning();

    // console.log(user);

    //How the subscribe/unsubscribe to emails work if I implement scheduled mails

    const token = jwt.sign({ pid: user.publicId }, jwt_secret(), {
        expiresIn: "7d"
    })

    await otp.sendVerifyOTP({
        public_id: user.publicId
    })


    // console.log(token);

    return {
        message: "Created user successfully",
        authorisation: `authToken=${token}; Path=/; HttpOnly; Secure;`
    };

});

interface LoginReq { email: string & IsEmail, password: string & MinLen<8> }

export const login = api<LoginReq, Response>({
    method: "POST",
    path: "/user/login",
    auth: false
}, async ({ email, password }) => {
    const find_user = await db.query.users.findFirst({
        where: eq(users.email, email)
    });


    if (!find_user) {
        throw APIError.notFound("User not found")
    }

    const verified = await compare(password, find_user.passwordHash);
    if (!verified) {
        throw APIError.unauthenticated("Invalid Password");
    }
    const token = jwt.sign({ pid: find_user.publicId }, jwt_secret(), {
        expiresIn: "7d"
    })
    
    return {
        message: "Logged In Successfully",
        authorisation: `authToken=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800;`

    }
})
