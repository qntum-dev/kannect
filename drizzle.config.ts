import { defineConfig } from 'drizzle-kit';
import { parseDatabaseUrl } from './utils/parseDBuri';




export default defineConfig({
  out: './drizzle',
  schema: ['./db/schemas/userSchema.ts'],
  dialect: 'postgresql',
  verbose: true,
  strict: true,
  dbCredentials: parseDatabaseUrl(process.env.DB_URI!, "ca.pem"),

});
