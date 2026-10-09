import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { SaasManagementPanel } from "@/components/saas-management-panel";

export default async function SaasPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/login");
  if (session.user.isPlatformAdmin !== true) redirect("/app");
  return <SaasManagementPanel />;
}
