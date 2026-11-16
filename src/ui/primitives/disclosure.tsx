"use client";

import type { ReactNode } from "react";
import {
  Button as AriaButton,
  Disclosure as AriaDisclosure,
  DisclosurePanel,
  Heading,
} from "react-aria-components";
import { ChevronRight } from "../icons";

export type DisclosureProps = {
  title: ReactNode;
  children: ReactNode;
  defaultExpanded?: boolean;
  /** The heading level of the title within the page outline. */
  level?: 2 | 3 | 4;
};

/** The chevron points to the inline end when closed and turns down when open. */
export function Disclosure({
  title,
  children,
  defaultExpanded = false,
  level = 3,
}: DisclosureProps) {
  return (
    <AriaDisclosure defaultExpanded={defaultExpanded} className="group flex flex-col">
      <Heading level={level} className="text-base font-medium">
        <AriaButton
          slot="trigger"
          className="flex min-h-target w-full items-center gap-2 text-start text-text-muted transition-colors data-hovered:text-text"
        >
          <span
            aria-hidden="true"
            className="inline-flex transition-transform group-data-expanded:rotate-90 rtl:-scale-x-100 rtl:group-data-expanded:-rotate-90"
          >
            <ChevronRight size={16} />
          </span>
          {title}
        </AriaButton>
      </Heading>
      <DisclosurePanel className="ps-6 pb-2 text-base text-text">{children}</DisclosurePanel>
    </AriaDisclosure>
  );
}
