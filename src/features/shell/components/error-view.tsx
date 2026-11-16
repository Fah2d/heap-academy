"use client";

import { errorPage } from "@/messages/system";
import { Button, Link } from "@/ui";
import { useRequestId } from "./request-id-context";
import { SystemPage } from "./system-page";

/**
 * The reference a learner can quote (FR-SYS-01, NFR-OBS-01). An error from
 * the server carries a digest, which Next.js writes to the server log with
 * the error. Otherwise the reference is the ID of the request that rendered
 * the page, which the server log also carries.
 */
export function errorReference(error: unknown, requestId: string | undefined): string | undefined {
  if (error instanceof Error && "digest" in error && typeof error.digest === "string") {
    if (error.digest !== "") return error.digest;
  }
  return requestId;
}

export function ErrorView({ error, retry }: { error: unknown; retry: () => void }) {
  const reference = errorReference(error, useRequestId());
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
