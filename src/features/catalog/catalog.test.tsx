// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { catalogCommon, courseList, coursePage, home } from "@/messages/catalog";
import { catalogGallery } from "@/messages/gallery";
import { notFound as notFoundWords } from "@/messages/system";

// The home page, the course list and the course page (WP-5.1;
// docs/spec/03-experience.md sections 5.1 to 5.3), rendered from what
// `src/content` answers.

vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ connection: () => Promise.resolve() }));

const NOT_FOUND = "NEXT_NOT_FOUND";
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error(NOT_FOUND);
  },
  usePathname: () => state.pathname,
}));

const state = vi.hoisted(() => ({
  pathname: "/",
  courses: { ok: true, value: [] } as unknown,
  course: { ok: true, value: null } as unknown,
  courseCalls: [] as string[],
}));

vi.mock("@/content", () => ({
  publishedCourses: () => Promise.resolve(state.courses),
  publishedCourse: (slug: string) => {
    state.courseCalls.push(slug);
    return Promise.resolve(state.course);
  },
}));

const { HomePage } = await import("./components/home-page");
const { CourseListPage } = await import("./components/course-list-page");
const { CoursePage } = await import("./components/course-page");
const { CoursesNavLink } = await import("./components/courses-nav-link");
const { CatalogStateGallery } = await import("./components/catalog-state-gallery");
const { courseListMetadata, courseMetadata, homeMetadata } = await import("./server/metadata");

const TWO_COURSES = [
  {
    slug: "python-basics",
    title: "Python basics",
    summary: "Print, names and numbers.",
    lessonCount: 12,
  },
  { slug: "loops", title: "Loops", summary: "Repeat work with for and while.", lessonCount: 1 },
];

const COURSE = {
  slug: "python-basics",
  title: "Python basics",
  summary: "Print, names and numbers.",
  outcomes: ["Print text", "Store a value in a name"],
  chapters: [
    {
      id: "8d0f3a52-6f0e-4a57-9a54-4b1e2c3d4e5f",
      title: "First steps",
      summary: "Your first program.",
      lessons: [
        { slug: "hello", title: "Say hello" },
        { slug: "names", title: "Names" },
      ],
    },
    {
      id: "9e1a4b63-7a1f-4b68-8b65-5c2f3d4e5f60",
      title: "Numbers",
      summary: "",
      lessons: [{ slug: "sums", title: "Sums" }],
    },
  ],
};

function params(course: string) {
  return Promise.resolve({ course });
}

beforeEach(() => {
  state.pathname = "/";
  state.courses = { ok: true, value: [] };
  state.course = { ok: true, value: null };
  state.courseCalls = [];
});

afterEach(cleanup);

describe("the home page", () => {
  it("[FR-LND-02] says what the product is in one sentence, as the one heading", async () => {
    render(await HomePage());
    const headings = screen.getAllByRole("heading", { level: 1 });
    expect(headings.map((h) => h.textContent)).toEqual([home.heading]);
  });

  it("[FR-LND-02] lists the published courses with their real lesson counts, each linking into the course", async () => {
    state.courses = { ok: true, value: TWO_COURSES };
    render(await HomePage());
    const list = screen.getByRole("list", { name: home.coursesHeading });
    const rows = within(list).getAllByRole("listitem");
    expect(rows).toHaveLength(2);
    expect(within(rows[0]!).getByRole("link", { name: "Python basics" }).getAttribute("href")).toBe(
      "/courses/python-basics",
    );
    expect(within(rows[0]!).getByText("12 lessons")).toBeTruthy();
    expect(within(rows[1]!).getByText("1 lesson")).toBeTruthy();
    expect(within(rows[1]!).getByText("Repeat work with for and while.")).toBeTruthy();
  });

  it("[FR-LND-02] explains how a lesson works", async () => {
    render(await HomePage());
    expect(screen.getByRole("heading", { level: 2, name: home.howHeading })).toBeTruthy();
    expect(screen.getByText(home.how)).toBeTruthy();
  });

  it("[FR-CAT-04] says honestly that nothing is published, with no placeholder row", async () => {
    render(await HomePage());
    expect(screen.getByText(courseList.empty)).toBeTruthy();
    expect(screen.queryByRole("listitem")).toBeNull();
  });

  it("[FR-LND-02] says the courses could not be loaded when the read fails", async () => {
    state.courses = { ok: false };
    render(await HomePage());
    expect(screen.getByText(courseList.loadFailed)).toBeTruthy();
    expect(screen.queryByText(courseList.empty)).toBeNull();
  });

  it("[FR-LND-03] shows no number that is not a lesson count", async () => {
    state.courses = { ok: true, value: TWO_COURSES };
    const { container } = render(await HomePage());
    const numbers = (container.textContent ?? "").match(/\d+/g) ?? [];
    expect(numbers).toEqual(["12", "1"]);
  });
});

