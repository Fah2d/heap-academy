import { notFound } from "@/messages/system";
import { Link } from "@/ui";
import { SystemPage } from "./system-page";

/** FR-SYS-01: says nothing is at this address and offers the home page. */
export function NotFoundView() {
  return (
    <SystemPage heading={notFound.heading} body={notFound.body}>
      <Link href="/" variant="standalone">
        {notFound.homeLink}
      </Link>
    </SystemPage>
  );
}
