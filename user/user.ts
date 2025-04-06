import { api, APIError, ErrCode } from "encore.dev/api";
import { MinLen, IsEmail } from "encore.dev/validate";
import { db } from "../db/db";
import { userTable } from "../db/schemas/userSchema";
import { eq } from "drizzle-orm";

interface ReqBody {
    name: string & MinLen<1>;
    email: string & IsEmail;
    about?: string;
    password: string & MinLen<6>;
}

interface Response {
    message: string;
}

export const create = api<ReqBody>({
    method: "POST",
    expose: true,
    path: "/user/create"
}, async ({ email, name, about, password }): Promise<Response> => {
    // const existingEmail = await db.query.userTable.findMany({
    //     where: eq(userTable.email, email)
    // });

    // // if (existingEmail.length > 0) {
    // //     console.log(existingEmail);
    // //     return {
    // //         message: "Email already exists"
    // //     };
    // // }

    // const [user] = await db.insert(userTable).values({
    //     name,
    //     email,
    //     about,
    //     password,
    // }).returning();

    // console.log(user);

    // return {
    //     message: "Created user successfully"
    // };
    try {
        const existingEmail = await db.query.userTable.findMany({
            where: eq(userTable.email, email)
        });

        if (existingEmail.length > 0) {
            console.log(existingEmail);
            return {
                message: "Email already exists"
            };
        }

        const [user] = await db.insert(userTable).values({
            name,
            email,
            about,
            password,
        }).returning();

        console.log(user);

        return {
            message: "Created user successfully"
        };
    } catch (error) {
        console.log(error);
        return {
            message: "Internal server error"
        };
    }

});
