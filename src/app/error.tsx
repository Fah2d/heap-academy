"use client";

import { ErrorView } from "@/features/shell";
import { errorPage } from "@/messages/system";
import { pageTitle } from "@/messages/shell";

export default function Error({ error, retry }: { error: unknown; retry: () => void }) {
  return (
    <>
      <title>{pageTitle(errorPage.title)}</title>
      <ErrorView error={error} retry={retry} />
    </>
  );
}
