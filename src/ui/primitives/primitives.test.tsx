// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Button, Dialog, Disclosure, Link, Notice, Progress, Status, Tabs, TextField } from "@/ui";

afterEach(cleanup);

describe("Button", () => {
  it("[ADR-0014] is a native button that runs its action from the keyboard", async () => {
    const onPress = vi.fn();
    render(
      <Button variant="primary" onPress={onPress}>
        Check
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Check" });
    expect(button.tagName).toBe("BUTTON");
    button.focus();
    await userEvent.keyboard("{Enter}");
    expect(onPress).toHaveBeenCalledOnce();
  });

  it("[ADR-0014] does nothing when disabled and says so to assistive technology", async () => {
    const onPress = vi.fn();
    render(
      <Button variant="secondary" isDisabled onPress={onPress}>
        Run
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Run" });
    expect(button).toHaveProperty("disabled", true);
    await userEvent.click(button);
    expect(onPress).not.toHaveBeenCalled();
  });

  it("[ADR-0014] hides a decorative icon and keeps the label as the name", () => {
    render(
      <Button variant="destructive" icon={<svg data-testid="icon" />}>
        Delete test case
      </Button>,
    );
    expect(screen.getByRole("button", { name: "Delete test case" })).toBeTruthy();
    expect(screen.getByTestId("icon").parentElement?.getAttribute("aria-hidden")).toBe("true");
  });
});

describe("Link", () => {
  it("[ADR-0014] marks the current navigation link with aria-current", () => {
    render(
      <nav>
        <Link href="/courses" variant="nav" current>
          Courses
        </Link>
        <Link href="/profile" variant="nav">
          Profile
        </Link>
      </nav>,
    );
    expect(screen.getByRole("link", { name: "Courses" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("link", { name: "Profile" }).getAttribute("aria-current")).toBeNull();
  });

  // Tailwind orders utilities in the stylesheet, not in the class attribute, so
  // a current link that also carried the resting classes would render as one at
  // rest. The computed colors are checked in e2e/gallery.spec.ts.
  it("[ADR-0014] gives the current navigation link only the current color and marker", () => {
    render(
      <nav>
        <Link href="/courses" variant="nav" current>
          Courses
        </Link>
        <Link href="/profile" variant="nav">
          Profile
        </Link>
      </nav>,
    );
    const current = screen.getByRole("link", { name: "Courses" }).classList;
    const rest = screen.getByRole("link", { name: "Profile" }).classList;
    expect(current.contains("border-action")).toBe(true);
    expect(current.contains("text-text")).toBe(true);
    expect(current.contains("border-transparent")).toBe(false);
    expect(current.contains("text-text-muted")).toBe(false);
    expect(rest.contains("border-transparent")).toBe(true);
    expect(rest.contains("text-text-muted")).toBe(true);
    expect(rest.contains("border-action")).toBe(false);
  });

  it("[ADR-0014] underlines a link in running text, so it is not marked by color alone", () => {
    render(
      <Link href="/a" variant="inline">
        first lesson
      </Link>,
    );
    const classes = screen.getByRole("link", { name: "first lesson" }).className.split(/\s+/);
    expect(classes).toContain("underline");
    expect(classes).not.toContain("no-underline");
  });
});

describe("TextField", () => {
  it("[ADR-0014] has a visible label tied to the field and a description", () => {
    render(
      <TextField
        label="Email address"
        description="We send a code."
        placeholder="name@example.com"
      />,
    );
    const field = screen.getByRole("textbox", { name: "Email address" });
    expect(field.getAttribute("placeholder")).toBe("name@example.com");
    expect(screen.getByRole("textbox", { description: "We send a code." })).toBe(field);
  });

  it("[ADR-0014] shows the error sentence and marks the field invalid", () => {
    render(
      <TextField
        label="Email address"
        isInvalid
        errorMessage="Enter an email address with an @ sign."
      />,
    );
    const field = screen.getByRole("textbox", { name: "Email address" });
    expect(field.getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByText("Enter an email address with an @ sign.")).toBeTruthy();
  });

  it("[ADR-0014] supports disabled and read-only fields", () => {
    render(
      <>
        <TextField label="Disabled" isDisabled />
        <TextField label="Read-only" isReadOnly />
      </>,
    );
    expect(screen.getByRole("textbox", { name: "Disabled" })).toHaveProperty("disabled", true);
    expect(screen.getByRole("textbox", { name: "Read-only" })).toHaveProperty("readOnly", true);
  });
});

describe("Tabs", () => {
  it("[ADR-0014] moves the selection with the arrow keys and shows the matching panel", async () => {
    render(
      <Tabs
        label="Lesson views"
        items={[
          { id: "lesson", title: "Lesson", content: <p>Instructions</p> },
          { id: "code", title: "Code", content: <p>Editor</p> },
        ]}
      />,
    );
    expect(screen.getByRole("tablist", { name: "Lesson views" })).toBeTruthy();
    const lesson = screen.getByRole("tab", { name: "Lesson" });
    expect(lesson.getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("tabpanel").textContent).toBe("Instructions");
    await userEvent.click(lesson);
    await userEvent.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Code" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("tabpanel").textContent).toBe("Editor");
  });
});

describe("Dialog", () => {
  it("[ADR-0014] opens from its trigger, closes on Escape, and returns focus", async () => {
    render(
      <Dialog trigger={<Button variant="secondary">Reset code</Button>} title="Reset your code?">
        {(close) => (
          <Button variant="secondary" onPress={close}>
            Keep my code
          </Button>
        )}
      </Dialog>,
    );
    const trigger = screen.getByRole("button", { name: "Reset code" });
    trigger.focus();
    await userEvent.keyboard("{Enter}");
    expect(screen.getByRole("dialog", { name: "Reset your code?" })).toBeTruthy();
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });

  it("[ADR-0014] closes from an action inside it", async () => {
    render(
      <Dialog trigger={<Button variant="secondary">Reset code</Button>} title="Reset your code?">
        {(close) => (
          <Button variant="secondary" onPress={close}>
            Keep my code
          </Button>
        )}
      </Dialog>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Reset code" }));
    await userEvent.click(screen.getByRole("button", { name: "Keep my code" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("Disclosure", () => {
  it("[ADR-0014] reports its state with aria-expanded and shows the panel when open", async () => {
    render(<Disclosure title="Test 2: prints the total">Expected 15.</Disclosure>);
    const trigger = screen.getByRole("button", { name: "Test 2: prints the total" });
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    await userEvent.click(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText("Expected 15.")).toBeTruthy();
  });

  it("[ADR-0014] can be opened by its owner, and reports a press without changing itself", async () => {
    const onExpandedChange = vi.fn();
    const { rerender } = render(
      <Disclosure title="Test 3" isExpanded={false} onExpandedChange={onExpandedChange}>
        Expected 20.
      </Disclosure>,
    );
    const trigger = screen.getByRole("button", { name: "Test 3" });
    await userEvent.click(trigger);
    expect(onExpandedChange).toHaveBeenCalledWith(true);
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    rerender(
      <Disclosure title="Test 3" isExpanded onExpandedChange={onExpandedChange}>
        Expected 20.
      </Disclosure>,
    );
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
  });
});

describe("Notice", () => {
  it("[ADR-0014] names its kind in words before the sentence", () => {
    render(
      <Notice kind="warning" kindLabel="Warning">
        This browser cannot pause for input.
      </Notice>,
    );
    expect(screen.getByText(/Warning:/).parentElement?.textContent).toBe(
      "Warning: This browser cannot pause for input.",
    );
  });

  it("[ADR-0014] is announced only when asked to", () => {
    const { rerender } = render(
      <Notice kind="error" kindLabel="Error">
        Python could not start.
      </Notice>,
    );
    expect(screen.queryByRole("alert")).toBeNull();
    rerender(
      <Notice kind="error" kindLabel="Error" announce="assertive">
        Python could not start.
      </Notice>,
    );
    expect(screen.getByRole("alert")).toBeTruthy();
  });
});

describe("Progress", () => {
  it("[ADR-0014] exposes its value and always shows it as text", () => {
    render(
      <Progress label="Starting Python" value={2.7} maxValue={5.5} valueLabel="2.7 of 5.5 MB" />,
    );
    const bar = screen.getByRole("progressbar", { name: "Starting Python" });
    expect(bar.getAttribute("aria-valuenow")).toBe("2.7");
    expect(bar.getAttribute("aria-valuetext")).toBe("2.7 of 5.5 MB");
    expect(screen.getByText("2.7 of 5.5 MB")).toBeTruthy();
  });
});

describe("Status", () => {
  it.each([
    ["pass", "Passed"],
    ["fail", "Failed"],
    ["not-run", "Not run"],
  ] as const)("[ADR-0014] shows the %s state with an icon and a word", (state, label) => {
    const { container } = render(<Status state={state} label={label} />);
    expect(container.textContent).toBe(label);
    expect(container.querySelector('[aria-hidden="true"] svg')).not.toBeNull();
  });
});
