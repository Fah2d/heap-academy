import { secondStep as words } from "@/messages/admin";
import { confirmSetup, startSetup } from "../server/actions";
import { requireAdminStage } from "../server/gate";
import { SetupFlow } from "./setup-flow";

/**
 * `/admin/setup` (docs/spec/03-experience.md section 7.1, FR-ADM-02): shown
 * only to an admin with no authenticator app yet. Rendering it changes
 * nothing; the QR code is made when the admin asks for it.
 */
export async function SetupPage() {
  await requireAdminStage("setup");
  return (
    <section aria-labelledby="admin-setup" className="flex max-w-prose flex-col gap-6">
      <div className="flex flex-col gap-3">
        <h1 id="admin-setup" className="text-xl font-semibold text-text">
          {words.setupTitle}
        </h1>
        <p className="text-base text-text-muted">{words.setupIntro}</p>
      </div>
      <SetupFlow startSetup={startSetup} confirmSetup={confirmSetup} />
    </section>
  );
}
