"use client";

import { usePathname } from "next/navigation";
import { catalogCommon } from "@/messages/catalog";
import { Link } from "@/ui";
import { COURSES_PATH } from "../paths";

/**
 * Courses in the header (docs/spec/03-experience.md section 3). It is the
 * current page only on the course list itself: `aria-current="page"` on a
 * course page would name the wrong page.
 */
export function CoursesNavLink() {
  const current = usePathname() === COURSES_PATH;
  return (
    <Link href={COURSES_PATH} variant="nav" current={current}>
      {catalogCommon.coursesLink}
    </Link>
  );
}
