import type { PublishedCourseSummary } from "@/content";
import { HomeEditor } from "@/features/workspace";
import { requestNonce } from "@/infrastructure/http/nonce";
import { home } from "@/messages/catalog";
import { catalogCourses } from "../server/reads";
import { CatalogPage } from "./catalog-page";
import { CourseRows } from "./course-rows";

/**
 * `/` (docs/spec/03-experience.md section 5.1): one sentence that says what
 * this is with the live editor beside it (FR-LND-01), the published courses
 * with real lesson counts, and how a lesson works. Nothing else: no
 * statistic, testimonial or logo (FR-LND-03).
 */
export async function HomePage() {
  const [courses, nonce] = await Promise.all([catalogCourses(), requestNonce()]);
  return <HomeView courses={courses} nonce={nonce} />;
}

export function HomeView({
  courses,
  nonce,
}: {
  courses: PublishedCourseSummary[];
  /** This request's nonce, for the editor's styles (`requestNonce`). */
  nonce: string;
}) {
  return (
    <CatalogPage>
      <div className="grid gap-7 lg:grid-cols-2 lg:items-center">
        <h1 className="max-inline-prose text-2xl font-semibold text-balance text-text">
          {home.heading}
        </h1>
        <HomeEditor nonce={nonce} />
      </div>
      <section aria-labelledby="home-courses" className="flex flex-col gap-4">
        <h2 id="home-courses" className="text-lg font-semibold text-text">
          {home.coursesHeading}
        </h2>
        <CourseRows courses={courses} labelledBy="home-courses" titleLevel={3} />
      </section>
      <section aria-labelledby="home-how" className="flex max-inline-prose flex-col gap-4">
        <h2 id="home-how" className="text-lg font-semibold text-text">
          {home.howHeading}
        </h2>
        <p className="text-prose text-text">{home.how}</p>
      </section>
    </CatalogPage>
  );
}
