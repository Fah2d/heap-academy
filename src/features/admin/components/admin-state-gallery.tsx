"use client";

import type { ReactNode } from "react";
import { adminGallery as m } from "@/messages/gallery";
import { secondStep } from "@/messages/admin";
import type { EditorCourse } from "../types";
import { CourseEditor } from "./course-editor";
import { CourseList } from "./course-list";
import { NewCourseForm } from "./new-course-form";
import { SecondStepForm } from "./second-step-form";
import { SetupFlow } from "./setup-flow";

// Development only (src/app/dev/admin/page.dev.tsx): each state of the admin
// views that the J-12 journey cannot reach, with fake actions, so the e2e
// gallery spec can check and photograph them (WP-2.3 design review 1).

function Example({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex max-w-prose flex-col gap-4">
      <h2 id={id} className="text-lg font-semibold text-text">
        {title}
      </h2>
      {children}
    </section>
  );
}

const never = () => new Promise<never>(() => undefined);
const refuse = (error: string) => () => Promise.resolve({ ok: false as const, error });
const stay = () => undefined;

const COURSE_ID = "5eed0000-0000-4000-8000-000000000001";

const refusingCourse: EditorCourse = {
  id: COURSE_ID,
  slug: "sample-course",
  title: m.sampleCourse,
  summary: m.sampleSummary,
  outcomes: [],
  status: "draft",
  loadedAt: "2026-11-21T08:00:00.000000+00:00",
  chapters: [
    {
      id: "5eed0000-0000-4000-8000-000000000101",
      title: m.sampleChapter,
      summary: "",
      lessons: [
        { id: "5eed0000-0000-4000-8000-000000000201", title: m.sampleLesson, status: "draft" },
      ],
    },
    {
      id: "5eed0000-0000-4000-8000-000000000102",
      title: m.secondChapter,
      summary: "",
      lessons: [],
    },
  ],
};

export function AdminStateGallery() {
  return (
    <div className="flex flex-col gap-7">
      <div className="flex flex-col gap-3">
        <h1 className="text-xl font-semibold text-text">{m.title}</h1>
        <p className="max-w-prose text-base text-text-muted">{m.intro}</p>
      </div>
      <Example id="gallery-empty" title={m.courseListEmpty}>
        <CourseList result={{ ok: true, courses: [] }} reorder={never} refresh={stay} />
      </Example>
      <Example id="gallery-failed" title={m.courseListFailed}>
        <CourseList result={{ ok: false }} reorder={never} refresh={stay} />
      </Example>
      <Example id="gallery-rows" title={m.courseListRows}>
        <CourseList
          result={{
            ok: true,
            courses: [
              {
                id: COURSE_ID,
                slug: "sample-course",
                title: m.sampleCourse,
                status: "published",
                publishedLessons: 1,
                draftLessons: 0,
              },
              {
                id: "5eed0000-0000-4000-8000-000000000002",
                slug: "second-course",
                title: m.secondCourse,
                status: "draft",
                publishedLessons: 0,
                draftLessons: 2,
              },
            ],
          }}
          reorder={refuse("cannot_move")}
          refresh={stay}
        />
      </Example>
      <Example id="gallery-editor-refusing" title={m.editorRefusing}>
        <CourseEditor
          course={refusingCourse}
          saveCourse={refuse("stale")}
          setStatus={refuse("no_published_lesson")}
          saveChapter={refuse("unavailable")}
          deleteChapter={refuse("unavailable")}
          reorder={refuse("cannot_move")}
          refresh={stay}
        />
      </Example>
      <Example id="gallery-editor-empty" title={m.editorEmpty}>
        <CourseEditor
          course={{ ...refusingCourse, chapters: [] }}
          saveCourse={never}
          setStatus={never}
          saveChapter={never}
          deleteChapter={never}
          reorder={never}
          refresh={stay}
        />
      </Example>
      <Example id="gallery-new-course" title={m.newCourse}>
        <NewCourseForm saveCourse={never} navigate={stay} />
      </Example>
      <Example id="gallery-setup" title={m.setupFailed}>
        <SetupFlow
          startSetup={() => Promise.resolve({ ok: false, error: "unavailable" })}
          confirmSetup={never}
          navigate={() => undefined}
        />
      </Example>
      <Example id="gallery-limited" title={m.codeLimited}>
        <SecondStepForm
          action={() => Promise.resolve({ ok: false, error: "rate_limited" })}
          submitLabel={secondStep.verify}
          navigate={() => undefined}
        />
      </Example>
      <Example id="gallery-checking" title={m.codeChecking}>
        <SecondStepForm action={never} submitLabel={secondStep.verify} navigate={() => undefined} />
      </Example>
    </div>
  );
}
