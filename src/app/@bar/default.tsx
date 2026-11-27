import { CoursesNavLink } from "@/features/catalog";
import { SiteBar } from "@/features/shell";

// The header's start on any page the slot has no page for (docs/spec/03-experience.md section 4).
export default function DefaultBar() {
  return <SiteBar navigation={<CoursesNavLink />} />;
}
