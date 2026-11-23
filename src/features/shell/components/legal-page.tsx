import type { LegalBlock, LegalDocument } from "@/messages/legal";
import { legal } from "@/messages/legal";

function Block({ block }: { block: LegalBlock }) {
  if (block.kind === "paragraph") return <p>{block.text}</p>;
  return (
    <ul className="flex list-disc flex-col gap-2 ps-5">
      {block.items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

/**
 * The privacy policy and the terms (FR-SYS-03): the title, the date the text
 * last changed (docs/spec/06-security-privacy.md section 8), then each section
 * under its own heading. Text only, at the reading measure.
 */
export function LegalPage({ content }: { content: LegalDocument }) {
  return (
    <div className="mx-auto max-inline-page px-gutter py-7">
      <article className="flex max-inline-prose flex-col gap-6 text-base text-text">
        <div className="flex flex-col gap-3">
          <h1 className="text-xl font-semibold text-balance">{content.title}</h1>
          <p className="text-xs text-text-muted">
            {legal.updatedLabel} <time dateTime={content.updated.iso}>{content.updated.text}</time>
          </p>
          <p>{content.intro}</p>
        </div>
        {content.sections.map((section) => (
          <section key={section.id} aria-labelledby={section.id} className="flex flex-col gap-3">
            <h2 id={section.id} className="text-lg font-semibold text-balance">
              {section.heading}
            </h2>
            {section.blocks.map((block, index) => (
              <Block key={index} block={block} />
            ))}
          </section>
        ))}
      </article>
    </div>
  );
}
