import { createClient } from "@libsql/client";

export const db = createClient({
  url: process.env.DATABASE_URL || "file:./dev.db",
  authToken: process.env.DATABASE_AUTH_TOKEN,
});
