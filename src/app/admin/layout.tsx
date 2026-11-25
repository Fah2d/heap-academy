import type { ReactNode } from "react";
import { AdminFrame, requireAdminList } from "@/features/admin";

// Every /admin address: anyone not on the admin list gets the standard
// not-found page (FR-ADM-01). Each page runs the guard again for its stage.
export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireAdminList();
  return <AdminFrame>{children}</AdminFrame>;
}
