import { eq } from "drizzle-orm";
import { db, redis } from "../db/db";
import { chats, messages, users } from "../db/schemas";

const DEFAULT_TTL = 60 * 60 * 24 * 7; // 7 days

// Define entity config with proper types
const entityConfig = {
  user: {
    table: users,
    idColumn: users.id,
    publicIdColumn: users.publicId,
  },
  chat: {
    table: chats,
    idColumn: chats.id,
    publicIdColumn: chats.publicId,
  },
  message: {
    table: messages,
    idColumn: messages.id,
    publicIdColumn: messages.publicId,
  },
} as const;

// Create proper type for entity keys
type Entity = keyof typeof entityConfig;

/**
 * Sets up bidirectional mapping between internal ID and public ID in Redis
 */
export async function setIdPublicIdMapping(entity: Entity, id: string, publicId: string): Promise<void> {
  await Promise.all([
    redis.set(`${entity}:publicId:${publicId}`, id),
    redis.set(`${entity}:id:${id}:publicId`, publicId),
  ]);
}

/**
 * Gets the internal ID from a public ID
 * Checks cache first, falls back to database lookup
 */
export async function getIdFromPublicId(entity: Entity, publicId: string): Promise<string | null> {
  const cachedId = await redis.get(`${entity}:publicId:${publicId}`);
  if (cachedId) return cachedId;

  const { table, publicIdColumn } = entityConfig[entity];

  const result = await db.select({ id: table.id })
    .from(table)
    .where(eq(publicIdColumn, publicId))
    .limit(1);

  if (result.length > 0 && result[0].id) {
    const id = String(result[0].id);
    await setIdPublicIdMapping(entity, id, publicId);
    return id;
  }

  return null;
}

/**
 * Gets the public ID from an internal ID
 * Checks cache first, falls back to database lookup
 */
export async function getPublicIdFromId(entity: Entity, id: string): Promise<string | null> {
  const cachedPublicId = await redis.get(`${entity}:id:${id}:publicId`);
  if (cachedPublicId) return cachedPublicId;

  const { table, idColumn } = entityConfig[entity];

  const result = await db.select({ publicId: table.publicId })
    .from(table)
    .where(eq(idColumn, id))
    .limit(1);

  if (result.length > 0 && result[0].publicId) {
    await setIdPublicIdMapping(entity, id, result[0].publicId);
    return result[0].publicId;
  }

  return null;
}

/**
 * Clears the ID/public ID mapping from Redis
 */
export async function clearIdPublicIdMapping(entity: Entity, id: string, publicId: string): Promise<void> {
  await Promise.all([
    redis.del(`${entity}:publicId:${publicId}`),
    redis.del(`${entity}:id:${id}:publicId`)
  ]);
}