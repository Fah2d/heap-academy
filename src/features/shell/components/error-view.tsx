"use client";

import { useEffect, useRef, useState } from "react";
import { reportedRoute } from "@/domain/client-error";
import { errorPage } from "@/messages/system";
import { Button, Link } from "@/ui";
import { type ErrorReporter, reportClientError } from "../client/report-client-error";
import { SystemPage } from "./system-page";

/**
 * The digest of an error from the server, which Next.js writes to the server
 * log with the error (FR-SYS-01, NFR-OBS-01). An error in the browser has
 * none.
 */
export function errorReference(error: unknown): string | undefined {
  if (error instanceof Error && "digest" in error && typeof error.digest === "string") {
    if (error.digest !== "") return error.digest;
  }
  return undefined;
}

/**
 * The reference a learner can keep. For a server error it is the digest. A
 * browser error is reported to /api/client-error as `unexpected-exception`,
 * and the reference is the request ID the server logged the report under; it
 * appears once the report is stored, and not at all if it fails. Each error
 * is reported once, also when React runs the effect twice in development.
 */
function useReference(error: unknown, report: ErrorReporter): string | undefined {
  const digest = errorReference(error);
  const sent = useRef<{ error: unknown; reference: Promise<string | undefined> } | undefined>(
    undefined,
  );
  const [reported, setReported] = useState<{ error: unknown; reference: string } | undefined>(
    undefined,
  );

  useEffect(() => {
    if (digest !== undefined) return;
    let pending = sent.current;
    if (pending === undefined || pending.error !== error) {
      pending = {
        error,
        reference: report({
          code: "unexpected-exception",
          route: reportedRoute(window.location.pathname),
        }),
      };
      sent.current = pending;
    }
    let current = true;
    void pending.reference.then((reference) => {
      if (current && reference !== undefined) setReported({ error, reference });
    });
    return () => {
      current = false;
    };
  }, [error, digest, report]);

  if (digest !== undefined) return digest;
  return reported !== undefined && reported.error === error ? reported.reference : undefined;
}

export function ErrorView({
  error,
  retry,
  report = reportClientError,
}: {
  error: unknown;
  retry: () => void;
  report?: ErrorReporter;
}) {
  const reference = useReference(error, report);
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
