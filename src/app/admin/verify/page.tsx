import { adminMetadata, VerifyPage } from "@/features/admin";
import { secondStep } from "@/messages/admin";

export function generateMetadata() {
  return adminMetadata(secondStep.verifyTitle);
}

export default function Page() {
  return <VerifyPage />;
}
