import type { Neighbours } from "@/domain/workspace/neighbours";
import { learnPath } from "../paths";
import { workspace as words } from "@/messages/workspace";
import { Link } from "@/ui";

/**
 * Previous and next across the course's chapters (FR-WSP-11). At an end of
 * the course the control is shown disabled, not hidden. Once the lesson has
 * passed, Next is the screen's primary action (DESIGN.md section 4.5).
 */
export function LessonNav({
  course,
  neighbours,
  passed,
}: {
  course: string;
  neighbours: Neighbours;
  passed: boolean;
}) {
  const { previous, next } = neighbours;
  return (
    <nav
      aria-label={words.lessons}
      className="flex flex-wrap items-center justify-between gap-x-3 border-bs border-border px-gutter"
    >
      {previous === null ? (
        <Disabled>{words.noPrevious}</Disabled>
      ) : (
        <Link href={learnPath(course, previous.slug)} variant="standalone">
          {words.neighbour(words.previous, previous.title)}
        </Link>
      )}
      {next === null ? (
        <Disabled>{words.noNext}</Disabled>
      ) : (
        <Link href={learnPath(course, next.slug)} variant={passed ? "action" : "standalone"}>
          {words.neighbour(words.next, next.title)}
        </Link>
      )}
    </nav>
  );
}

function Disabled({ children }: { children: string }) {
  return (
    // A disabled link: shown, and exposed as unavailable (FR-WSP-11).
    <span
      role="link"
      aria-disabled="true"
      className="inline-flex min-h-target items-center text-base text-text-muted"
    >
      {children}
    </span>
  );
}
