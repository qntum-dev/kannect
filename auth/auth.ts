import { APIError, Gateway, Header } from "encore.dev/api";
import { authHandler } from "encore.dev/auth";
import { secret } from "encore.dev/config";

import log from "encore.dev/log";

const jwt_secret = secret("JWT_SECRET");


interface AuthParams {
    authCookies: Header<"Cookie">;
}

interface AuthData {
    userID: string;
    emailAddress: string;
}

const myAuthHandler = authHandler(async (params: AuthParams): Promise<
    AuthData
> => {
    const token = params.authCookies;

    if (!token) {
        throw APIError.unauthenticated("no token provided");
    }

    // try {
    //     const result = await verifyToken(token, {
    //         authorizedParties: AUTHORIZED_PARTIES,
    //         secretKey: clerkSecretKey(),
    //     });

    //     const user = await clerkClient.users.getUser(result.sub);

    return {
        userID:"",
        emailAddress: "",
    };
    // } catch (e) {
    //     log.error(e);
    //     throw APIError.unauthenticated("invalid token", e as Error);
    // }
});

export const mygw = new Gateway({ authHandler: myAuthHandler });
