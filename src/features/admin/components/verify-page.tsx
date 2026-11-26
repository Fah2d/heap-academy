import { secondStep as words } from "@/messages/admin";
import { verifySecondStep } from "../server/actions";
import { requireAdminStage } from "../server/gate";
import { SecondStepForm } from "./second-step-form";

/**
 * `/admin/verify` (docs/spec/03-experience.md section 7.1, FR-ADM-02): one
 * field for the six-digit code, at the start of each admin session.
 */
export async function VerifyPage() {
  await requireAdminStage("verify");
  return (
    <section aria-labelledby="admin-verify" className="flex max-w-prose flex-col gap-6">
      <div className="flex flex-col gap-3">
        <h1 id="admin-verify" className="text-xl font-semibold text-text">
          {words.verifyTitle}
        </h1>
        <p className="text-base text-text-muted">{words.verifyIntro}</p>
      </div>
      <SecondStepForm action={verifySecondStep} submitLabel={words.verify} autoFocus />
    </section>
  );
}
