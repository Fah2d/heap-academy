// The privacy policy and the terms (FR-SYS-03). Drafted in WP-6.3 from the
// data inventory and the processors of docs/spec/06-security-privacy.md
// section 7; the owner approves the words before they are published, because
// they are his statement (section 8).

/** A paragraph, or a list of short items. */
export type LegalBlock =
  | { readonly kind: "paragraph"; readonly text: string }
  | { readonly kind: "list"; readonly items: readonly string[] };

export type LegalSection = {
  /** The section's id, for its heading's anchor. Lower case and hyphens. */
  readonly id: string;
  readonly heading: string;
  readonly blocks: readonly LegalBlock[];
};

export type LegalDocument = {
  /** The page title and the `h1`. */
  readonly title: string;
  /** The search result description. */
  readonly description: string;
  /** When the text last changed: an ISO date for `<time>`, and the words shown. */
  readonly updated: { readonly iso: string; readonly text: string };
  readonly intro: string;
  readonly sections: readonly LegalSection[];
};

function paragraph(text: string): LegalBlock {
  return { kind: "paragraph", text };
}

function list(...items: string[]): LegalBlock {
  return { kind: "list", items };
}

export const legal = {
  updatedLabel: "Last updated",
} as const;

export const privacy: LegalDocument = {
  title: "Privacy policy",
  description:
    "What Heap Academy keeps about you, why, where, and for how long, and how to delete it.",
  updated: { iso: "2026-11-23", text: "23 November 2026" },
  intro:
    "This page lists everything Heap Academy keeps about you, why we keep it, where it is kept, and for how long. We keep nothing that is not on this page.",
  sections: [
    {
      id: "guests",
      heading: "Learning without an account",
      blocks: [
        paragraph(
          "You can read lessons and run code without an account. Your code runs in your own browser, not on our servers.",
        ),
        paragraph(
          "As a guest, your saved code and your progress stay in your browser. We do not receive them. They stay until you clear this site's data in your browser.",
        ),
      ],
    },
    {
      id: "account",
      heading: "When you have an account",
      blocks: [
        paragraph("When you create an account, we keep:"),
        list(
          "Your email address, so that you can sign in. Our sign-in provider keeps it.",
          "Your display name, which you see on your profile and can change.",
          "Your time zone, which your browser tells us, so that a streak day starts and ends at your midnight.",
          "Each lesson you complete, with the code that passed its tests, so that your progress is the same on every device you use.",
        ),
        paragraph("We keep these until you delete your account."),
        paragraph(
          "When you sign in, your browser stores a cookie that keeps you signed in. We do not use cookies for advertising or to follow you to other sites.",
        ),
      ],
    },
    {
      id: "every-visitor",
      heading: "What every visit leaves",
      blocks: [
        list(
          "Page views are counted by our hosting provider without cookies. The count holds no email address, name, code, or text that you typed. The provider decides how long it keeps the count.",
          "Our hosting provider keeps server logs and error reports, so that we can find and fix problems. A log entry can include your network address and the page you asked for. The provider decides how long it keeps them.",
        ),
      ],
    },
    {
      id: "processors",
      heading: "Who handles your data for us",
      blocks: [
        list(
          "Vercel hosts the site, counts page views, and keeps the server logs.",
          "Supabase holds the database and handles sign-in.",
          "Resend sends the email with your sign-in code.",
          "Cloudflare runs the check, called Turnstile, that you are a person when you ask for a sign-in code.",
          "Google tells us your email address, but only if you choose to sign in with Google.",
          "GitHub stores the encrypted backups described below.",
        ),
        paragraph("We do not sell your data, and we show no advertising."),
      ],
    },
    {
      id: "backups",
      heading: "Backups",
      blocks: [
        paragraph(
          "Each night we make an encrypted copy of the database and keep it for 7 days, so that we can recover from a failure. Only the owner of Heap Academy has the key that opens it.",
        ),
        paragraph(
          "The code of this site is public, and the encrypted copies are stored with it. This means that anyone can download an encrypted copy and keep it after we delete ours. Without the key, it is encrypted data and not readable text.",
        ),
      ],
    },
    {
      id: "deleting",
      heading: "Deleting your account",
      blocks: [
        paragraph(
          "You can delete your account yourself, on your profile page. You do not need to contact anyone. Deleting it erases your email address, display name, time zone, and completed lessons with their code.",
        ),
        paragraph(
          "When you delete your account, the owner receives one email with the account's ID, and no name or email address. If we ever have to restore a backup, this ID lets us delete your account from it again. The owner deletes that email after 8 days, when no backup with your data is left.",
        ),
        paragraph(
          "Code and progress saved in your browser stay there until you clear this site's data in your browser.",
        ),
      ],
    },
    {
      id: "not-collected",
      heading: "What we do not collect",
      blocks: [
        paragraph(
          "We do not collect advertising identifiers or contact lists, and we do not ask for your location. Your time zone tells us roughly where you are, and nothing more.",
        ),
      ],
    },
    {
      id: "changes",
      heading: "Changes to this policy",
      blocks: [
        paragraph(
          "If this policy changes, the date at the top of this page changes with it. The new text applies from that date.",
        ),
      ],
    },
  ],
};

export const terms: LegalDocument = {
  title: "Terms of use",
  description: "The rules for using Heap Academy, its lessons, and your account.",
  updated: { iso: "2026-11-23", text: "23 November 2026" },
  intro: "These terms apply when you use Heap Academy. By using the site, you agree to them.",
  sections: [
    {
      id: "service",
      heading: "What Heap Academy is",
      blocks: [
        paragraph(
          "Heap Academy is a set of short Python lessons that you read, write, and run in your browser. It is free to use.",
        ),
      ],
    },
    {
      id: "age",
      heading: "Who can create an account",
      blocks: [paragraph("You must be at least 13 years old to create an account.")],
    },
    {
      id: "account",
      heading: "Your account",
      blocks: [
        list(
          "Only you may use your account. Keep the email account that you sign in with safe, because anyone who can read it can sign in as you.",
          "You can delete your account at any time on your profile page.",
          "We may close an account that breaks these terms.",
        ),
      ],
    },
    {
      id: "code",
      heading: "Your code",
      blocks: [
        paragraph(
          "The code you write is yours. When you complete a lesson with an account, we keep the code that passed, to show your progress. The privacy policy explains what we keep and how to delete it.",
        ),
      ],
    },
    {
      id: "lessons",
      heading: "Our lessons",
      blocks: [
        paragraph(
          "The lessons, their text, and their test cases belong to Heap Academy. You may use them to learn. Do not copy them to publish somewhere else.",
        ),
      ],
    },
    {
      id: "rules",
      heading: "Rules for using the site",
      blocks: [
        list(
          "Do not try to get into other people's accounts or into the parts of the site that are not open to you.",
          "Do not try to overload the site, or get around its limits and protections.",
          "Do not use the site to attack other people, other sites, or other systems.",
        ),
      ],
    },
    {
      id: "no-guarantee",
      heading: "No guarantee",
      blocks: [
        paragraph(
          "We work to keep the site running and the lessons correct, but we cannot promise that the site is always available or that it has no mistakes. You use it as it is. We may change the site, or stop offering it.",
        ),
      ],
    },
    {
      id: "changes",
      heading: "Changes to these terms",
      blocks: [
        paragraph(
          "If these terms change, the date at the top of this page changes with it. If you keep using the site after that date, the new terms apply to you.",
        ),
      ],
    },
  ],
};
