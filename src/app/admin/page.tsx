import { adminMetadata, DashboardPage } from "@/features/admin";
import { dashboard } from "@/messages/admin";

export function generateMetadata() {
  return adminMetadata(dashboard.title);
}

export default function Page() {
  return <DashboardPage />;
}
