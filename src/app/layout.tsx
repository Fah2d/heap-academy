import type { Metadata, Viewport } from "next";
import { connection } from "next/server";
import type { ReactNode } from "react";
import { AccountControl } from "@/features/auth";
import { CoursesNavLink, SITE_ORIGIN } from "@/features/catalog";
import { fontVariables, SiteShell } from "@/features/shell";
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
export default async function RootLayout({ children }: { children: ReactNode }) {
  await connection();
  const { lang, dir } = documentAttributes(LOCALE);
  return (
    <html lang={lang} dir={dir} className={fontVariables}>
      <body className="flex flex-col">
        <SiteShell navigation={<CoursesNavLink />} account={<AccountControl />}>
          {children}
        </SiteShell>
      </body>
    </html>
  );
}
