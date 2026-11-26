"use client";

import { fontVariables, GlobalErrorBody } from "@/features/shell";
import { documentAttributes, LOCALE } from "@/messages/locale";
import "@/ui/styles.css";

// Replaces the root layout when the layout itself fails, so it brings its own
// document, styles, and fonts.
export default function GlobalError({ error, retry }: { error: unknown; retry: () => void }) {
  const { lang, dir } = documentAttributes(LOCALE);
  return (
    <html lang={lang} dir={dir} className={fontVariables}>
      <body className="flex flex-col">
        <GlobalErrorBody error={error} retry={retry} />
      </body>
    </html>
  );
}
