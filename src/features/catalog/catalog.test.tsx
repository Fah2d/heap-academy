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
const CONTENT_UNAVAILABLE = /could not be read/;
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error(NOT_FOUND);
  },
  usePathname: () => state.pathname,
}));

const state = vi.hoisted(() => ({
  pathname: "/",
  /** What the device answers; undefined until it has answered. */
  completed: undefined as ReadonlySet<string> | undefined,
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

vi.mock("@/features/progress", () => ({ useDeviceCompletions: () => state.completed }));
vi.mock("@/infrastructure/http/nonce", () => ({ requestNonce: () => Promise.resolve("nonce") }));

const { HomePage } = await import("./components/home-page");
const { CourseListPage } = await import("./components/course-list-page");
const { CoursePage } = await import("./components/course-page");
const { CoursesNavLink } = await import("./components/courses-nav-link");
const { CatalogStateGallery } = await import("./components/catalog-state-gallery");
const { courseListMetadata, courseMetadata, homeMetadata } = await import("./server/metadata");

/** A lesson ID for these tests. */
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

const BASICS_LESSONS = Array.from({ length: 12 }, (_, index) => ({
  id: id(index + 1),
  slug: `lesson-${String(index + 1)}`,
}));

const TWO_COURSES = [
  {
    slug: "python-basics",
    title: "Python basics",
    summary: "Print, names and numbers.",
    lessonCount: 12,
    lessons: BASICS_LESSONS,
  },
  {
    slug: "loops",
    title: "Loops",
    summary: "Repeat work with for and while.",
    lessonCount: 1,
    lessons: [{ id: id(100), slug: "for" }],
  },
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
        { id: id(201), slug: "hello", title: "Say hello", xp: 10 },
        { id: id(202), slug: "names", title: "Names", xp: 10 },
      ],
    },
    {
      id: "9e1a4b63-7a1f-4b68-8b65-5c2f3d4e5f60",
      title: "Numbers",
      summary: "",
      lessons: [{ id: id(203), slug: "sums", title: "Sums", xp: 20 }],
    },
  ],
};

function params(course: string) {
  return Promise.resolve({ course });
}

