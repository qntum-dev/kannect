import { drizzle } from "drizzle-orm/node-postgres"
import { parseDatabaseUrl } from '../utils/parseDBuri';
import * as schema from './schemas/userSchema'; // ✅ your schema import

import { secret } from "encore.dev/config";
import pg from "pg";

const db_uri = secret("DB_URI");

export const pool = new pg.Pool(parseDatabaseUrl(db_uri(), "ca.pem"));

const db = drizzle(pool,{
    schema
});

export { db };

