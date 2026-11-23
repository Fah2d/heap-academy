import { home } from "@/messages/catalog";
import { catalogCourses } from "../server/reads";
import { CatalogPage } from "./catalog-page";
import { CourseRows } from "./course-rows";

/**
 * `/` (docs/spec/03-experience.md section 5.1): one sentence that says what
 * this is, the published courses with real lesson counts, and how a lesson
 * works. Nothing else: no statistic, testimonial or logo (FR-LND-03). The
 * live editor of FR-LND-01 is a later package; nothing stands in for it.
 */
export async function HomePage() {
  const courses = await catalogCourses();
  return (
    <CatalogPage>
      <h1 className="max-w-prose text-2xl font-semibold text-balance text-text">{home.heading}</h1>
      <section aria-labelledby="home-courses" className="flex flex-col gap-4">
        <h2 id="home-courses" className="text-lg font-semibold text-text">
          {home.coursesHeading}
        </h2>
        <CourseRows result={courses} labelledBy="home-courses" titleLevel={3} />
      </section>
      <section aria-labelledby="home-how" className="flex max-w-prose flex-col gap-3">
        <h2 id="home-how" className="text-lg font-semibold text-text">
          {home.howHeading}
        </h2>
        <p className="text-prose text-text">{home.how}</p>
      </section>
    </CatalogPage>
  );
}
