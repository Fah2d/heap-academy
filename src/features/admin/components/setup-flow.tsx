"use client";

import Image from "next/image";
import { useState, useTransition } from "react";
import { ADMIN_PATHS } from "@/domain/admin/gate";
import { secondStep as words } from "@/messages/admin";
import { Button, Notice } from "@/ui";
import type { ActionOutcome } from "../types";
import { type SecondStepAction, SecondStepForm } from "./second-step-form";

// The steps of /admin/setup (docs/spec/03-experience.md section 7.1,
// FR-ADM-02): a press makes the QR code and the key, then the first code
// finishes setup. The factor is made by that press, never by rendering the
// page, so a reload or a prefetch cannot replace the code being scanned.

export type SetupCode = { qrCodeSvg: string; secret: string };

export type StartSetupAction = (input: Record<string, never>) => Promise<ActionOutcome<SetupCode>>;

export type SetupFlowProps = {
  startSetup: StartSetupAction;
  confirmSetup: SecondStepAction;
  navigate?: (path: string) => void;
};

/** The key in groups of four, which authenticator apps accept as typed. */
export function groupKey(secret: string): string {
  return (secret.match(/.{1,4}/g) ?? []).join(" ");
}

export function SetupFlow({
  startSetup,
  confirmSetup,
  navigate = (path) => window.location.assign(path),
}: SetupFlowProps) {
  const [code, setCode] = useState<SetupCode | null>(null);
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();

  function onStart() {
    setFailed(false);
    startTransition(async () => {
      let result: ActionOutcome<SetupCode>;
      try {
        result = await startSetup({});
      } catch {
        result = { ok: false, error: "unavailable" };
      }
      if (result.ok) {
        setCode(result.value);
        return;
      }
      // An app was added in the meantime, in another tab: verify is next.
      if (result.error === "already_enrolled") {
        navigate(ADMIN_PATHS.verify);
        return;
      }
      setCode(null);
      setFailed(true);
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="admin-setup-scan" className="flex flex-col gap-4">
        <h2 id="admin-setup-scan" className="text-lg font-semibold text-text">
          {words.scanHeading}
        </h2>
        {code === null ? (
          <p className="text-base text-text-muted">{words.startHint}</p>
        ) : (
          <>
            <p className="text-base text-text-muted">{words.scanHint}</p>
            <div className="size-(--qr-size) rounded-panel bg-(--qr-background) p-3">
              <Image
                src={`data:image/svg+xml;utf8,${encodeURIComponent(code.qrCodeSvg)}`}
                alt={words.qrAlt}
                width={176}
                height={176}
                unoptimized
                className="size-full"
              />
            </div>
            <dl className="flex flex-col gap-2">
              <dt className="text-base font-medium text-text">{words.manualKeyLabel}</dt>
              <dd className="font-mono text-base break-all text-text">{groupKey(code.secret)}</dd>
            </dl>
          </>
        )}
        {failed && (
          <Notice kind="error" kindLabel={words.errorLabel} announce="assertive">
            {words.setupUnavailable}
          </Notice>
        )}
        {code === null && (
          <div>
            <Button variant="primary" onPress={onStart} isDisabled={pending}>
              {pending ? words.starting : words.start}
            </Button>
          </div>
        )}
      </section>
      {code !== null && (
        <section aria-labelledby="admin-setup-code" className="flex flex-col gap-4">
          <h2 id="admin-setup-code" className="text-lg font-semibold text-text">
            {words.codeHeading}
          </h2>
          <SecondStepForm action={confirmSetup} submitLabel={words.confirm} navigate={navigate} />
        </section>
      )}
    </div>
  );
}
