import type { Metadata } from "next";
import { LegalPage } from "@/features/shell";
import { privacy } from "@/messages/legal";

export const metadata: Metadata = {
  title: privacy.title,
  description: privacy.description,
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return <LegalPage content={privacy} />;
}
