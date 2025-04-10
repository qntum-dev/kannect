import { pgTable, uuid, text, boolean, timestamp, index, uniqueIndex, AnyPgColumn } from "drizzle-orm/pg-core";
import { chats } from "./chatSchema";
import { users } from "./userSchema";




export const messages = pgTable('messages', {
    id: uuid('id').defaultRandom().primaryKey(),
    publicId: uuid('public_id').notNull().unique(),
    chatId: uuid('chat_id').notNull().references(() => chats.id),
    senderId: uuid('sender_id').notNull().references(() => users.id),
    content: text('content').notNull(),
    replyToMessageId: uuid('reply_to_message_id').references((): AnyPgColumn => messages.id),
    forwardedFromMessageId: uuid('forwarded_from_message_id').references((): AnyPgColumn => messages.id),
    isDeleted: boolean('is_deleted').default(false),
    isEdited: boolean('is_edited').default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
}, (table) => [
    uniqueIndex('msg_cursor_idx').on(table.chatId, table.createdAt)
]);

