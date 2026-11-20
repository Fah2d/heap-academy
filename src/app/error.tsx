"use client";

import { ErrorView } from "@/features/shell";
import { errorPage } from "@/messages/system";
import { shell } from "@/messages/shell";

export default function Error({ error, retry }: { error: unknown; retry: () => void }) {
  return (
    <>
      <title>{`${errorPage.title} | ${shell.productName}`}</title>
      <ErrorView error={error} retry={retry} />
    </>
  );
}
