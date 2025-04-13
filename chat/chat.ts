import { api, APIError, StreamInOut } from "encore.dev/api";
import log from "encore.dev/log";
import { db, redis } from "../db/db";
import { chats } from "../db/schemas";
import { getAuthData } from "~encore/auth";
import { getIdFromPublicId } from "../utils/redisHelpers";
import { nanoid } from "nanoid";
import { eq, or, and } from "drizzle-orm";

// Map to hold all connected streams by userID
const connectedStreams: Map<string, StreamInOut<SendMessageRequest, ReceiveMessageResponse>> = new Map();

interface ChatHandshake {
    receiverID: string;
}

interface SendMessageRequest {
    msg: string;
    type: "message" | "typing";
}

interface ReceiveMessageResponse {
    senderID: string;
    msg: string;
    type: "message" | "typing";
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

        // --- Try to get chat from Redis cache first
        const cacheKeyA = `chat:user:${_userID}:receiver:${_receiverID}`;
        const cacheKeyB = `chat:user:${_receiverID}:receiver:${_userID}`;

        let chatString = await redis.get(cacheKeyA);
        let chat = chatString ? JSON.parse(chatString) : null;

        if (!chat) {
            // Fallback to DB
            chat = await db.query.chats.findFirst({
                where: (chats, { or, and, eq }) =>
                    or(
                        and(eq(chats.userAId, _userID), eq(chats.userBId, _receiverID)),
                        and(eq(chats.userAId, _receiverID), eq(chats.userBId, _userID))
                    )
            });

            if (!chat) {
                // Create new chat in DB
                chat = await db.insert(chats).values({
                    publicId: nanoid(),
                    userAId: _userID,
                    userBId: _receiverID,
                }).returning().then(rows => rows[0]);
            }

            // Cache chat in Redis (both directions)
            if (chat) {
                const chatJSON = JSON.stringify(chat);
                await redis.set(cacheKeyA, chatJSON);
                await redis.set(cacheKeyB, chatJSON);
            }
        }

        if (!chat) {
            throw APIError.internal("Failed to create chat");
        }

        log.info("User connected to chat", { userID, receiverID: handshake.receiverID });

        try {
            for await (const incomingMessage of stream) {
                const receiverStream = connectedStreams.get(_receiverID);

                if (!receiverStream) {
                    log.info("Receiver not connected");
                    // Don't continue here, we still want to publish typing or persist messages later.
                }

                if (incomingMessage.type === "typing") {
                    log.info("Typing indicator", { sender: userID });

                    // Send to receiver if connected
                    if (receiverStream) {
                        await receiverStream.send({
                            senderID: userID,
                            msg: "",
                            type: "typing",
                        });
                    }

                    // Publish to Redis Pub/Sub so other services / clients can listen
                    await redis.publish(`chat:${chat.id}:typing`, JSON.stringify({
                        senderID: userID,
                        chatId: chat.id,
                    }));

                    continue;
                }

                if (incomingMessage.type === "message") {
                    log.info("New message", { sender: userID });

                    if (receiverStream) {
                        await receiverStream.send({
                            senderID: userID,
                            msg: incomingMessage.msg,
                            type: "message",
                        });
                    }

                    // Here you can also save messages to DB if needed!
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
