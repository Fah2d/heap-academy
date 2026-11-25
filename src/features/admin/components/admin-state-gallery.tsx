"use client";

import type { ReactNode } from "react";
import { adminGallery as m } from "@/messages/gallery";
import { secondStep } from "@/messages/admin";
import { CourseList } from "./course-list";
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

export function AdminStateGallery() {
  return (
    <div className="flex flex-col gap-7">
      <div className="flex flex-col gap-3">
        <h1 className="text-xl font-semibold text-text">{m.title}</h1>
        <p className="max-w-prose text-base text-text-muted">{m.intro}</p>
      </div>
      <Example id="gallery-empty" title={m.courseListEmpty}>
        <CourseList result={{ ok: true, courses: [] }} />
      </Example>
      <Example id="gallery-failed" title={m.courseListFailed}>
        <CourseList result={{ ok: false }} />
      </Example>
      <Example id="gallery-rows" title={m.courseListRows}>
        <CourseList
          result={{
            ok: true,
            courses: [
              {
                id: "5eed0000-0000-4000-8000-000000000001",
                slug: "sample-course",
                title: m.sampleCourse,
                status: "published",
                publishedLessons: 1,
                draftLessons: 0,
              },
            ],
          }}
        />
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
