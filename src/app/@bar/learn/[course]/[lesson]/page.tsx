import { CoursesNavLink, lessonBar } from "@/features/catalog";
import { LessonBar, SiteBar } from "@/features/shell";

type Params = Promise<{ course: string; lesson: string }>;

// The workspace's compact bar (docs/spec/03-experience.md section 4), or the
// usual header where the address shows the not-found or error page.
export default async function WorkspaceBar({ params }: { params: Params }) {
  const bar = await lessonBar(params);
  if (bar === null) return <SiteBar navigation={<CoursesNavLink />} />;
  return <LessonBar back={bar.back} title={bar.title} />;
}
