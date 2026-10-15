import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { DatabaseAdminPanel } from "@/components/database-admin-panel";

export default async function DatabasePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/login");
  if (session.user.isPlatformAdmin !== true) redirect("/app");
  return <DatabaseAdminPanel />;
}
