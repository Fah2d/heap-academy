import type { Metadata } from "next";
import { notFound as notFoundWords } from "@/messages/system";
import { adminGateDecision } from "../server/gate";

/**
 * The metadata of an admin page. A stranger gets the not-found page's title,
 * so not even the tab names the admin area (FR-ADM-01). The admin area is
 * never a search result.
 */
export async function adminMetadata(title: string): Promise<Metadata> {
  const decision = await adminGateDecision();
  return {
    title: decision === "not_found" ? notFoundWords.title : title,
    robots: { index: false, follow: false },
  };
}
