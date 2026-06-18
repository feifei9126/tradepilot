import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { Toaster } from "@/components/ui/sonner";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-muted/30">
      <Sidebar />
      <Header />
      <main className="pl-56 pt-14">
        <div className="p-6">{children}</div>
      </main>
      <Toaster />
    </div>
  );
}
