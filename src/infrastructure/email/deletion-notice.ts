import "server-only";
import { fetchWithin } from "@/infrastructure/http/fetch-within";

// The one email a deletion sends the owner: the deleted user's ID and
// nothing else, so a restore from backup can delete it again (ADR-0030, T-17).

const ENDPOINT = "https://api.resend.com/emails";
const SEND_TIMEOUT_MS = 5000;

export type NoticeSettings = { resendKey: string; noticeFrom: string; noticeTo: string };

export async function sendDeletionNotice(
  settings: NoticeSettings,
  userId: string,
  send: typeof fetch = fetchWithin(SEND_TIMEOUT_MS),
): Promise<"sent" | "failed"> {
  try {
    const response = await send(ENDPOINT, {
      method: "POST",
      headers: {
        authorization: `Bearer ${settings.resendKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from: settings.noticeFrom,
        to: [settings.noticeTo],
        subject: "Account deleted",
        text: userId,
      }),
    });
    return response.ok ? "sent" : "failed";
  } catch {
    // The account is already gone; the caller logs the failure.
    return "failed";
  }
}
