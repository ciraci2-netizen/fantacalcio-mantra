import { PrismaClient } from "@/app/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

function createPrismaClient() {
  const authToken = process.env.DATABASE_AUTH_TOKEN;
  const url = process.env.DATABASE_URL;

  // Usa Turso/libSQL se è presente il token di autenticazione (produzione)
  if (authToken && url) {
    const adapter = new PrismaLibSql({ url, authToken });
    return new PrismaClient({ adapter });
  }

  // SQLite locale in sviluppo
  const localUrl = url || "file:./dev.db";
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PrismaBetterSqlite3 } = require("@prisma/adapter-better-sqlite3");
  const adapter = new PrismaBetterSqlite3({ url: localUrl });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
