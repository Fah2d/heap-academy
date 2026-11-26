import { pageTitle } from "@/messages/shell";
import { errorPage } from "@/messages/system";
import { ErrorView } from "./error-view";
import { SiteFooter } from "./site-footer";

/**
 * What the page that replaces a failed root layout shows inside its own
 * `<body>`: the title, the error in the main landmark, and the footer, so the
 * legal links are on this page too (FR-SYS-03).
 */
export function GlobalErrorBody({ error, retry }: { error: unknown; retry: () => void }) {
  return (
    <>
      <title>{pageTitle(errorPage.title)}</title>
      <main id="main" className="flex-1">
        <ErrorView error={error} retry={retry} />
      </main>
      <SiteFooter />
    </>
  );
}
