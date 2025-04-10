import { Header, Gateway, APIError } from "encore.dev/api";
import { authHandler } from "encore.dev/auth";
import * as cookie from "cookie"

import jwt from "jsonwebtoken";
import { secret } from "encore.dev/config";
// AuthParams specifies the incoming request information
// the auth handler is interested in.
interface AuthParams {
    authCookies: Header<"Cookie">;
}

// The AuthData specifies the information about the authenticated user
// that the auth handler makes available.
interface AuthData {
    userID: string;
}


const jwtSecret = secret("JWT_SECRET")

// The auth handler itself.
export const auth = authHandler<AuthParams, AuthData>(
    async (params) => {
        const parsedCookie = cookie.parse(params.authCookies);
        console.log(parsedCookie.authToken);

        if (parsedCookie.authToken) {
            const decodedJWT = jwt.verify(
                parsedCookie.authToken,
                jwtSecret()
            ) as jwt.JwtPayload;

            console.log(decodedJWT);

            return { userID: decodedJWT.pid as string };
        }

        // Optional: handle case where there is no token
        throw APIError.unauthenticated("No auth token provided");
    }
);

// Define the API Gateway that will execute the auth handler:
export const gateway = new Gateway({
    authHandler: auth,
})
