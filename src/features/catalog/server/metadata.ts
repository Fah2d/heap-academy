import "server-only";
import type { Metadata } from "next";
import { courseList, coursePage, home } from "@/messages/catalog";
import { notFound as notFoundWords } from "@/messages/system";
import { COURSES_PATH, coursePath, HOME_PATH } from "../paths";
import { catalogCourse, catalogCourses } from "./reads";

// Each public page's title, description and canonical address (FR-SEO-01).
// The canonical path resolves against the production address set as
// `metadataBase` in the root layout. A page whose content could not be read
// asks not to be indexed, so a crawler never keeps the failure as the page.

const NOT_INDEXED = { index: false } as const;

export async function homeMetadata(): Promise<Metadata> {
  const courses = await catalogCourses();
  return {
    title: { absolute: home.title },
    description: home.description,
    alternates: { canonical: HOME_PATH },
    ...(courses.ok ? {} : { robots: NOT_INDEXED }),
  };
}

export async function courseListMetadata(): Promise<Metadata> {
  const courses = await catalogCourses();
  return {
    title: courseList.title,
    description: courseList.description,
    alternates: { canonical: COURSES_PATH },
    ...(courses.ok ? {} : { robots: NOT_INDEXED }),
  };
}

export async function courseMetadata(params: Promise<{ course: string }>): Promise<Metadata> {
  const { course: slug } = await params;
  const result = await catalogCourse(slug);
  if (!result.ok) return { title: coursePage.loadFailedTitle, robots: NOT_INDEXED };
  const course = result.value;
  if (course === null) return { title: notFoundWords.title, robots: NOT_INDEXED };
  return {
    title: course.title,
    description:
      course.summary === "" ? coursePage.fallbackDescription(course.title) : course.summary,
    alternates: { canonical: coursePath(course.slug) },
  };
}
