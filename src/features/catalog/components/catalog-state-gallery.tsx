import type { ReactNode } from "react";
import type { PublishedCourse, PublishedCourseSummary } from "@/content";
import { catalogGallery as m } from "@/messages/gallery";
import { CatalogPage } from "./catalog-page";
import { CourseLoadFailed, CourseView } from "./course-page";
import { CourseRows } from "./course-rows";

// Development only (src/app/dev/catalog/page.dev.tsx): the catalog's states
// that the local stack cannot show on demand, so the e2e gallery spec can
// check and photograph them (WP-5.1). The views are the ones the pages use,
// given a fixed answer instead of a read.

function Example({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-4">
      <h2 id={id} className="text-lg font-semibold text-text">
        {title}
      </h2>
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
    <div className="flex flex-col gap-7">
      <CatalogPage>
        <div className="flex flex-col gap-3">
          <h1 className="text-xl font-semibold text-text">{m.title}</h1>
          <p className="max-w-prose text-base text-text-muted">{m.intro}</p>
        </div>
        <Example id="catalog-empty" title={m.listEmpty}>
          <CourseRows result={{ ok: true, value: [] }} labelledBy="catalog-empty" titleLevel={3} />
        </Example>
        <Example id="catalog-failed" title={m.listFailed}>
          <CourseRows result={{ ok: false }} labelledBy="catalog-failed" titleLevel={3} />
        </Example>
        <Example id="catalog-rows" title={m.listRows}>
          <CourseRows result={{ ok: true, value: ROWS }} labelledBy="catalog-rows" titleLevel={3} />
        </Example>
      </CatalogPage>
      <section aria-labelledby="catalog-course-failed">
        <div className="mx-auto max-w-page px-gutter">
          <h2 id="catalog-course-failed" className="text-lg font-semibold text-text">
            {m.courseFailed}
          </h2>
        </div>
        <CourseLoadFailed />
      </section>
      <section aria-labelledby="catalog-course">
        <div className="mx-auto max-w-page px-gutter">
          <h2 id="catalog-course" className="text-lg font-semibold text-text">
            {m.courseNoOutcomes}
          </h2>
        </div>
        <CourseView course={COURSE} />
      </section>
    </div>
  );
}
