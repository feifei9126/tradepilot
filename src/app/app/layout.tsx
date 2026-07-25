import { Sidebar } from "@/components/layout/sidebar";
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
  if (!session?.user) redirect("/auth/login");

  return (
    <div data-tradepilot-app>
      <Sidebar />
      <Header />
      <main className="min-h-screen pt-[60px] md:pl-[248px]">
        <div className="app-content">{children}</div>
      </main>
      <Toaster />
    </div>
  );
}
