"use client";

import {
  type ComponentType,
  type FormEvent,
  useActionState,
  useEffect,
  useState,
  useTransition,
} from "react";
import Image from "next/image";
import { signIn as words } from "@/messages/sign-in";
import { Button, Notice, TextField } from "@/ui";
import type { ActionOutcome, StartGoogleState } from "../types";
import { BotChallenge, type BotChallengeProps } from "./bot-challenge";

// The sign-in view (docs/spec/03-experience.md sections 5.4 and 8; FR-AUTH-01
// to FR-AUTH-04, FR-AUTH-06). One column: Google's button, then the email
// code. In an in-app browser the email code leads and a sentence says why.
// States: sending, verifying, wrong or expired code, too many attempts,
// provider down, challenge not loaded, Google failed.

/** Seconds before a new code may be asked for: the provider's limit (supabase/config.toml). */
export const RESEND_SECONDS = 60;

export type SignInActions = {
  requestEmailCode: (input: {
    email: string;
    challengeToken: string;
  }) => Promise<ActionOutcome<null>>;
  verifyEmailCode: (input: {
    email: string;
    code: string;
    returnTo: string;
  }) => Promise<ActionOutcome<{ returnTo: string }>>;
  startGoogleSignIn: (previous: StartGoogleState, form: FormData) => Promise<StartGoogleState>;
};

export type SignInViewProps = {
  returnTo: string;
  inAppBrowser: boolean;
  googleFailed: boolean;
  challengeSiteKey: string;
  actions: SignInActions;
  /** Where the browser goes after sign-in. A full navigation, so every page renders signed in. */
  navigate?: (path: string) => void;
  Challenge?: ComponentType<BotChallengeProps>;
};

type Step = { name: "email" } | { name: "code"; email: string };
type Message = { kind: "error" | "information" | "success"; text: string };

function sendFailureText(error: string): string {
  switch (error) {
    case "rate_limited":
      return words.sendRateLimited;
    case "challenge_failed":
      return words.challengeFailed;
    default:
      return words.unavailable;
  }
}

function verifyFailureText(error: string): string {
  switch (error) {
    case "code_rejected":
      return words.codeRejected;
    case "rate_limited":
      return words.tooManyAttempts;
    default:
      return words.unavailable;
  }
}

const noticeLabel = {
  error: words.errorLabel,
  information: words.informationLabel,
  success: words.successLabel,
} as const;

