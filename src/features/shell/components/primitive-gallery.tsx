"use client";

import type { ReactNode } from "react";
import { gallery as m } from "@/messages/gallery";
import {
  Button,
  Dialog,
  DialogActions,
  Disclosure,
  Link,
  Notice,
  Progress,
  Status,
  Tabs,
  TextField,
} from "@/ui";

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-heading`} className="flex flex-col gap-4 scroll-mbs-4">
      <h2 id={`${id}-heading`} className="text-lg font-semibold text-text">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Example({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="font-mono text-xs text-text-muted">{label}</p>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </div>
  );
}

/**
 * Every primitive in every state that props can set (WP-1.4). Hover, press,
 * and focus come from the pointer and the keyboard. Development only: the page
 * that renders this is absent from the production build.
 */
export function PrimitiveGallery() {
  return (
    <div className="mx-auto flex max-w-page flex-col gap-7 px-gutter py-6">
      <header className="flex flex-col gap-3">
        <h1 className="text-xl font-semibold text-text">{m.title}</h1>
        <p className="max-w-prose text-base text-text-muted">{m.intro}</p>
      </header>

      <Section id="buttons" title={m.buttons}>
        <Example label={m.rest}>
          <Button variant="primary">{m.check}</Button>
          <Button variant="secondary">{m.run}</Button>
          <Button variant="destructive">{m.deleteTestCase}</Button>
        </Example>
        <Example label={m.disabled}>
          <Button variant="primary" isDisabled>
            {m.check}
          </Button>
          <Button variant="secondary" isDisabled>
            {m.run}
          </Button>
          <Button variant="destructive" isDisabled>
            {m.deleteTestCase}
          </Button>
        </Example>
      </Section>

      <Section id="links" title={m.links}>
        <p className="max-w-prose text-prose text-text">
          {m.inlineBefore}{" "}
          <Link href="#text-fields" variant="inline">
            {m.inlineLink}
          </Link>{" "}
          {m.inlineAfter}
        </p>
        <Example label={m.standaloneVariant}>
          <Link href="#notices" variant="standalone">
            {m.standaloneLink}
          </Link>
        </Example>
        <Example label={m.navVariant}>
          <nav aria-label={m.navLabel} className="flex gap-5">
            <Link href="#buttons" variant="nav" current>
              {m.navCurrent}
            </Link>
            <Link href="#links" variant="nav">
              {m.navOther}
            </Link>
          </nav>
        </Example>
      </Section>

      <Section id="text-fields" title={m.textFields}>
        <div className="grid gap-5 md:grid-cols-2">
          <TextField label={m.emailLabel} placeholder={m.emailPlaceholder} type="email" />
          <TextField
            label={`${m.emailLabel} (${m.withDescription})`}
            description={m.emailDescription}
            placeholder={m.emailPlaceholder}
            type="email"
          />
          <TextField
            label={`${m.emailLabel} (${m.filled})`}
            defaultValue={m.emailFilled}
            type="email"
          />
          <TextField
            label={`${m.emailLabel} (${m.invalid})`}
            defaultValue={m.emailInvalidValue}
            isInvalid
            errorMessage={m.emailError}
            type="email"
          />
          <TextField
            label={`${m.emailLabel} (${m.disabled})`}
            defaultValue={m.emailFilled}
            isDisabled
            type="email"
          />
          <TextField
            label={`${m.emailLabel} (${m.readOnly})`}
            defaultValue={m.emailFilled}
            isReadOnly
            type="email"
          />
        </div>
      </Section>

      <Section id="tabs" title={m.tabs}>
        <Tabs
          label={m.tabsLabel}
          items={[
            { id: "lesson", title: m.tabLesson, content: <p>{m.tabLessonBody}</p> },
            { id: "code", title: m.tabCode, content: <p>{m.tabCodeBody}</p> },
            { id: "output", title: m.tabOutput, content: <p>{m.tabOutputBody}</p> },
          ]}
        />
      </Section>

      <Section id="dialog" title={m.dialogs}>
        <div className="flex">
          <Dialog
            trigger={<Button variant="secondary">{m.openDialog}</Button>}
            title={m.dialogTitle}
          >
            {(close) => (
              <>
                <p className="text-base text-text-muted">{m.dialogBody}</p>
                <DialogActions>
                  <Button variant="secondary" surface="raised" onPress={close}>
                    {m.dialogCancel}
                  </Button>
                  <Button variant="destructive" surface="raised" onPress={close}>
                    {m.dialogConfirm}
                  </Button>
                </DialogActions>
              </>
            )}
          </Dialog>
        </div>
      </Section>

      <Section id="disclosures" title={m.disclosures}>
        <Example label={m.closed}>
          <Disclosure title={m.disclosureTitle}>{m.disclosureBody}</Disclosure>
        </Example>
        <Example label={m.expanded}>
          <Disclosure title={m.disclosureTitle} defaultExpanded>
            {m.disclosureBody}
          </Disclosure>
        </Example>
      </Section>

      <Section id="notices" title={m.notices}>
        <div className="flex max-w-prose flex-col gap-3">
          <Notice kind="information" kindLabel={m.information}>
            {m.informationBody}
          </Notice>
          <Notice kind="warning" kindLabel={m.warning}>
            {m.warningBody}
          </Notice>
          <Notice kind="error" kindLabel={m.error}>
            {m.errorBody}
          </Notice>
          <Notice kind="success" kindLabel={m.success}>
            {m.successBody}
          </Notice>
        </div>
      </Section>

      <Section id="progress" title={m.progress}>
        <div className="flex max-w-prose flex-col gap-5">
          <Progress label={m.progressLabel} value={0} maxValue={5.5} valueLabel={m.progressEmpty} />
          <Progress
            label={m.progressLabel}
            value={2.7}
            maxValue={5.5}
            valueLabel={m.progressPart}
          />
          <Progress
            label={m.progressLabel}
            value={5.5}
            maxValue={5.5}
            valueLabel={m.progressFull}
          />
        </div>
      </Section>

      <Section id="status" title={m.status}>
        <div className="flex flex-wrap items-center gap-3">
          <Status state="pass" label={m.passed} />
          <Status state="fail" label={m.failed} />
          <Status state="not-run" label={m.notRun} />
        </div>
      </Section>
    </div>
  );
}
