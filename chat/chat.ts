import { api, APIError, StreamInOut } from "encore.dev/api";
import log from "encore.dev/log";
import { db, redis } from "../db/db";
import { chats } from "../db/schemas";
import { getAuthData } from "~encore/auth";
import { getIdFromPublicId } from "../utils/redisHelpers";
import { nanoid } from "nanoid";
import { eq, or } from "drizzle-orm";

// Map to hold all connected streams by userID
const connectedStreams: Map<string, StreamInOut<SendMessageRequest, ReceiveMessageResponse>> = new Map();

// const connectedStatusStreams: Map<string, StreamInOut<StatusRequest, StatusResponse>> = new Map();

interface ChatHandshake {
    receiverID: string;
}

interface SendMessageRequest {
    msg: string;
    type: "message" | "typing"
}

interface ReceiveMessageResponse {
    senderID: string;
    msg: string;
    type: "message" | "typing"
}


export const chat = api.streamInOut<ChatHandshake, SendMessageRequest, ReceiveMessageResponse>(
    { expose: true, auth: true, path: "/chat" },
    async (handshake, stream) => {
        const { userID } = getAuthData()!;
        const _userID = await getIdFromPublicId("user", userID);
        const _receiverID = await getIdFromPublicId("user", handshake.receiverID);

        if (!_userID) throw APIError.notFound("User not found");
        if (!_receiverID) throw APIError.notFound("Receiver not found");

        connectedStreams.set(_userID, stream);

        let chat = await db.query.chats.findFirst({
            where: (chats, { or, and, eq }) =>
                or(
                    and(eq(chats.userAId, _userID), eq(chats.userBId, _receiverID)),
                    and(eq(chats.userAId, _receiverID), eq(chats.userBId, _userID))
                )
        });

        if (!chat) {
            chat = await db.insert(chats).values({
                publicId: nanoid(),
                userAId: _userID,
                userBId: _receiverID,
            }).returning().then(rows => rows[0]);
        }

        log.info("User connected to chat", { userID, receiverID: handshake.receiverID });
        if (!chat) {
            throw APIError.internal("failed to create chat")
        }

        try {
            for await (const incomingMessage of stream) {
                const receiverStream = connectedStreams.get(_receiverID);

                if (!receiverStream) {
                    log.info("Receiver not connected");
                    // continue;
                }

                if (incomingMessage.type === "typing") {
                    log.info("Typing indicator", { sender: userID });
                    if(receiverStream){

                        await receiverStream.send({
                            senderID: userID,
                            msg: "", // usually empty string or specific indicator
                            type: "typing",
                        });
                    }

                    await redis.publish(`chat:${chat.id}:typing`, JSON.stringify({ senderID: userID, chatId: chat.id }));


                    continue;
                }

                if (incomingMessage.type === "message") {
                    log.info("New message", { sender: userID });
                    if(receiverStream){

                        await receiverStream.send({
                            senderID: userID,
                            msg: incomingMessage.msg,
                            type: "message",
                        });
                    }
                    await redis.publish(`chat:${chat.id}:message`, JSON.stringify({
                        senderID: userID,
                        chatId: chat.id,
                        msg: incomingMessage.msg,
                    }));
                    continue;
                }

                log.warn("Unknown message type received", { type: incomingMessage.type });
            }
        } catch (err) {
            log.error("Stream error", err);
        }

        connectedStreams.delete(_userID);
        log.info("User disconnected", { userID });
    },
);

