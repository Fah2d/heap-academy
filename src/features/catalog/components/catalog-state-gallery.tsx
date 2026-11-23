import type { ReactNode } from "react";
import type { PublishedCourse, PublishedCourseSummary } from "@/content";
import { catalogGallery as m } from "@/messages/gallery";
import { Link } from "@/ui";
import { CourseListView } from "./course-list-page";
import { CourseView } from "./course-page";
import { HomeView } from "./home-page";

// Development only (src/app/dev/catalog/page.dev.tsx): the catalog's states
// that the local stack cannot show on demand, so the e2e gallery spec can
// check and photograph them (WP-5.1). The views are the ones the pages use,
// given a fixed answer instead of a read. A read that fails ends on the shared
// error page, which `/dev/error` shows.
//
// Each state has its own address and is drawn alone, exactly as its page
// draws it, so a screen or an axe check sees the real page and nothing else.

const ROWS: PublishedCourseSummary[] = [
  { slug: "python-basics", title: m.sampleCourse, summary: m.sampleSummary, lessonCount: 3 },
  { slug: "text-files", title: m.longCourse, summary: m.longSummary, lessonCount: 1 },
];

const COURSE: PublishedCourse = {
  slug: "python-basics",
  title: m.sampleCourse,
  summary: m.sampleSummary,
  outcomes: [],
  chapters: [
    {
      id: "5eed0000-0000-4000-8000-000000000501",
      title: m.firstChapter,
      summary: m.firstChapterSummary,
      lessons: [
        { slug: "hello", title: m.lessonHello },
        { slug: "names", title: m.lessonNames },
      ],
    },
    {
      id: "5eed0000-0000-4000-8000-000000000502",
      title: m.secondChapter,
      summary: "",
      lessons: [{ slug: "sums", title: m.lessonSums }],
    },
  ],
};

const STATES: { state: string; label: string; view: () => ReactNode }[] = [
  { state: "home-empty", label: m.homeEmpty, view: () => <HomeView courses={[]} /> },
  { state: "list-empty", label: m.listEmpty, view: () => <CourseListView courses={[]} /> },
  { state: "list-rows", label: m.listRows, view: () => <CourseListView courses={ROWS} /> },
  { state: "course", label: m.courseNoOutcomes, view: () => <CourseView course={COURSE} /> },
];

export const CATALOG_STATE_PATH = "/dev/catalog";

/** One state drawn alone when `state` names one; otherwise the list of states. */
export function CatalogStateGallery({ state }: { state?: string | undefined }) {
  const chosen = STATES.find((entry) => entry.state === state);
  if (chosen !== undefined) return chosen.view();
  return (
    <div className="mx-auto flex max-inline-page flex-col gap-5 px-gutter py-7">
      <h1 className="text-xl font-semibold text-text">{m.title}</h1>
      <p className="max-inline-prose text-base text-text-muted">{m.intro}</p>
      <ul className="flex flex-col gap-1">
        {STATES.map((entry) => (
          <li key={entry.state}>
            <Link href={`${CATALOG_STATE_PATH}?state=${entry.state}`} variant="standalone">
              {entry.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
