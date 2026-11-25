import { adminMetadata, SetupPage } from "@/features/admin";
import { secondStep } from "@/messages/admin";

export function generateMetadata() {
  return adminMetadata(secondStep.setupTitle);
}

export default function Page() {
  return <SetupPage />;
}
