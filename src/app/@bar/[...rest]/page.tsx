import { CoursesNavLink } from "@/features/catalog";
import { SiteBar } from "@/features/shell";

// Every address but the home page and the workspace: the wordmark and the
// site's pages. A page here, not only a default, so a move inside the app
// from the workspace puts the usual header back.
export default function SiteHeaderBar() {
  return <SiteBar navigation={<CoursesNavLink />} />;
}
