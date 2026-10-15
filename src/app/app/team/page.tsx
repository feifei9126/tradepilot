import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { TeamManagementPanel } from "@/components/team-management-panel";

export default async function TeamPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/login");
  if (session.user.role !== "owner" && session.user.role !== "admin") redirect("/app");

  return <TeamManagementPanel currentUserId={session.user.id} role={session.user.role} />;
}