describe("the course list", () => {
  it("[FR-CAT-01] lists each published course with its title, summary and lesson count", async () => {
    state.courses = { ok: true, value: TWO_COURSES };
    render(await CourseListPage());
    expect(screen.getByRole("heading", { level: 1, name: courseList.heading })).toBeTruthy();
    const rows = within(screen.getByRole("list", { name: courseList.heading })).getAllByRole(
      "listitem",
    );
    expect(rows.map((row) => within(row).getByRole("heading", { level: 2 }).textContent)).toEqual([
      "Python basics",
      "Loops",
    ]);
    expect(within(rows[0]!).getByText("Print, names and numbers.")).toBeTruthy();
    expect(within(rows[0]!).getByText(catalogCommon.lessonCount(12))).toBeTruthy();
    expect(within(rows[1]!).getByRole("link", { name: "Loops" }).getAttribute("href")).toBe(
      "/courses/loops",
    );
  });

  it("[FR-CAT-04] says so in one sentence when no course is published", async () => {
    render(await CourseListPage());
    expect(screen.getByText(courseList.empty)).toBeTruthy();
    expect(screen.queryByRole("list")).toBeNull();
  });

  it("[FR-CAT-01] names the failure when the courses could not be read", async () => {
    state.courses = { ok: false };
    render(await CourseListPage());
    expect(screen.getByText(courseList.loadFailed)).toBeTruthy();
    expect(screen.getByText(`${catalogCommon.errorLabel}:`)).toBeTruthy();
    expect(screen.queryByText(courseList.empty)).toBeNull();
  });
});

describe("the course page", () => {
  it("[FR-CRS-01] shows the title, summary, size and the outcomes the owner wrote", async () => {
    state.course = { ok: true, value: COURSE };
    render(await CoursePage({ params: params("python-basics") }));
    expect(screen.getByRole("heading", { level: 1, name: "Python basics" })).toBeTruthy();
    expect(screen.getByText("Print, names and numbers.")).toBeTruthy();
    expect(screen.getByText(coursePage.size(3, 2))).toBeTruthy();
    const outcomes = screen.getByRole("list", { name: coursePage.outcomesHeading });
    expect(
      within(outcomes)
        .getAllByRole("listitem")
        .map((li) => li.textContent),
    ).toEqual(["Print text", "Store a value in a name"]);
  });

  it("[FR-CRS-01] shows every chapter in order with its lessons in order and their numbers", async () => {
    state.course = { ok: true, value: COURSE };
    render(await CoursePage({ params: params("python-basics") }));
    const chapters = screen.getAllByRole("heading", { level: 3 });
    expect(chapters.map((h) => h.textContent)).toEqual([
      `${coursePage.chapterNumber(1)} First steps`,
      `${coursePage.chapterNumber(2)} Numbers`,
    ]);
    const first = screen.getByRole("list", { name: coursePage.chapterLessonsLabel("First steps") });
    expect(
      within(first)
        .getAllByRole("listitem")
        .map((li) => li.textContent),
    ).toEqual(["1.1 Say hello", "1.2 Names"]);
    const second = screen.getByRole("list", { name: coursePage.chapterLessonsLabel("Numbers") });
    expect(
      within(second)
        .getAllByRole("listitem")
        .map((li) => li.textContent),
    ).toEqual(["2.1 Sums"]);
    expect(screen.getByText("Your first program.")).toBeTruthy();
  });

  it("[FR-CRS-01] leaves the outcome list out when the owner wrote none", async () => {
    state.course = { ok: true, value: { ...COURSE, outcomes: [] } };
    render(await CoursePage({ params: params("python-basics") }));
    expect(screen.queryByRole("heading", { name: coursePage.outcomesHeading })).toBeNull();
  });

  it("[FR-CRS-01] links to no lesson until the lesson page exists (CLAUDE.md rule 3)", async () => {
    state.course = { ok: true, value: COURSE };
    render(await CoursePage({ params: params("python-basics") }));
    expect(screen.queryAllByRole("link")).toEqual([]);
  });

  it("[FR-CAT-04] answers not found for a course that is not published", async () => {
    await expect(CoursePage({ params: params("drafts-only") })).rejects.toThrow(NOT_FOUND);
    expect(state.courseCalls).toEqual(["drafts-only"]);
  });

  it("[FR-CRS-01] says the course could not be loaded when the read fails", async () => {
    state.course = { ok: false };
    render(await CoursePage({ params: params("python-basics") }));
    expect(
      screen.getByRole("heading", { level: 1, name: coursePage.loadFailedTitle }),
    ).toBeTruthy();
    expect(screen.getByText(coursePage.loadFailedBody)).toBeTruthy();
  });
});

