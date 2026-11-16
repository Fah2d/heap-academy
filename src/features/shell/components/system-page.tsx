import type { ReactNode } from "react";

/**
 * The layout of the not-found and error pages: what happened, in a heading
 * and a sentence, then the next step. Text and actions only; no illustration
 * (ADR-0031).
 */
export function SystemPage({
  heading,
  body,
  children,
}: {
  heading: string;
  body: string;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-page px-gutter py-7">
      <section className="flex max-w-prose flex-col gap-5">
        <h1 className="text-xl font-semibold text-balance text-text">{heading}</h1>
        <p className="text-base text-text-muted">{body}</p>
        <div className="flex flex-wrap items-center gap-4">{children}</div>
      </section>
    </div>
  );
}
