import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { Metadata } from "next";
import AdminPageClient from "./AdminPageClient";

export const metadata: Metadata = { title: "Admin" };

export default async function AdminPage() {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") redirect("/dashboard");

  const rawUsers = await db.user.findMany({
    select: {
      id: true, username: true, email: true,
      displayName: true, role: true, createdAt: true,
      _count: { select: { entries: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const users = rawUsers.map((u) => ({ ...u, createdAt: u.createdAt.toISOString() }));

  return <AdminPageClient initialUsers={users} />;
}