describe("Courses in the header", () => {
  it("[FR-CAT-01] links to the course list", () => {
    render(<CoursesNavLink />);
    const link = screen.getByRole("link", { name: catalogCommon.coursesLink });
    expect(link.getAttribute("href")).toBe("/courses");
    expect(link.getAttribute("aria-current")).toBeNull();
  });

  it("[FR-CAT-01] is marked as the current page on the course list only", () => {
    state.pathname = "/courses";
    render(<CoursesNavLink />);
    expect(screen.getByRole("link").getAttribute("aria-current")).toBe("page");
    cleanup();
    state.pathname = "/courses/python-basics";
    render(<CoursesNavLink />);
    expect(screen.getByRole("link").getAttribute("aria-current")).toBeNull();
  });
});

describe("titles, descriptions and canonical addresses [FR-SEO-01]", () => {
  it("gives the home page its own title, description and canonical address", async () => {
    expect(await homeMetadata()).toEqual({
      title: { absolute: home.title },
      description: home.description,
      alternates: { canonical: "/" },
    });
  });

  it("gives the course list its own title, description and canonical address", async () => {
    expect(await courseListMetadata()).toEqual({
      title: courseList.title,
      description: courseList.description,
      alternates: { canonical: "/courses" },
    });
  });

  it("gives a course page the course's title and summary, at its own address", async () => {
    state.course = { ok: true, value: COURSE };
    expect(await courseMetadata(params("python-basics"))).toEqual({
      title: "Python basics",
      description: "Print, names and numbers.",
      alternates: { canonical: "/courses/python-basics" },
    });
  });

  it("describes a course with no summary by its title", async () => {
    state.course = { ok: true, value: { ...COURSE, summary: "" } };
    const metadata = await courseMetadata(params("python-basics"));
    expect(metadata.description).toBe(coursePage.fallbackDescription("Python basics"));
  });

  it("keeps a missing course out of the index, with the not-found title", async () => {
    expect(await courseMetadata(params("nothing-here"))).toEqual({
      title: notFoundWords.title,
      robots: { index: false },
    });
  });

  it("keeps a page whose content failed to load out of the index", async () => {
    state.courses = { ok: false };
    state.course = { ok: false };
    expect((await homeMetadata()).robots).toEqual({ index: false });
    expect((await courseListMetadata()).robots).toEqual({ index: false });
    expect(await courseMetadata(params("python-basics"))).toEqual({
      title: coursePage.loadFailedTitle,
      robots: { index: false },
    });
  });
});

describe("the catalog state gallery (development only)", () => {
  it("shows the empty, failed and filled course list and the failed and plain course page", () => {
    render(<CatalogStateGallery />);
    const region = (name: string) => screen.getByRole("region", { name });
    expect(within(region(catalogGallery.listEmpty)).getByText(courseList.empty)).toBeTruthy();
    expect(within(region(catalogGallery.listFailed)).getByText(courseList.loadFailed)).toBeTruthy();
    const rows = within(region(catalogGallery.listRows));
    expect(rows.getByRole("link", { name: catalogGallery.longCourse })).toBeTruthy();
    expect(rows.getByText(catalogCommon.lessonCount(3))).toBeTruthy();
    const failed = within(region(catalogGallery.courseFailed));
    expect(
      failed.getByRole("heading", { level: 1, name: coursePage.loadFailedTitle }),
    ).toBeTruthy();
    const course = within(region(catalogGallery.courseNoOutcomes));
    expect(
      course.getByRole("heading", { level: 1, name: catalogGallery.sampleCourse }),
    ).toBeTruthy();
    expect(course.getByText(coursePage.size(3, 2))).toBeTruthy();
    expect(course.queryByRole("heading", { name: coursePage.outcomesHeading })).toBeNull();
  });
});
