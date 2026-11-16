"use client";

import { errorPage } from "@/messages/system";
import { Button, Link } from "@/ui";
import { SystemPage } from "./system-page";

/**
 * The reference a learner can keep (FR-SYS-01, NFR-OBS-01): the digest of an
 * error from the server, which Next.js writes to the server log with the
 * error. An error in the browser is logged nowhere until the client error
 * report exists, so it gets no reference (owner's decision on pull request #3).
 */
export function errorReference(error: unknown): string | undefined {
  if (error instanceof Error && "digest" in error && typeof error.digest === "string") {
    if (error.digest !== "") return error.digest;
  }
  return undefined;
}

export function ErrorView({ error, retry }: { error: unknown; retry: () => void }) {
  const reference = errorReference(error);
  return (
    <SystemPage heading={errorPage.heading} body={errorPage.body}>
      <Button variant="primary" onPress={retry}>
        {errorPage.retry}
      </Button>
      <Link href="/" variant="standalone">
        {errorPage.homeLink}
      </Link>
      {reference !== undefined && (
        <div className="flex basis-full flex-col gap-1 text-sm text-text-muted">
          <p>{errorPage.referenceHint}</p>
          <p>
            {errorPage.referenceLabel}{" "}
            <code className="break-all text-text select-all">{reference}</code>
          </p>
        </div>
      )}
    </SystemPage>
  );
}
