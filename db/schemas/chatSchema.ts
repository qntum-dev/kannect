import { pgTable, uuid, timestamp, index, text } from "drizzle-orm/pg-core";
import { users } from "./userSchema";

export const chats = pgTable("chats", {
    id: uuid("id").primaryKey().defaultRandom(),
    publicId: text("public_id").unique().notNull(),
    userAId: uuid("user_a_id").references(() => users.id).notNull(),
    userBId: uuid("user_b_id").references(() => users.id).notNull(),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow()
}, (table) => [
    index("unique_chat_pair").on(table.userAId, table.userBId),
    index("chat_created_idx").on(table.createdAt)
]);
