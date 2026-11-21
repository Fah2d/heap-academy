import Image from "next/image";
import { redirect } from "next/navigation";
import { ADMIN_PATHS } from "@/domain/admin/gate";
import { supabaseSecondStep } from "@/infrastructure/auth/second-step";
import { createSessionClient } from "@/infrastructure/db/session-client";
import { secondStep as words } from "@/messages/admin";
import { Notice } from "@/ui";
import { confirmSetup } from "../server/actions";
import { requireAdminStage } from "../server/gate";
import { SecondStepForm } from "./second-step-form";

// `/admin/setup` (docs/spec/03-experience.md section 7.1, FR-ADM-02): a QR
// code and a manual key, then the first code. Shown only to an admin with no
// authenticator app yet. Each visit replaces any unfinished setup, so the
// page never piles up factors.

const ISSUER = "Heap Academy";

export async function SetupPage() {
  await requireAdminStage("setup");
  const db = await createSessionClient("read-only");
  const enrollment = await supabaseSecondStep(db.auth.mfa).startEnrollment(ISSUER);
  // An app was added in the meantime, in another tab: verify is the next step.
  if (!enrollment.ok && enrollment.reason === "already_enrolled") redirect(ADMIN_PATHS.verify);

  return (
    <section aria-labelledby="admin-setup" className="flex max-w-prose flex-col gap-6">
      <div className="flex flex-col gap-3">
        <h1 id="admin-setup" className="text-xl font-semibold text-text">
          {words.setupTitle}
        </h1>
        <p className="text-base text-text-muted">{words.setupIntro}</p>
      </div>
      {enrollment.ok ? (
        <>
          <section aria-labelledby="admin-setup-scan" className="flex flex-col gap-4">
            <h2 id="admin-setup-scan" className="text-lg font-semibold text-text">
              {words.scanHeading}
            </h2>
            <p className="text-base text-text-muted">{words.scanHint}</p>
            <div className="size-(--qr-size) rounded-panel bg-(--qr-background) p-3">
              <Image
                src={`data:image/svg+xml;utf8,${encodeURIComponent(enrollment.qrCodeSvg)}`}
                alt={words.qrAlt}
                width={176}
                height={176}
                unoptimized
                className="size-full"
              />
            </div>
            <div className="flex flex-col gap-2">
              <p className="text-base font-medium text-text">{words.manualKeyLabel}</p>
              <code className="font-mono text-base break-all text-text">{enrollment.secret}</code>
            </div>
          </section>
          <section aria-labelledby="admin-setup-code" className="flex flex-col gap-4">
            <h2 id="admin-setup-code" className="text-lg font-semibold text-text">
              {words.codeHeading}
            </h2>
            <SecondStepForm action={confirmSetup} submitLabel={words.confirm} />
          </section>
        </>
      ) : (
        <Notice kind="error" kindLabel={words.errorLabel}>
          {words.setupUnavailable}
        </Notice>
      )}
    </section>
  );
}
