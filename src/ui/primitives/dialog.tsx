"use client";

import type { ReactNode } from "react";
import {
  Dialog as AriaDialog,
  DialogTrigger,
  Heading,
  Modal,
  ModalOverlay,
} from "react-aria-components";

export type DialogProps = {
  /** The control that opens the dialog: a `Button` primitive. */
  trigger: ReactNode;
  title: string;
  /** The body. Receives `close` so an action inside can close the dialog. */
  children: (close: () => void) => ReactNode;
  defaultOpen?: boolean;
};

/**
 * A modal dialog. Escape closes it, focus stays inside while it is open, and
 * focus returns to the trigger when it closes. React Aria provides all three.
 */
export function Dialog({ trigger, title, children, defaultOpen = false }: DialogProps) {
  return (
    <DialogTrigger defaultOpen={defaultOpen}>
      {trigger}
      <ModalOverlay
        isDismissable
        className="fixed inset-0 z-10 flex items-center justify-center bg-backdrop p-gutter"
      >
        <Modal className="w-full max-w-dialog rounded-dialog border border-border bg-surface-raised shadow-float">
          <AriaDialog className="flex flex-col gap-4 p-5">
            {({ close }) => (
              <>
                <Heading slot="title" className="text-lg font-semibold text-text">
                  {title}
                </Heading>
                {children(close)}
              </>
            )}
          </AriaDialog>
        </Modal>
      </ModalOverlay>
    </DialogTrigger>
  );
}
