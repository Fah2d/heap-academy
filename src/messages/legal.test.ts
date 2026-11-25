import { describe, expect, it } from "vitest";
import { type LegalDocument, privacy, terms } from "./legal";

function words(content: LegalDocument): string[] {
  return [
    content.title,
    content.description,
    content.updated.text,
    content.intro,
    ...content.sections.flatMap((section) => [
      section.heading,
      ...section.blocks.flatMap((block) => {
        if (block.kind === "paragraph") return [block.text];
        if (block.kind === "list") return block.items;
        return [block.before, block.label, block.after];
      }),
    ]),
  ];
}

const privacyText = words(privacy).join("\n");

describe("legal text", () => {
  for (const content of [privacy, terms]) {
    it(`[FR-SYS-03] dates the ${content.title} with a real day, written out the same`, () => {
      expect(content.updated.iso).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      const day = new Date(`${content.updated.iso}T00:00:00Z`);
      expect(day.toISOString().slice(0, 10)).toBe(content.updated.iso);
      const written = new Intl.DateTimeFormat("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      }).format(day);
      expect(content.updated.text).toBe(written);
    });

    it(`[FR-SYS-03] gives each section of the ${content.title} its own anchor`, () => {
      const ids = content.sections.map((section) => section.id);
      expect(new Set(ids).size).toBe(ids.length);
      for (const id of ids) expect(id).toMatch(/^[a-z]+(-[a-z]+)*$/);
    });

    it(`[FR-SYS-03] writes the ${content.title} without empty text, em dashes or exclamation marks`, () => {
      for (const text of words(content)) {
        expect(text.trim()).not.toBe("");
        expect(text).not.toMatch(/[—!]/);
      }
    });
  }

  // docs/spec/06-security-privacy.md section 7.2: the processors are listed.
  it("[NFR-PRIV-01] names every processor in the privacy policy", () => {
    // The bot check is named by its role until WP-2.2 chooses the vendor.
    for (const name of ["Vercel", "Supabase", "Resend", "bot check service", "Google", "GitHub"]) {
      expect(privacyText, name).toContain(name);
    }
  });

  // Every row of the data inventory in docs/spec/06-security-privacy.md section 7.1.
  it("[NFR-PRIV-01] states each kind of data the inventory lists", () => {
    for (const data of [
      "email address",
      "display name",
      "time zone",
      "code that passed",
      "saved code",
      "counts page views",
      "server logs and error reports",
      "account's ID",
      "encrypted copy",
      "last signed in",
      "network address",
      "your name, your profile picture, and your Google account ID",
      "log of account events",
    ]) {
      expect(privacyText, data).toContain(data);
    }
  });

  it("[FR-SYS-03] links the terms to the privacy policy", () => {
    const links = terms.sections.flatMap((section) =>
      section.blocks.filter((block) => block.kind === "link"),
    );
    expect(links.map((block) => block.href)).toEqual(["/privacy"]);
  });

  it("[T-17] states how long the backups and the deletion email are kept", () => {
    expect(privacyText).toContain("keep it for 7 days");
    expect(privacyText).toContain("delete that email after 8 days");
    expect(privacyText).toContain("anyone can download an encrypted copy");
  });

  // docs/spec/06-security-privacy.md section 7.2.
  it("[FR-SYS-03] says that a learner deletes the account without contacting anyone", () => {
    expect(privacyText).toContain("You can delete your account yourself");
    expect(privacyText).toContain("You do not need to contact anyone");
  });
});
