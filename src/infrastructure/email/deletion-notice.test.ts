import { describe, expect, it, vi } from "vitest";
import { sendDeletionNotice } from "./deletion-notice";

vi.mock("server-only", () => ({}));

const settings = {
  resendKey: "re_example",
  noticeFrom: "notices@example.com",
  noticeTo: "owner@example.com",
};

describe("[T-17] the deletion notice", () => {
  it("carries the user ID and nothing else about the person", async () => {
    const send = vi.fn<typeof fetch>().mockResolvedValue(new Response("{}", { status: 200 }));
    await expect(sendDeletionNotice(settings, "user-1", send)).resolves.toBe("sent");
    const [url, init] = send.mock.calls[0] ?? [];
    expect(url).toBe("https://api.resend.com/emails");
    expect(init?.headers).toMatchObject({ authorization: "Bearer re_example" });
    expect(JSON.parse(init?.body as string)).toEqual({
      from: "notices@example.com",
      to: ["owner@example.com"],
      subject: "Account deleted",
      text: "user-1",
    });
  });

  it("reports a refusal and a network failure without throwing", async () => {
    const refused = vi.fn<typeof fetch>().mockResolvedValue(new Response("", { status: 422 }));
    const broken = vi.fn<typeof fetch>().mockRejectedValue(new TypeError("fetch failed"));
    await expect(sendDeletionNotice(settings, "user-1", refused)).resolves.toBe("failed");
    await expect(sendDeletionNotice(settings, "user-1", broken)).resolves.toBe("failed");
  });
});
