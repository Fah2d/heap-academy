import { courseList } from "@/messages/catalog";
import { catalogCourses } from "../server/reads";
import { CatalogPage } from "./catalog-page";
import { CourseRows } from "./course-rows";

/** `/courses` (docs/spec/03-experience.md section 5.2; FR-CAT-01, FR-CAT-04). */
export async function CourseListPage() {
  const courses = await catalogCourses();
  return (
    <CatalogPage>
      <section aria-labelledby="courses-heading" className="flex flex-col gap-5">
        <h1 id="courses-heading" className="text-xl font-semibold text-text">
          {courseList.heading}
        </h1>
        <CourseRows result={courses} labelledBy="courses-heading" titleLevel={2} />
      </section>
    </CatalogPage>
  );
}
