import "server-only";
import type { Metadata } from "next";
import { courseList, coursePage, home } from "@/messages/catalog";
import { notFound as notFoundWords } from "@/messages/system";
import { COURSES_PATH, coursePath, HOME_PATH } from "../paths";
import { catalogCourse, catalogCourses } from "./reads";

// Each public page's title, description and canonical address (FR-SEO-01).
// The canonical path resolves against the production address set as
// `metadataBase` in the root layout. A read that failed throws here as in the
// page, so the request ends on the error page with status 500.

export async function homeMetadata(): Promise<Metadata> {
  await catalogCourses();
  return {
    title: { absolute: home.title },
    description: home.description,
    alternates: { canonical: HOME_PATH },
  };
}

export async function courseListMetadata(): Promise<Metadata> {
  await catalogCourses();
  return {
    title: courseList.title,
    description: courseList.description,
    alternates: { canonical: COURSES_PATH },
  };
}

export async function courseMetadata(params: Promise<{ course: string }>): Promise<Metadata> {
  const { course: slug } = await params;
  const course = await catalogCourse(slug);
  if (course === null) return { title: notFoundWords.title, robots: { index: false } };
  return {
    title: course.title,
    description:
      course.summary === "" ? coursePage.fallbackDescription(course.title) : course.summary,
    alternates: { canonical: coursePath(course.slug) },
  };
}
