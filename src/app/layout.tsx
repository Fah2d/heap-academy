import type { Metadata, Viewport } from "next";
import { connection } from "next/server";
import type { ReactNode } from "react";
import { AccountControl, accountLessons, guestInvitation } from "@/features/auth";
import { CoursesNavLink, SITE_ORIGIN } from "@/features/catalog";
import { AccountLessonsProvider, GuestInvitationProvider } from "@/features/progress";
import { fontVariables, SiteBar, SiteShell } from "@/features/shell";
import { CspNonceMeta } from "@/features/system";
import { documentAttributes, LOCALE } from "@/messages/locale";
import { shell } from "@/messages/shell";
import "@/ui/styles.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_ORIGIN),
  title: { default: shell.productName, template: shell.titleTemplate },
  description: shell.description,
};

export const viewport: Viewport = {
  colorScheme: "dark",
};

// Every page renders per request, because the script policy's nonce exists
// only at request time and a prerendered page carries none
// (docs/spec/06-security-privacy.md section 5.2). scripts/check-static.mjs
// fails the build on any page that is still prerendered.
//
// The invitation to save progress goes to a guest only (FR-AUTH-07). The
// layout already reads the visitor for the header, once per request, so the
// pages below it never read identity themselves. For the same reason it reads
// a signed-in learner's completed lessons, so pages are rendered with their
// progress (02-architecture.md section 10).
//
// The header's start comes from the `bar` slot (src/app/@bar): the workspace
// has its own compact bar there (docs/spec/03-experience.md section 4).
// Next.js renders a not-found page without the slot, so the site's bar is
// the fallback.
export default async function RootLayout({
  children,
  bar,
}: {
  children: ReactNode;
  bar: ReactNode;
}) {
  await connection();
  const { lang, dir } = documentAttributes(LOCALE);
  const [invitation, lessonIds] = await Promise.all([guestInvitation(), accountLessons()]);
  return (
    <html lang={lang} dir={dir} className={fontVariables}>
      <head>
        <CspNonceMeta />
      </head>
      <body className="flex flex-col">
        <AccountLessonsProvider lessonIds={lessonIds}>
          <GuestInvitationProvider invitation={invitation}>
            <SiteShell
              bar={bar ?? <SiteBar navigation={<CoursesNavLink />} />}
              account={<AccountControl />}
            >
              {children}
            </SiteShell>
          </GuestInvitationProvider>
        </AccountLessonsProvider>
      </body>
    </html>
  );
}
