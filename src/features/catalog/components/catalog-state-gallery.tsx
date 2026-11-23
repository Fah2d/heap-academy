import type { ReactNode } from "react";
import type { PublishedCourse, PublishedCourseSummary } from "@/content";
import { catalogGallery as m } from "@/messages/gallery";
import { CourseListView } from "./course-list-page";
import { CourseView } from "./course-page";
import { HomeView } from "./home-page";

// Development only (src/app/dev/catalog/page.dev.tsx): the catalog's states
// that the local stack cannot show on demand, so the e2e gallery spec can
// check and photograph them (WP-5.1). The views are the ones the pages use,
// given a fixed answer instead of a read. A read that fails ends on the shared
// error page, which `/dev/error` shows.

// Each example is a whole page in its own frame, as the page draws it, under
// a gallery heading. Every example has its own `h1`, as its page does; the
// gallery's own heading is the only difference from the product.
function Example({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="border-bs border-border">
      <div className="mx-auto max-w-page px-gutter pbs-7">
        <h2 id={id} className="text-lg font-semibold text-text-muted">
          {title}
        </h2>
      </div>
      {children}
    </section>
  );
}

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

export function CatalogStateGallery() {
  return (
    <div className="flex flex-col">
      <div className="mx-auto flex w-full max-w-page flex-col gap-3 px-gutter py-7">
        <p className="text-xl font-semibold text-text">{m.title}</p>
        <p className="max-w-prose text-base text-text-muted">{m.intro}</p>
      </div>
      <Example id="catalog-home-empty" title={m.homeEmpty}>
        <HomeView courses={[]} />
      </Example>
      <Example id="catalog-empty" title={m.listEmpty}>
        <CourseListView courses={[]} />
      </Example>
      <Example id="catalog-rows" title={m.listRows}>
        <CourseListView courses={ROWS} />
      </Example>
      <Example id="catalog-course" title={m.courseNoOutcomes}>
        <CourseView course={COURSE} />
      </Example>
    </div>
  );
}
