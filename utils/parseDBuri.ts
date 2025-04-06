import { readFileSync } from 'fs';
import  parse from 'pg-connection-string';

export function parseDatabaseUrl(url: string, caPath?: string) {
  const connection = parse.parse(url);

  if (!connection.user || !connection.password || !connection.host || !connection.port || !connection.database) {
    throw new Error('Invalid database URL: missing required fields');
  }

  return {
    user: connection.user,
    password: connection.password,
    host: connection.host,
    port: Number(connection.port),
    database: connection.database,
    ssl: caPath
      ? {
          rejectUnauthorized: true,
          ca: readFileSync(caPath, 'utf-8'),
        }
      : undefined,
  };
}
