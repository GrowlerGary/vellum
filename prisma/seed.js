"use strict";
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const db = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL ?? "admin@example.com";
  const password = process.env.ADMIN_PASSWORD ?? "changeme";
  const username = process.env.ADMIN_USERNAME ?? "admin";

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`Admin user already exists: ${email}`);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await db.user.create({
    data: {
      username,
      email,
      passwordHash,
      displayName: "Administrator",
      role: "ADMIN",
      isProfilePublic: false,
    },
  });

  console.log(`Created admin user: ${user.email} (username: ${user.username})`);
  console.log(`Login with email: ${email} and password: ${password}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
