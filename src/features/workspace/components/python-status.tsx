"use client";

import { workspace as words } from "@/messages/workspace";
import type { RuntimeState } from "@/runtime/workspace-chart";
import { Button, Progress } from "@/ui";
import { cx } from "@/ui/class-names";

/**
 * Python's state beside the actions, shown only while it is not ready
 * (docs/spec/03-experience.md section 6.7; FR-WSP-17): starting with real
 * progress, restarting, or failed with Retry. The lesson and the editor stay
 * usable in every state. A status region, always in the page, says each
 * change once; the bar's progress is not announced byte by byte.
 */
export function PythonStatus({
  runtime,
  progress,
  onRetry,
}: {
  runtime: RuntimeState;
  progress: { loadedBytes: number; totalBytes: number } | undefined;
  onRetry: () => void;
}) {
  const starting = runtime.name === "idle" || runtime.name === "loading";
  const said = starting
    ? words.starting
    : runtime.name === "restarting"
      ? words.restarting
      : runtime.name === "failed"
        ? words.failed
        : "";
  return (
    // From 768 to 1023 px the status cannot share the buttons' row, so it has
    // a row of its own, kept at the height of a control while it is empty, so
    // the panels below do not move when Python is ready (WP-9.1 design
    // review, m6). Below 768 px the progress bar takes a row of its own, the
    // bar's full width, so its words stay on one line (design review, M1).
    <div
      data-python={runtime.name}
      className={cx(
        "flex min-w-0 items-center gap-3 md:whitespace-nowrap md:max-lg:min-h-target md:max-lg:basis-full",
        starting && progress !== undefined && "max-md:basis-full",
      )}
    >
      <span role="status" className="sr-only">
        {said}
      </span>
      {starting &&
        (progress === undefined ? (
          <span aria-hidden="true" className="text-base text-text-muted">
            {words.starting}
          </span>
        ) : (
          <div className="w-full md:w-(--python-progress-width)">
            <Progress
              label={words.starting}
              value={progress.loadedBytes}
              maxValue={Math.max(progress.totalBytes, 1)}
              valueLabel={words.progress(progress.loadedBytes, progress.totalBytes)}
            />
          </div>
        ))}
      {runtime.name === "restarting" && (
        <span aria-hidden="true" className="text-base text-text-muted">
          {words.restarting}
        </span>
      )}
      {runtime.name === "failed" && (
        <>
          <span aria-hidden="true" className="text-base text-text">
            {words.failed}
          </span>
          <Button variant="secondary" onPress={onRetry}>
            {words.retry}
          </Button>
        </>
      )}
    </div>
  );
}
