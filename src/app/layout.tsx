import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import type { ReactNode } from "react";
import {
  fontVariables,
  parseRequestId,
  REQUEST_ID_HEADER,
  RequestIdProvider,
  SiteShell,
} from "@/features/shell";
import { documentAttributes, LOCALE } from "@/messages/locale";
import { shell } from "@/messages/shell";
import "@/ui/styles.css";

export const metadata: Metadata = {
  title: { default: shell.productName, template: shell.titleTemplate },
  description: shell.description,
};

export const viewport: Viewport = {
  colorScheme: "dark",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const { lang, dir } = documentAttributes(LOCALE);
  const requestId = parseRequestId((await headers()).get(REQUEST_ID_HEADER));
  return (
    <html lang={lang} dir={dir} className={fontVariables}>
      <body className="flex flex-col">
        <RequestIdProvider requestId={requestId}>
          <SiteShell>{children}</SiteShell>
        </RequestIdProvider>
      </body>
    </html>
  );
}
