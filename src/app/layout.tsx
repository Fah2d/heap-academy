import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { fontVariables, SiteShell } from "@/features/shell";
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

export default function RootLayout({ children }: { children: ReactNode }) {
  const { lang, dir } = documentAttributes(LOCALE);
  return (
    <html lang={lang} dir={dir} className={fontVariables}>
      <body className="flex flex-col">
        <SiteShell>{children}</SiteShell>
      </body>
    </html>
  );
}
