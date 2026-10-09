import { Sidebar } from "@/components/layout/sidebar";
import { AccountPreferencesSync } from "@/components/account-preferences-sync";
import { Header } from "@/components/layout/header";
import { Toaster } from "@/components/ui/sonner";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/login");

  return (
    <div data-tradepilot-app>
      <AccountPreferencesSync />
      <Sidebar />
      <Header />
      <main className="min-h-screen pt-[60px] md:pl-[248px]">
        <div className="app-content">{children}</div>
      </main>
      <Toaster />
    </div>
  );
}
