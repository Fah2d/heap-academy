"use client";

import { ErrorView, fontVariables } from "@/features/shell";
import { documentAttributes, LOCALE } from "@/messages/locale";
import { shell } from "@/messages/shell";
import { errorPage } from "@/messages/system";
import "@/ui/styles.css";

// Replaces the root layout when the layout itself fails, so it brings its own
// document, styles, and fonts. Without the layout there is no request ID, so
// the reference is the server's digest when there is one.
export default function GlobalError({ error, retry }: { error: unknown; retry: () => void }) {
  const { lang, dir } = documentAttributes(LOCALE);
  return (
    <html lang={lang} dir={dir} className={fontVariables}>
      <body>
        <title>{`${errorPage.title} | ${shell.productName}`}</title>
        <main id="main">
          <ErrorView error={error} retry={retry} />
        </main>
      </body>
    </html>
  );
}