beforeEach(() => {
  state.pathname = "/";
  state.completed = undefined;
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

  it("[FR-SEO-01] fails to the error page when the read fails, so it answers 500 and not 200", async () => {
    state.courses = { ok: false };
    await expect(HomePage()).rejects.toThrow(CONTENT_UNAVAILABLE);
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

  /** Each course row's action as [label, address]. */
  function rowActions(): (string | null)[][] {
    const rows = within(screen.getByRole("list", { name: courseList.heading })).getAllByRole(
      "listitem",
    );
    return rows.map((row) => {
      const links = within(row).getAllByRole("link");
      expect(links).toHaveLength(2);
      // The visible label, then the course's title for a screen reader.
      const title = links[0]!.textContent ?? "";
      const name = links[1]!.textContent ?? "";
      expect(name.endsWith(catalogCommon.actionCourse(title))).toBe(true);
      return [
        name.slice(0, -catalogCommon.actionCourse(title).length),
        links[1]!.getAttribute("href"),
      ];
    });
  }

  it("[FR-CAT-02] begins each course before the device answers, with the lesson count only", async () => {
    state.courses = { ok: true, value: TWO_COURSES };
    render(await CourseListPage());
    expect(rowActions()).toEqual([
      [catalogCommon.action.begin, "/learn/python-basics/lesson-1"],
      [catalogCommon.action.begin, "/learn/loops/for"],
    ]);
    expect(screen.queryByText(/completed$/)).toBeNull();
    expect(screen.getByText(catalogCommon.lessonCount(12))).toBeTruthy();
    expect(screen.getByText(catalogCommon.lessonCount(1))).toBeTruthy();
  });

  it("[FR-CAT-02] labels each course's action by progress: 0 percent, partial and 100 percent", async () => {
    state.courses = {
      ok: true,
      value: [...TWO_COURSES, { ...TWO_COURSES[1]!, slug: "loops-2", title: "Loops again" }],
    };
    state.completed = new Set([id(1), id(2), id(4), id(100)]);
    render(await CourseListPage());
    // Loops and its twin share their one lesson, so both are complete.
    expect(rowActions()).toEqual([
      [catalogCommon.action.continue, "/learn/python-basics/lesson-3"],
      [catalogCommon.action.review, "/learn/loops/for"],
      [catalogCommon.action.review, "/learn/loops-2/for"],
    ]);
    expect(screen.getByText(catalogCommon.progress(3, 12))).toBeTruthy();
    expect(screen.getAllByText(catalogCommon.progress(1, 1))).toHaveLength(2);
    cleanup();
    state.completed = new Set();
    render(await CourseListPage());
    expect(rowActions()[0]).toEqual([catalogCommon.action.begin, "/learn/python-basics/lesson-1"]);
    expect(screen.getByText(catalogCommon.progress(0, 12))).toBeTruthy();
  });

  it("[FR-CAT-04] says so in one sentence when no course is published", async () => {
    render(await CourseListPage());
    expect(screen.getByText(courseList.empty)).toBeTruthy();
    expect(screen.queryByRole("list")).toBeNull();
  });

  it("[FR-SEO-01] fails to the error page when the courses could not be read", async () => {
    state.courses = { ok: false };
    await expect(CourseListPage()).rejects.toThrow(CONTENT_UNAVAILABLE);
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
    const chapterList = screen.getByRole("list", { name: coursePage.chaptersHeading });
    expect(within(chapterList).getAllByRole("heading", { level: 3 })).toHaveLength(2);
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
    ).toEqual(["1.1 Say hello 10 XP", "1.2 Names 10 XP"]);
    const second = screen.getByRole("list", { name: coursePage.chapterLessonsLabel("Numbers") });
    expect(
      within(second)
        .getAllByRole("listitem")
        .map((li) => li.textContent),
    ).toEqual(["2.1 Sums 20 XP"]);
    expect(screen.getByText("Your first program.")).toBeTruthy();
  });

  it("[FR-CRS-01] leaves the outcome list out when the owner wrote none", async () => {
    state.course = { ok: true, value: { ...COURSE, outcomes: [] } };
    render(await CoursePage({ params: params("python-basics") }));
    expect(screen.queryByRole("heading", { name: coursePage.outcomesHeading })).toBeNull();
  });

  it("[FR-CRS-01] links each lesson to its workspace", async () => {
    state.course = { ok: true, value: COURSE };
    render(await CoursePage({ params: params("python-basics") }));
    const chapters = screen.getByRole("list", { name: coursePage.chaptersHeading });
    expect(
      within(chapters)
        .getAllByRole("link")
        .map((link) => [link.textContent, link.getAttribute("href")]),
    ).toEqual([
      ["Say hello", "/learn/python-basics/hello"],
      ["Names", "/learn/python-basics/names"],
      ["Sums", "/learn/python-basics/sums"],
    ]);
  });

  /** The course page's one action, outside the chapters. */
  function courseAction() {
    const header = screen.getByRole("heading", { level: 1 }).closest("header");
    const links = within(header!).getAllByRole("link");
    expect(links).toHaveLength(1);
    return [links[0]!.textContent, links[0]!.getAttribute("href")];
  }

  /** Each lesson row's state word, or "" when it shows none. */
  function lessonStates(): string[] {
    const chapters = screen.getByRole("list", { name: coursePage.chaptersHeading });
    const words = Object.values(coursePage.lessonState);
    return within(chapters)
      .getAllByRole("listitem")
      .filter((row) => row.closest("ol")?.getAttribute("aria-label")?.startsWith("Lessons in"))
      .map((row) => words.find((word) => row.textContent?.endsWith(word)) ?? "");
  }

  it("[FR-CAT-02] begins at the first lesson, and claims no state before the device answers", async () => {
    state.course = { ok: true, value: COURSE };
    render(await CoursePage({ params: params("python-basics") }));
    expect(courseAction()).toEqual([catalogCommon.action.begin, "/learn/python-basics/hello"]);
    expect(lessonStates()).toEqual(["", "", ""]);
    expect(screen.queryByText(/completed$/)).toBeNull();
    expect(screen.queryByText(/XP earned$/)).toBeNull();
  });

  it("[FR-CAT-02] [FR-CRS-02] begins with nothing completed: the first lesson is next up", async () => {
    state.course = { ok: true, value: COURSE };
    state.completed = new Set([id(999)]);
    render(await CoursePage({ params: params("python-basics") }));
    expect(courseAction()).toEqual([catalogCommon.action.begin, "/learn/python-basics/hello"]);
    expect(lessonStates()).toEqual([
      coursePage.lessonState.next,
      coursePage.lessonState.open,
      coursePage.lessonState.open,
    ]);
    expect(screen.getByText(catalogCommon.progress(0, 3))).toBeTruthy();
    expect(screen.getByText(coursePage.xpEarned(0, 40))).toBeTruthy();
  });

  it("[FR-CAT-02] [FR-CRS-02] [FR-CRS-05] continues to the next incomplete lesson", async () => {
    state.course = { ok: true, value: COURSE };
    state.completed = new Set([id(201), id(203)]);
    render(await CoursePage({ params: params("python-basics") }));
    expect(courseAction()).toEqual([catalogCommon.action.continue, "/learn/python-basics/names"]);
    expect(lessonStates()).toEqual([
      coursePage.lessonState.completed,
      coursePage.lessonState.next,
      coursePage.lessonState.completed,
    ]);
    expect(screen.getByText(catalogCommon.progress(2, 3))).toBeTruthy();
    // The 10 XP and 20 XP lessons of 40 (FR-CRS-05).
    expect(screen.getByText(coursePage.xpEarned(30, 40))).toBeTruthy();
  });

  it("[FR-CAT-02] [FR-CRS-02] reviews from the first lesson when every lesson is completed", async () => {
    state.course = { ok: true, value: COURSE };
    state.completed = new Set([id(201), id(202), id(203)]);
    render(await CoursePage({ params: params("python-basics") }));
    expect(courseAction()).toEqual([catalogCommon.action.review, "/learn/python-basics/hello"]);
    expect(lessonStates()).toEqual(Array(3).fill(coursePage.lessonState.completed));
    expect(screen.getByText(catalogCommon.progress(3, 3))).toBeTruthy();
    expect(screen.getByText(coursePage.xpEarned(40, 40))).toBeTruthy();
  });

  it("[FR-CRS-02] says each state in words, with its icon hidden from assistive technology", async () => {
    state.course = { ok: true, value: COURSE };
    state.completed = new Set([id(201)]);
    const { container } = render(await CoursePage({ params: params("python-basics") }));
    for (const word of Object.values(coursePage.lessonState)) {
      expect(screen.getByText(word)).toBeTruthy();
    }
    const icons = container.querySelectorAll("svg");
    expect(icons.length).toBe(3);
    for (const icon of icons) expect(icon.closest("[aria-hidden='true']")).not.toBeNull();
  });

  it("[FR-CAT-04] answers not found for a course that is not published", async () => {
    await expect(CoursePage({ params: params("drafts-only") })).rejects.toThrow(NOT_FOUND);
    expect(state.courseCalls).toEqual(["drafts-only"]);
  });

  it("[FR-SEO-01] fails to the error page when the course could not be read", async () => {
    state.course = { ok: false };
    await expect(CoursePage({ params: params("python-basics") })).rejects.toThrow(
      CONTENT_UNAVAILABLE,
    );
  });

  it("[FR-CRS-01] leaves out an outcome that is only spaces", async () => {
    state.course = { ok: true, value: { ...COURSE, outcomes: ["Print text", "  ", ""] } };
    render(await CoursePage({ params: params("python-basics") }));
    const outcomes = screen.getByRole("list", { name: coursePage.outcomesHeading });
    expect(
      within(outcomes)
        .getAllByRole("listitem")
        .map((li) => li.textContent),
    ).toEqual(["Print text"]);
  });

  it("[FR-CRS-01] leaves the outcome list out when every outcome is only spaces", async () => {
    state.course = { ok: true, value: { ...COURSE, outcomes: [" ", "\t"] } };
    render(await CoursePage({ params: params("python-basics") }));
    expect(screen.queryByRole("heading", { name: coursePage.outcomesHeading })).toBeNull();
  });
});

describe("lesson addresses", () => {
  it("[FR-CAT-02] match the workspace's own address for a lesson", async () => {
    const { lessonPath } = await import("./paths");
    const { learnPath } = await import("@/features/workspace");
    expect(lessonPath("python-basics", "hello")).toBe(learnPath("python-basics", "hello"));
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

  it("fails to the error page when the content could not be read, instead of a page with noindex", async () => {
    state.courses = { ok: false };
    state.course = { ok: false };
    await expect(homeMetadata()).rejects.toThrow(CONTENT_UNAVAILABLE);
    await expect(courseListMetadata()).rejects.toThrow(CONTENT_UNAVAILABLE);
    await expect(courseMetadata(params("python-basics"))).rejects.toThrow(CONTENT_UNAVAILABLE);
  });
});

describe("the catalog state gallery (development only)", () => {
  function duplicateIds(): string[] {
    const ids = [...document.querySelectorAll("[id]")].map((element) => element.id);
    return ids.filter((id, index) => ids.indexOf(id) !== index);
  }

  it("lists each state as a link to its own address", () => {
    render(<CatalogStateGallery />);
    expect(screen.getByRole("heading", { level: 1, name: catalogGallery.title })).toBeTruthy();
    const links = within(screen.getByRole("list")).getAllByRole("link");
    expect(links.map((link) => [link.textContent, link.getAttribute("href")])).toEqual([
      [catalogGallery.homeEmpty, "/dev/catalog?state=home-empty"],
      [catalogGallery.listEmpty, "/dev/catalog?state=list-empty"],
      [catalogGallery.listRows, "/dev/catalog?state=list-rows"],
      [catalogGallery.courseNoOutcomes, "/dev/catalog?state=course"],
    ]);
  });

  it("answers an unknown state with the list of states", () => {
    render(<CatalogStateGallery state="nothing" />);
    expect(screen.getByRole("heading", { level: 1, name: catalogGallery.title })).toBeTruthy();
  });

  it("draws the home page with no course as the whole page alone", () => {
    render(<CatalogStateGallery state="home-empty" />);
    expect(screen.getAllByRole("heading", { level: 1 }).map((h) => h.textContent)).toEqual([
      home.heading,
    ]);
    expect(screen.getByText(courseList.empty)).toBeTruthy();
    expect(screen.getByText(home.how)).toBeTruthy();
    expect(screen.queryByText(catalogGallery.title)).toBeNull();
    expect(duplicateIds()).toEqual([]);
  });

  it("draws the course list with no course as the whole page alone", () => {
    render(<CatalogStateGallery state="list-empty" />);
    expect(screen.getAllByRole("heading", { level: 1 }).map((h) => h.textContent)).toEqual([
      courseList.heading,
    ]);
    expect(screen.getByText(courseList.empty)).toBeTruthy();
    expect(screen.queryByRole("listitem")).toBeNull();
    expect(duplicateIds()).toEqual([]);
  });

  it("draws the filled course list, with the longest title, as the whole page alone", () => {
    render(<CatalogStateGallery state="list-rows" />);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("link", { name: catalogGallery.longCourse })).toBeTruthy();
    expect(screen.getByText(catalogCommon.lessonCount(3))).toBeTruthy();
    expect(duplicateIds()).toEqual([]);
  });

  it("draws a course page with no outcomes as the whole page alone", () => {
    render(<CatalogStateGallery state="course" />);
    expect(screen.getAllByRole("heading", { level: 1 }).map((h) => h.textContent)).toEqual([
      catalogGallery.sampleCourse,
    ]);
    expect(screen.getByText(coursePage.size(3, 2))).toBeTruthy();
    expect(screen.queryByRole("heading", { name: coursePage.outcomesHeading })).toBeNull();
    expect(duplicateIds()).toEqual([]);
  });
});
