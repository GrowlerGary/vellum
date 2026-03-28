import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { NavbarWrapper } from "@/components/layout/Navbar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <div className="flex flex-col min-h-screen bg-[var(--bg)]">
      <NavbarWrapper username={session.user.username} role={session.user.role} />
      <main className="flex-1 mx-auto w-full max-w-7xl px-4 py-8 animate-fade-in">
        {children}
      </main>
    </div>
  );
}
