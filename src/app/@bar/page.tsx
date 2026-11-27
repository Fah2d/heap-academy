import { CoursesNavLink } from "@/features/catalog";
import { SiteBar } from "@/features/shell";

// The home page's header start: the wordmark and the site's pages.
export default function HomeBar() {
  return <SiteBar navigation={<CoursesNavLink />} />;
}
