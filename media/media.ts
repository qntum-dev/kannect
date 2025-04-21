import { v2 as cloudinary } from 'cloudinary';
import { api, APIError, Query } from 'encore.dev/api';
import { secret } from 'encore.dev/config';
import { getAuthData } from '~encore/auth';
import { getIdFromPublicId } from '../utils/redisHelpers';
import { redis } from '../db/db';
const cloud_name = secret("CLOUDINARY_CLOUD_NAME")();
const api_key = secret("CLOUDINARY_API_KEY")();
const api_secret = secret("CLOUDINARY_API_SECRET")();

cloudinary.config({
    cloud_name,
    api_key,
    api_secret // Click 'View API Keys' above to copy your API secret
});

// // Upload an image
//  const uploadResult = await cloudinary.uploader
//    .upload(
//        'https://res.cloudinary.com/demo/image/upload/getting-started/shoes.jpg', {
//            public_id: 'shoes',
//        }
//    )
//    .catch((error) => {
//        console.log(error);
//    });

// console.log(uploadResult);

interface ChatDetails {
    id: string
    publicId: string
    userAId: string
    userBId: string
    createdAt: string
    updatedAt: string
}

interface Req {
    chatID: Query<string>
}
interface Res {
    timestamp: number
    signature: string
    cloud_name: string
    api_key: string
}

export const upload = api<Req, Res>({
    auth: true,
    expose: true,
    method: "GET",
    path: "/media/getUploadUrlSign"
}, async ({ chatID }) => {
    const auth = getAuthData();
    if (!auth) {
        throw APIError.unauthenticated("Sorry, you are not autorized to perform this action")
    }

    let userID = auth.userID;
    const _userID = await getIdFromPublicId("user", userID);
    if (!_userID) {
        throw APIError.unauthenticated("User not found")
    }

    const _chatID = await getIdFromPublicId("chat", chatID);
    if (!_chatID) {
        throw APIError.notFound("chat not found")
    }
    const chat_string = await redis.get(`chat:${_chatID}`)

    if (!chat_string) {
        throw APIError.internal("internal error")
    }
    const chat_details = JSON.parse(chat_string) as ChatDetails
    // console.log(chat_details);

    if (!(chat_details.userAId == _userID || chat_details.userBId == _userID)) {
        throw APIError.unauthenticated("user is not allowed to send in this chat")
    }
    const timestamp = Math.round((new Date).getTime() / 1000);

    const signature = cloudinary.utils.api_sign_request({
        timestamp,
        folder: `kannect-uploads/${chatID}/${userID}`
    }, api_secret)
    return { timestamp, signature, cloud_name, api_key }

})