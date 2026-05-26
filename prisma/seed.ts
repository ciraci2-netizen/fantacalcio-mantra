import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const dbUrl = process.env.DATABASE_URL || "file:./dev.db";
const adapter = new PrismaBetterSqlite3({ url: dbUrl });
const prisma = new PrismaClient({ adapter });

async function main() {
  const existing = await prisma.user.findUnique({ where: { username: "admin" } });
  if (existing) {
    console.log("Admin già esistente.");
    return;
  }

  const hashed = await bcrypt.hash("admin123", 10);
  await prisma.user.create({
    data: {
      username: "admin",
      password: hashed,
      teamName: "Admin",
      isAdmin: true,
    },
  });

  console.log("✅ Utente admin creato.");
  console.log("   Username: admin");
  console.log("   Password: admin123");
  console.log("   ⚠️  Cambia la password dopo il primo accesso!");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
