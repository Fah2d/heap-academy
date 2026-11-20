import type { Metadata } from "next";
import { NotFoundView } from "@/features/shell";
import { notFound } from "@/messages/system";

export const metadata: Metadata = {
  title: notFound.title,
  robots: { index: false },
};

export default function NotFound() {
  return <NotFoundView />;
}
