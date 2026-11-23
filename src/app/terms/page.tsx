import type { Metadata } from "next";
import { LegalPage } from "@/features/shell";
import { terms } from "@/messages/legal";

export const metadata: Metadata = {
  title: terms.title,
  description: terms.description,
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return <LegalPage content={terms} />;
}