export function SignInView({
  returnTo,
  inAppBrowser,
  googleFailed,
  challengeSiteKey,
  actions,
  navigate = (path) => window.location.assign(path),
  Challenge = BotChallenge,
}: SignInViewProps) {
  const [step, setStep] = useState<Step>({ name: "email" });
  const [email, setEmail] = useState("");
  const [emailInvalid, setEmailInvalid] = useState(false);
  const [code, setCode] = useState("");
  const [codeInvalid, setCodeInvalid] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [challengeReset, setChallengeReset] = useState(0);
  const [challengeMissing, setChallengeMissing] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [showGoogle, setShowGoogle] = useState(!inAppBrowser);
  // Set when the learner's own action removes the control that had focus,
  // so focus lands on the field or button they need next.
  const [focusEmail, setFocusEmail] = useState(false);
  const [focusGoogle, setFocusGoogle] = useState(false);
  const [pending, startTransition] = useTransition();
  const [pendingKind, setPendingKind] = useState<"send" | "verify" | null>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((seconds) => seconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  function sendCode(address: string, resend: boolean) {
    if (token === null) {
      setMessage({ kind: "error", text: words.challengeNeeded });
      return;
    }
    const challengeToken = token;
    // A token can be used once: it is dropped now, and the widget, reset or
    // mounted anew, hands out the next one.
    setToken(null);
    setPendingKind("send");
    startTransition(async () => {
      const result = await actions.requestEmailCode({ email: address, challengeToken });
      setChallengeReset((count) => count + 1);
      setPendingKind(null);
      if (result.ok) {
        setCooldown(RESEND_SECONDS);
        setCode("");
        setMessage(resend ? { kind: "success", text: words.resent } : null);
        setStep({ name: "code", email: address });
        return;
      }
      if (result.error === "invalid_input") {
        setEmailInvalid(true);
        setMessage(null);
        return;
      }
      setMessage({ kind: "error", text: sendFailureText(result.error) });
    });
  }

  function onEmailSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const address = email.trim();
    if (!address.includes("@")) {
      setEmailInvalid(true);
      return;
    }
    setEmailInvalid(false);
    sendCode(address, false);
  }

  function onCodeSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (step.name !== "code") return;
    const digits = code.replace(/\s/g, "");
    if (!/^\d{6}$/.test(digits)) {
      setCodeInvalid(true);
      return;
    }
    setCodeInvalid(false);
    setPendingKind("verify");
    startTransition(async () => {
      const result = await actions.verifyEmailCode({ email: step.email, code: digits, returnTo });
      setPendingKind(null);
      if (result.ok) {
        navigate(result.value.returnTo);
        return;
      }
      if (result.error === "invalid_input") {
        setCodeInvalid(true);
        setMessage(null);
        return;
      }
      setMessage({ kind: "error", text: verifyFailureText(result.error) });
    });
  }

  const challenge = challengeMissing ? (
    <Notice kind="error" kindLabel={words.errorLabel} announce="assertive">
      {words.challengeNotLoaded}
    </Notice>
  ) : (
    <div className="flex flex-col gap-2">
      {/* Kept in the layout when hidden, so the button below does not move. */}
      <p className={token === null ? "text-sm text-text-muted" : "invisible text-sm"}>
        {words.challengeLoading}
      </p>
      <Challenge
        siteKey={challengeSiteKey}
        onToken={setToken}
        onLoadFailed={() => setChallengeMissing(true)}
        resetKey={challengeReset}
      />
    </div>
  );

  const notice = message !== null && (
    <Notice
      kind={message.kind}
      kindLabel={noticeLabel[message.kind]}
      announce={message.kind === "error" ? "assertive" : "polite"}
    >
      {message.text}
    </Notice>
  );

  const emailSection =
    step.name === "email" ? (
      <section aria-labelledby="sign-in-email" className="flex flex-col gap-5">
        <h2 id="sign-in-email" className="text-lg font-semibold text-text">
          {words.emailHeading}
        </h2>
        <form noValidate onSubmit={onEmailSubmit} className="flex flex-col gap-5">
          <TextField
            label={words.emailLabel}
            description={words.emailDescription}
            type="email"
            name="email"
            autoComplete="email"
            isRequired
            value={email}
            onChange={(value) => {
              setEmail(value);
              setEmailInvalid(false);
            }}
            isInvalid={emailInvalid}
            errorMessage={words.emailInvalid}
            autoFocus={focusEmail}
          />
          {challenge}
          {notice}
          <Button type="submit" variant="primary" isDisabled={pending}>
            {pendingKind === "send" ? words.sending : words.sendCode}
          </Button>
        </form>
      </section>
    ) : (
      <section aria-labelledby="sign-in-code" className="flex flex-col gap-5">
        <h2 id="sign-in-code" className="text-lg font-semibold text-text">
          {words.codeHeading}
        </h2>
        <p className="text-base text-text-muted">{words.codeSentTo(step.email)}</p>
        <form noValidate onSubmit={onCodeSubmit} className="flex flex-col gap-5">
          <TextField
            label={words.codeLabel}
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={32}
            value={code}
            onChange={(value) => {
              setCode(value);
              setCodeInvalid(false);
            }}
            isInvalid={codeInvalid}
            errorMessage={words.codeInvalid}
            // The code step replaces the email form, so focus moves to the
            // field the learner needs next.
            autoFocus
          />
          {notice}
          <Button type="submit" variant="primary" isDisabled={pending}>
            {pendingKind === "verify" ? words.verifying : words.verify}
          </Button>
        </form>
        <div className="flex flex-col gap-3">
          {/* The check is needed only for a new code, so it appears when one
              may be asked for. */}
          {cooldown === 0 && challenge}
          <Button
            variant="secondary"
            isDisabled={pending || cooldown > 0}
            onPress={() => sendCode(step.email, true)}
          >
            {pendingKind === "send" ? words.sending : words.resend}
          </Button>
          {cooldown > 0 && (
            <p className="text-sm text-text-muted" aria-live="off">
              {words.resendWait(cooldown)}
            </p>
          )}
          <Button
            variant="secondary"
            isDisabled={pending}
            onPress={() => {
              setStep({ name: "email" });
              setMessage(null);
              setCodeInvalid(false);
              setFocusEmail(true);
            }}
          >
            {words.changeEmail}
          </Button>
        </div>
      </section>
    );

  const googleSection = showGoogle && (
    <GoogleSection
      returnTo={returnTo}
      startGoogleSignIn={actions.startGoogleSignIn}
      focusOnMount={focusGoogle}
    />
  );

  return (
    <div className="mx-auto flex w-full max-w-dialog flex-col gap-6 px-gutter py-7">
      <div className="flex flex-col gap-3">
        <h1 className="text-xl font-semibold text-text">{words.title}</h1>
        <p className="text-base text-text-muted">{words.intro}</p>
      </div>
      {googleFailed && (
        <Notice kind="error" kindLabel={words.errorLabel}>
          {words.googleFailed}
        </Notice>
      )}
      {inAppBrowser ? (
        <>
          <Notice kind="information" kindLabel={words.informationLabel}>
            {words.inAppBrowser}
          </Notice>
          {emailSection}
          {showGoogle ? (
            googleSection
          ) : (
            <Button
              variant="secondary"
              onPress={() => {
                setShowGoogle(true);
                setFocusGoogle(true);
              }}
            >
              {words.showGoogle}
            </Button>
          )}
        </>
      ) : (
        <>
          {googleSection}
          {emailSection}
        </>
      )}
    </div>
  );
}

function GoogleSection({
  returnTo,
  startGoogleSignIn,
  focusOnMount,
}: {
  returnTo: string;
  startGoogleSignIn: SignInActions["startGoogleSignIn"];
  focusOnMount: boolean;
}) {
  const [state, formAction, pending] = useActionState(startGoogleSignIn, { failed: false });
  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="returnTo" value={returnTo} />
      {/* Google's own dark button, unaltered (DESIGN.md section 8). The
          image carries Google's words; the button's name says the same. */}
      <button
        type="submit"
        disabled={pending}
        // True only after the learner asked to see this button.
        autoFocus={focusOnMount}
        aria-label={words.google}
        className="inline-flex min-h-target items-center self-start rounded-control disabled:cursor-not-allowed"
      >
        <Image
          src="/third-party/google/sign-in-with-google-dark.svg"
          alt=""
          width={180}
          height={40}
          unoptimized
        />
      </button>
      {pending && (
        <p role="status" className="text-sm text-text-muted">
          {words.googleOpening}
        </p>
      )}
      {state.failed && !pending && (
        <Notice kind="error" kindLabel={words.errorLabel} announce="assertive">
          {words.googleUnavailable}
        </Notice>
      )}
    </form>
  );
}
