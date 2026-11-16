#!/usr/bin/env node
// Claude Code PreToolUse hook (docs/spec/05-engineering-handbook.md section 2,
// layer 2; threat T-18). It blocks what the permission rules in
// .claude/settings.json deny, in the forms a pattern rule misses: reading
// secret files, force push, push to main, deleting remote branches, skipping
// Git hooks, disabling checks, merging, and AI attribution in commits, pull
// requests, issues, and API calls.
//
// This is a second layer, not a sandbox. A determined rewording can still get
// past it, which is why the pipeline and branch protection exist (layer 3).
//
// Contract: JSON on standard input; exit 0 to allow; exit 2 with the reason on
// standard error to block. Input it cannot parse is blocked.

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { findAttribution, findIdentityAttribution } from "./check-attribution.mjs";

/** @typedef {{ decision: "allow" } | { decision: "block", reason: string }} Verdict */
/**
 * @typedef {object} Context
 * @property {string} projectDir
 * @property {() => string} currentBranch
 * @property {(path: string) => string | undefined} readFile
 */
/** The context while checking one shell command, which some checks read whole. @typedef {Context & { command: string }} ShellContext */

/** @type {Verdict} */
const ALLOW = { decision: "allow" };
/** @param {string} reason @returns {Verdict} */
const block = (reason) => ({ decision: "block", reason });

const PROTECTED_BRANCH = "main";
const HOOKS_DIR = ".githooks";
const EXAMPLE_ENV = ".env.example";

// ---------------------------------------------------------------- secrets

/** @param {string} name */
function isSecretFileName(name) {
  return /^\.env(?:\..+)?$/.test(name) && name !== EXAMPLE_ENV;
}

/** A path or a glob whose last segment could select a secret file. @param {string} path */
function isSecretPathOrGlob(path) {
  const last = basename(path);
  return /^\.env(?:$|[.*?[{])/.test(last) && last !== EXAMPLE_ENV;
}

// Finds `.env` or `.env.<anything>` standing as its own word inside a larger
// string, such as code passed to `node -e`. `process.env` does not match,
// because the character before the dot is a letter.
// Shell globs such as `.env*` or `.env.?ocal` count: the shell expands them.
const SECRET_IN_TEXT = /(?:^|[\s'"=/:(<>,;|&`])(\.env(?:[.*?[][\w.*?[\]-]*)?)(?=$|[\s'"),;|&<>`])/g;

/** @param {string} text */
function mentionsSecretFile(text) {
  for (const match of text.matchAll(SECRET_IN_TEXT)) {
    if (match[1] !== EXAMPLE_ENV) return true;
  }
  return false;
}

/** @param {string} token */
function isSecretPathToken(token) {
  const value = token.replace(/^--?[\w-]+=/, "");
  const afterColon = value.includes(":") ? value.slice(value.lastIndexOf(":") + 1) : value;
  return isSecretPathOrGlob(afterColon);
}

// ---------------------------------------------------------------- shell words

/**
 * Splits a shell command into simple commands, each a list of words, with
 * quotes removed. Pipes, lists, subshells, command substitution, and new lines
 * all start a new simple command. Redirection operators are kept as words.
 *
 * @param {string} command
 * @returns {string[][]}
 */
export function splitCommands(command) {
  /** @type {string[][]} */
  const commands = [[]];
  /** @type {string | null} */
  let word = null;
  const current = () => /** @type {string[]} */ (commands[commands.length - 1]);
  const endWord = () => {
    if (word !== null) current().push(word);
    word = null;
  };
  const endCommand = () => {
    endWord();
    if (current().length > 0) commands.push([]);
  };
  let i = 0;
  while (i < command.length) {
    const c = command.charAt(i);
    const next = command.charAt(i + 1);
    if (c === "'") {
      const end = command.indexOf("'", i + 1);
      const stop = end === -1 ? command.length : end;
      word = (word ?? "") + command.slice(i + 1, stop);
      i = stop + 1;
    } else if (c === '"') {
      let text = "";
      i += 1;
      while (i < command.length && command.charAt(i) !== '"') {
        if (command.charAt(i) === "\\" && i + 1 < command.length) {
          text += command.charAt(i + 1);
          i += 2;
        } else {
          text += command.charAt(i);
          i += 1;
        }
      }
      i += 1;
      word = (word ?? "") + text;
    } else if (c === "\\" && i + 1 < command.length) {
      if (next !== "\n") word = (word ?? "") + next;
      i += 2;
    } else if (c === "\n") {
      endCommand();
      i += 1;
    } else if (/\s/.test(c)) {
      endWord();
      i += 1;
    } else if (c === "$" && next === "(") {
      endCommand();
      i += 2;
    } else if (";|&()`".includes(c)) {
      endCommand();
      i += 1;
    } else if (c === "<" || c === ">") {
      endWord();
      let operator = c;
      i += 1;
      while ("<>&-'\"".includes(command.charAt(i)) && i < command.length) {
        operator += command.charAt(i);
        i += 1;
      }
      current().push(operator);
    } else {
      word = (word ?? "") + c;
      i += 1;
    }
  }
  endWord();
  return commands.filter((words) => words.length > 0);
}

const WRAPPERS = new Set([
  "sudo",
  "env",
  "command",
  "exec",
  "nohup",
  "time",
  "xargs",
  "builtin",
  "timeout",
  "nice",
  "ionice",
  "stdbuf",
  "caffeinate",
  "npx",
  "pnpx",
]);
// Options of a wrapper that take the next word as their value.
const WRAPPER_OPTIONS_WITH_VALUE = new Set(["-u", "-g", "-n", "-s", "-k", "-C", "-c", "-p"]);
const PACKAGE_RUNNERS = new Set(["pnpm", "npm", "yarn", "bun"]);
const SHELLS = new Set(["sh", "bash", "zsh", "dash", "ksh", "fish"]);

/** @param {string[]} words */
function stripWrappers(words) {
  let start = 0;
  while (start < words.length) {
    const word = words[start] ?? "";
    const name = basename(word);
    if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(word)) {
      start += 1;
    } else if (WRAPPERS.has(name)) {
      start += 1;
      // Skip the wrapper's own options and, for `timeout` and `nice`, a number.
      while (start < words.length) {
        const option = words[start] ?? "";
        if (option.startsWith("-") && !/^-\d/.test(option)) {
          start += WRAPPER_OPTIONS_WITH_VALUE.has(option) ? 2 : 1;
        } else if (
          (name === "timeout" || name === "nice") &&
          /^[+-]?\d+(?:\.\d+)?[smhd]?$/.test(option)
        ) {
          start += 1;
        } else {
          break;
        }
      }
    } else if (PACKAGE_RUNNERS.has(name) && ["exec", "dlx", "x"].includes(words[start + 1] ?? "")) {
      start += 2;
    } else {
      break;
    }
  }
  return words.slice(start);
}

/**
 * @param {string} file
 * @param {ShellContext} context
 * @param {string} cwd
 */
function readRelative(file, context, cwd) {
  return context.readFile(resolve(cwd, file));
}

/**
 * @param {string} text
 * @returns {boolean}
 */
function hasAttribution(text) {
  return findAttribution(text).length > 0;
}

// ---------------------------------------------------------------- git

/**
 * Git accepts any unambiguous prefix of a long option, so `--no-veri` is
 * `--no-verify`. A word counts as the option when it is a prefix of it at
 * least `minimum` characters long.
 *
 * @param {string} word
 * @param {string} option
 * @param {number} minimum
 */
function isLongOption(word, option, minimum) {
  const name = word.split("=")[0] ?? "";
  return name.length >= minimum && option.startsWith(name);
}

/** @param {string} word */
const skipsHooks = (word) => isLongOption(word, "--no-verify", 6);

const GIT_GLOBAL_WITH_VALUE = new Set([
  "-C",
  "-c",
  "--git-dir",
  "--work-tree",
  "--namespace",
  "--exec-path",
  "--config-env",
]);

/**
 * @param {string[]} args the words after `git`
 * @param {ShellContext} context
 * @param {string} cwd
 * @returns {Verdict}
 */
function checkGit(args, context, cwd) {
  let i = 0;
  while (i < args.length && (args[i] ?? "").startsWith("-")) {
    const option = args[i] ?? "";
    if (option === "-c" || option === "--config-env") {
      const setting = args[i + 1] ?? "";
      if (/^core\.hookspath[=]?/i.test(setting))
        return block("skipping Git hooks (core.hooksPath override)");
      if (/^alias\./i.test(setting)) return block("defining a Git alias on the command line");
    }
    if (/^--config-env=core\.hookspath/i.test(option))
      return block("skipping Git hooks (core.hooksPath override)");
    i += GIT_GLOBAL_WITH_VALUE.has(option) ? 2 : 1;
  }
  const sub = args[i] ?? "";
  const rest = args.slice(i + 1);

  if (rest.some(skipsHooks)) return block("skipping Git hooks (--no-verify)");

  switch (sub) {
    case "push":
      return checkPush(rest, context);
    case "commit":
      return checkCommit(rest, context, cwd);
    case "config":
      return checkConfig(rest);
    case "update-ref":
      if (rest.some((word) => word === `refs/heads/${PROTECTED_BRANCH}`)) {
        return block(`moving ${PROTECTED_BRANCH} directly`);
      }
      return ALLOW;
    default:
      return ALLOW;
  }
}

const PUSH_WITH_VALUE = new Set(["-o", "--push-option", "--repo", "--receive-pack", "--exec"]);

/**
 * @param {string[]} args
 * @param {ShellContext} context
 * @returns {Verdict}
 */
function checkPush(args, context) {
  /** @type {string[]} */
  const positional = [];
  for (let i = 0; i < args.length; i += 1) {
    const word = args[i] ?? "";
    if (PUSH_WITH_VALUE.has(word)) {
      i += 1;
      continue;
    }
    if (word.startsWith("--")) {
      if (
        isLongOption(word, "--force-with-lease", 5) ||
        isLongOption(word, "--force-if-includes", 5)
      ) {
        return block("force push");
      }
      if (isLongOption(word, "--mirror", 4)) {
        return block("force push (--mirror rewrites every remote branch)");
      }
      if (isLongOption(word, "--all", 4) || isLongOption(word, "--branches", 4)) {
        return block(`push to ${PROTECTED_BRANCH} (--all includes it)`);
      }
      if (isLongOption(word, "--delete", 5) || isLongOption(word, "--prune", 5)) {
        return block("deleting branches on the remote");
      }
      continue;
    }
    if (word.startsWith("-") && word.length > 1) {
      if (word.includes("f")) return block("force push");
      if (word.includes("d")) return block("deleting branches on the remote");
      continue;
    }
    positional.push(word);
  }
  const refspecs = positional.slice(1);
  if (refspecs.length === 0) {
    if (context.currentBranch() === PROTECTED_BRANCH) {
      return block(`push to ${PROTECTED_BRANCH} (it is the checked-out branch)`);
    }
    return ALLOW;
  }
  for (const refspec of refspecs) {
    if (refspec.startsWith("+")) return block("force push (+refspec)");
    if (refspec.startsWith(":")) return block("deleting branches on the remote");
    const destination = refspec.includes(":") ? refspec.slice(refspec.indexOf(":") + 1) : refspec;
    const branch = destination.replace(/^refs\/heads\//, "");
    const resolved = branch === "HEAD" || branch === "@" ? context.currentBranch() : branch;
    if (resolved === PROTECTED_BRANCH) return block(`push to ${PROTECTED_BRANCH}`);
  }
  return ALLOW;
}

const COMMIT_SHORT_WITH_VALUE = new Set(["m", "F", "C", "c", "t"]);
// Short options whose value, if any, is attached: `-uno`, `-Skey`.
const COMMIT_SHORT_OPTIONAL_VALUE = new Set(["u", "S"]);

/**
 * @param {string[]} args
 * @param {ShellContext} context
 * @param {string} cwd
 * @returns {Verdict}
 */
function checkCommit(args, context, cwd) {
  /** @type {string[]} */
  const messageFiles = [];
  for (let i = 0; i < args.length; i += 1) {
    const word = args[i] ?? "";
    if (word === "--file" || word === "-F") {
      messageFiles.push(args[i + 1] ?? "");
      i += 1;
      continue;
    }
    if (word.startsWith("--file=")) {
      messageFiles.push(word.slice("--file=".length));
      continue;
    }
    if (word === "--author" || word.startsWith("--author=")) {
      const author = word === "--author" ? (args[i + 1] ?? "") : word.slice("--author=".length);
      const match = /^(.*?)\s*<([^>]*)>/.exec(author);
      const identity = { name: match?.[1] ?? author, email: match?.[2] ?? "" };
      if (findIdentityAttribution(identity).length > 0)
        return block("AI attribution (commit author)");
      continue;
    }
    if (word === "-m" || word === "--message") {
      i += 1;
      continue;
    }
    if (/^-[A-Za-z]/.test(word) && !word.startsWith("--")) {
      for (const flag of word.slice(1)) {
        if (flag === "n") return block("skipping Git hooks (-n is --no-verify)");
        if (COMMIT_SHORT_OPTIONAL_VALUE.has(flag)) break;
        if (COMMIT_SHORT_WITH_VALUE.has(flag)) {
          if (flag === "F" && word.endsWith("F")) {
            messageFiles.push(args[i + 1] ?? "");
          }
          if (word.endsWith(flag)) i += 1;
          break;
        }
      }
    }
  }
  for (const file of messageFiles) {
    if (file === "") continue;
    if (file === "-") {
      if (!context.command.includes("<<")) {
        return block("AI attribution check cannot read a message piped from another command");
      }
      continue;
    }
    const text = readRelative(file, context, cwd);
    if (text === undefined)
      return block(`AI attribution check could not read the message file ${file}`);
    if (hasAttribution(text)) return block("AI attribution (commit message file)");
  }
  return ALLOW;
}

const CONFIG_OPTIONS_WITH_VALUE = new Set([
  "--file",
  "-f",
  "--blob",
  "--type",
  "--default",
  "--comment",
  "--value",
]);
const CONFIG_SUBCOMMANDS = new Set([
  "set",
  "unset",
  "get",
  "list",
  "edit",
  "rename-section",
  "remove-section",
]);

/**
 * Handles both the old form (`git config --unset key`) and the subcommand
 * form of Git 2.46 and later (`git config unset key`).
 *
 * @param {string[]} args
 * @returns {Verdict}
 */
function checkConfig(args) {
  let unsetting = false;
  let editing = false;
  /** @type {string[]} */
  const positional = [];
  for (let i = 0; i < args.length; i += 1) {
    const word = args[i] ?? "";
    if (CONFIG_OPTIONS_WITH_VALUE.has(word)) {
      i += 1;
      continue;
    }
    if (word.startsWith("--unset") || word === "--remove-section") unsetting = true;
    else if (word === "--edit" || word === "-e") editing = true;
    else if (!word.startsWith("-")) positional.push(word);
  }
  const subcommand = CONFIG_SUBCOMMANDS.has(positional[0] ?? "") ? positional.shift() : undefined;
  if (subcommand === "unset" || subcommand === "remove-section") unsetting = true;
  if (subcommand === "edit") editing = true;
  if (editing) return block("editing Git configuration by hand (it holds core.hooksPath)");
  if (subcommand === "get" || subcommand === "list") return ALLOW;

  const key = positional[0] ?? "";
  const value = positional[1];
  if (unsetting && /^(?:core|alias)$/i.test(key)) {
    return block("removing a Git configuration section that holds the hooks or aliases");
  }
  if (/^core\.hookspath$/i.test(key)) {
    if (unsetting) return block("skipping Git hooks (unsetting core.hooksPath)");
    if (value !== undefined && value !== HOOKS_DIR) {
      return block("skipping Git hooks (core.hooksPath override)");
    }
  }
  if (/^alias\./i.test(key) && (value !== undefined || unsetting)) {
    return block("defining a Git alias");
  }
  return ALLOW;
}

// ---------------------------------------------------------------- gh

const GH_BODY_COMMANDS = new Set(["pr", "issue", "release"]);
const GH_API_WITH_VALUE = new Set([
  "-X",
  "--method",
  "-f",
  "--raw-field",
  "-F",
  "--field",
  "-H",
  "--header",
  "--input",
  "-q",
  "--jq",
  "-t",
  "--template",
  "--hostname",
  "--cache",
  "-p",
  "--preview",
]);

/**
 * @param {string[]} args the words after `gh`
 * @param {ShellContext} context
 * @param {string} cwd
 * @returns {Verdict}
 */
function checkGh(args, context, cwd) {
  const [group = "", action = ""] = args;
  const rest = args.slice(2);

  if (group === "pr" && action === "merge") return block("merging (the owner merges)");
  if (group === "workflow" && action === "disable")
    return block("disabling a check (workflow disable)");
  if (group === "ruleset" && !["list", "ls", "view", "check"].includes(action)) {
    return block("changing repository rulesets");
  }
  if (group === "repo" && action === "delete") return block("deleting the repository");
  if (group === "repo" && action === "archive") return block("archiving the repository");
  if (
    group === "repo" &&
    action === "edit" &&
    rest.some((word) => word.startsWith("--visibility"))
  ) {
    return block("changing repository visibility (an owner action)");
  }

  if (GH_BODY_COMMANDS.has(group)) {
    for (let i = 0; i < rest.length; i += 1) {
      const word = rest[i] ?? "";
      /** @type {string | undefined} */
      let file;
      if (word === "--body-file" || word === "-F" || word === "--notes-file") file = rest[i + 1];
      else if (word.startsWith("--body-file=")) file = word.slice("--body-file=".length);
      if (file === undefined) continue;
      if (file === "-") {
        if (!context.command.includes("<<")) {
          return block("AI attribution check cannot read a body piped from another command");
        }
        continue;
      }
      const text = readRelative(file, context, cwd);
      if (text === undefined)
        return block(`AI attribution check could not read the body file ${file}`);
      if (hasAttribution(text)) return block("AI attribution (body file)");
    }
  }

  if (group === "api") return checkGhApi(args.slice(1), context, cwd);
  return ALLOW;
}

/**
 * @param {string[]} args the words after `gh api`
 * @param {ShellContext} context
 * @param {string} cwd
 * @returns {Verdict}
 */
function checkGhApi(args, context, cwd) {
  let method = "";
  let hasFields = false;
  let endpoint = "";
  for (let i = 0; i < args.length; i += 1) {
    const word = args[i] ?? "";
    if (word === "-X" || word === "--method") {
      method = (args[i + 1] ?? "").toUpperCase();
    } else if (word.startsWith("--method=")) {
      method = word.slice("--method=".length).toUpperCase();
    } else if (/^-X[A-Za-z]+$/.test(word)) {
      method = word.slice(2).toUpperCase();
    }
    if (["-f", "--raw-field", "-F", "--field", "--input"].includes(word)) {
      hasFields = true;
      const value = args[i + 1] ?? "";
      const fileMatch = /^[^=]+=@(.+)$/.exec(value);
      const file = word === "--input" ? value : fileMatch?.[1];
      if (file !== undefined && file !== "-") {
        const text = readRelative(file, context, cwd);
        if (text === undefined) return block(`AI attribution check could not read ${file}`);
        if (hasAttribution(text)) return block("AI attribution (API field file)");
      }
    }
    if (GH_API_WITH_VALUE.has(word)) {
      i += 1;
      continue;
    }
    if (!word.startsWith("-") && endpoint === "") endpoint = word;
  }
  const effective = method || (hasFields ? "POST" : "GET");
  if (effective === "GET") return ALLOW;
  if (/\/protection\b/.test(endpoint) || /\/rulesets\b/.test(endpoint)) {
    return block("changing branch protection or rulesets");
  }
  if (
    /\/actions\/workflows\/[^/]+\/disable\b/.test(endpoint) ||
    /\/actions\/permissions\b/.test(endpoint)
  ) {
    return block("disabling a check");
  }
  if (/\/environments\b/.test(endpoint)) return block("changing deployment environments");
  if (/\/pulls\/\d+\/merge\b/.test(endpoint)) return block("merging (the owner merges)");
  if (new RegExp(`/git/refs/heads/${PROTECTED_BRANCH}$`).test(endpoint)) {
    return block(`moving ${PROTECTED_BRANCH} directly`);
  }
  if (effective === "DELETE" && /\/git\/refs\//.test(endpoint))
    return block("deleting branches on the remote");
  return ALLOW;
}

// ---------------------------------------------------------------- Bash

// Files that hold the guardrails: the Git hooks, the Git configuration that
// points at them, and local Claude Code settings, which can turn hooks off.
// Changing one weakens a control, so it needs the owner. `.claude/settings.json`
// is checked separately: it may change, but must keep its controls.
const GUARDRAIL_PATH =
  /(?:^|\/)(?:\.githooks(?:\/|$)|\.git\/(?:config$|hooks(?:\/|$))|\.claude\/settings\.local\.json$)/;
const SETTINGS_PATH = /(?:^|\/)\.claude\/settings\.json$/;

/** @param {string} path */
const isProtectedPath = (path) => GUARDRAIL_PATH.test(path) || SETTINGS_PATH.test(path);

// Commands that change the file they are given.
const FILE_CHANGERS = new Set([
  "rm",
  "mv",
  "cp",
  "chmod",
  "chflags",
  "unlink",
  "truncate",
  "ln",
  "chown",
  "tee",
  "install",
  "dd",
  "rsync",
  "sed",
  "perl",
]);

/**
 * A chmod mode that takes away the owner's execute bit, which stops Git from
 * running a hook. Adding it (`+x`, `755`) is how a hook is installed.
 *
 * @param {string} mode
 */
function removesExecute(mode) {
  if (/^[0-7]{3,4}$/.test(mode)) {
    const owner = Number(mode.charAt(mode.length - 3));
    return (owner & 1) === 0;
  }
  const symbolic = /^[ugoa]*([-+=])([rwxXst]*)$/.exec(mode);
  if (symbolic === null) return false;
  const [, operator, permissions = ""] = symbolic;
  if (operator === "-") return permissions.includes("x");
  if (operator === "=") return !permissions.includes("x");
  return false;
}

/**
 * Whether a simple command changes a guardrail file.
 *
 * @param {string} name
 * @param {string[]} args
 */
function changesGuardrail(name, args) {
  if (!FILE_CHANGERS.has(name)) return false;
  const targets = args
    .filter((word) => !word.startsWith("-") || word.startsWith("of="))
    .map((word) => word.replace(/^of=/, ""));
  if (!targets.some(isProtectedPath)) return false;
  switch (name) {
    case "chmod":
      return args.some(removesExecute);
    case "cp":
    case "install":
    case "rsync":
      return isProtectedPath(targets[targets.length - 1] ?? "");
    case "sed":
    case "perl":
      return args.some((word) => /^-[a-zA-Z]*i/.test(word) || word.startsWith("--in-place"));
    default:
      return true;
  }
}

/**
 * The words of a simple command that it reads from, leaving out the targets
 * of output redirection and the destination of `cp .env.example <file>`.
 * Writing a local `.env` file exposes nothing; reading one does.
 *
 * @param {string[]} words
 */
function wordsThatRead(words) {
  /** @type {string[]} */
  const read = [];
  for (let i = 0; i < words.length; i += 1) {
    const word = words[i] ?? "";
    if (/^\d?>/.test(word) && !word.startsWith(">&")) {
      i += 1;
      continue;
    }
    read.push(word);
  }
  const name = basename(read[0] ?? "");
  const operands = read.slice(1).filter((word) => !word.startsWith("-"));
  if (
    name === "cp" &&
    operands.length >= 2 &&
    operands.slice(0, -1).every((word) => basename(word) === EXAMPLE_ENV)
  ) {
    return read.slice(0, -1);
  }
  return read;
}

// Configuration passed through the environment, which `git -c` checks miss.
const CONFIG_IN_ENVIRONMENT = /^GIT_CONFIG_(?:PARAMETERS|KEY_\d+)=.*(?:core\.hookspath|alias\.)/i;

// `$(cat file)` and `$(<file)` put a file's text into a command where the
// attribution check cannot see it, so the file is read and checked here.
const SUBSTITUTED_FILE =
  /\$\(\s*(?:cat\s+([^)<|;&]+?)|<\s*([^)]+?))\s*\)|`\s*cat\s+([^`<|;&]+?)\s*`/g;

/**
 * @param {string} command
 * @param {ShellContext} context
 * @param {string} cwd
 * @returns {Verdict}
 */
function checkSubstitutedFiles(command, context, cwd) {
  for (const match of command.matchAll(SUBSTITUTED_FILE)) {
    const files = (match[1] ?? match[2] ?? match[3] ?? "")
      .split(/\s+/)
      .filter((word) => word !== "");
    for (const file of files) {
      const path = file.replace(/^['"]|['"]$/g, "");
      if (isSecretPathOrGlob(path)) return block("reading a secret file (.env)");
      const text = readRelative(path, context, cwd);
      if (text === undefined) return block(`AI attribution check could not read ${path}`);
      if (hasAttribution(text)) {
        return block("AI attribution in a file passed to a git or gh command");
      }
    }
  }
  return ALLOW;
}

const GUARDRAIL_CHANGE =
  "changing a guardrail file (Git hooks, Git configuration, or Claude Code settings)";

/**
 * @param {string} command
 * @param {ShellContext} context
 * @param {string} cwd
 * @param {number} depth
 * @returns {Verdict}
 */
function checkBash(command, context, cwd, depth = 0) {
  if (depth > 4) return block("command nesting too deep to check");
  const commands = splitCommands(command);
  const usesGitOrGh = commands.some((words) => {
    const name = basename(stripWrappers(words)[0] ?? "");
    return name === "git" || name === "gh";
  });

  if (usesGitOrGh) {
    if (hasAttribution(command) || commands.flat().some(hasAttribution)) {
      return block("AI attribution in a git or gh command");
    }
    const substituted = checkSubstitutedFiles(command, context, cwd);
    if (substituted.decision === "block") return substituted;
  }

  for (const original of commands) {
    if (original.some((word) => CONFIG_IN_ENVIRONMENT.test(word))) {
      return block("skipping Git hooks (configuration passed in the environment)");
    }
    for (let i = 0; i < original.length - 1; i += 1) {
      if (/^\d?>/.test(original[i] ?? "") && isProtectedPath(original[i + 1] ?? "")) {
        return block(GUARDRAIL_CHANGE);
      }
    }

    const words = stripWrappers(original);
    const name = basename(words[0] ?? "");
    const args = words.slice(1);

    if (name === "git" || name === "gh") {
      const removingFromIndex = name === "git" && args.includes("rm") && args.includes("--cached");
      if (!removingFromIndex && args.some(isSecretPathToken)) {
        return block("reading a secret file (.env)");
      }
    } else if (wordsThatRead(words).some(mentionsSecretFile)) {
      return block("reading a secret file (.env)");
    }

    if (changesGuardrail(name, args)) return block(GUARDRAIL_CHANGE);

    /** @type {Verdict} */
    let verdict = ALLOW;
    if (name === "git") verdict = checkGit(args, context, cwd);
    else if (name === "gh") verdict = checkGh(args, context, cwd);
    else if (SHELLS.has(name) || name === "eval") {
      const scriptIndex = name === "eval" ? 0 : args.indexOf("-c") + 1;
      const script =
        name === "eval" ? args.join(" ") : scriptIndex > 0 ? args[scriptIndex] : undefined;
      if (script !== undefined && script !== "")
        verdict = checkBash(script, context, cwd, depth + 1);
    }
    if (verdict.decision === "block") return verdict;
  }
  return ALLOW;
}

// ---------------------------------------------------------------- settings

const REQUIRED_ATTRIBUTION = { commit: "", pr: "", sessionUrl: false };

/** @param {unknown} value @returns {Record<string, unknown>} */
const asRecord = (value) =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? /** @type {Record<string, unknown>} */ (value)
    : {};

/** @param {unknown} settings @returns {string[]} */
function denyRules(settings) {
  const deny = asRecord(asRecord(settings)["permissions"])["deny"];
  return Array.isArray(deny) ? deny.filter((rule) => typeof rule === "string") : [];
}

/**
 * A change to `.claude/settings.json` may add rules, but must keep the
 * attribution settings exactly, every deny rule, and this guard as a
 * PreToolUse hook, and must not turn hooks off.
 *
 * @param {string} next the file's content after the change
 * @param {string | undefined} current the file's content now
 * @returns {Verdict}
 */
export function checkSettingsChange(next, current) {
  /** @type {unknown} */
  let parsed;
  try {
    parsed = JSON.parse(next);
  } catch {
    // Claude Code ignores a settings file that does not parse, controls and all.
    return block("changing .claude/settings.json into JSON that does not parse");
  }
  const settings = asRecord(parsed);
  const attribution = asRecord(settings["attribution"]);
  if (
    attribution["commit"] !== REQUIRED_ATTRIBUTION.commit ||
    attribution["pr"] !== REQUIRED_ATTRIBUTION.pr ||
    attribution["sessionUrl"] !== REQUIRED_ATTRIBUTION.sessionUrl
  ) {
    return block("changing the attribution settings (CLAUDE.md rule 15)");
  }
  if (settings["disableAllHooks"] === true) return block("turning Claude Code hooks off");
  const hooks = JSON.stringify(settings["hooks"] ?? {});
  if (!hooks.includes("PreToolUse") || !hooks.includes("scripts/claude-guard.mjs")) {
    return block("removing the repository guard hook");
  }
  if (current !== undefined) {
    /** @type {unknown} */
    let before;
    try {
      before = JSON.parse(current);
    } catch {
      // The current file does not parse, so only the new content can be checked.
      before = {};
    }
    const kept = new Set(denyRules(settings));
    const removed = denyRules(before).filter((rule) => !kept.has(rule));
    if (removed.length > 0) return block(`removing deny rules: ${removed.join(", ")}`);
  }
  return ALLOW;
}

/**
 * The content a file tool call would leave behind.
 *
 * @param {string} toolName
 * @param {Record<string, unknown>} input
 * @param {string | undefined} current
 * @returns {string | undefined}
 */
function contentAfter(toolName, input, current) {
  if (toolName === "Write") {
    return typeof input["content"] === "string" ? input["content"] : undefined;
  }
  if (current === undefined) return undefined;
  const edits =
    toolName === "MultiEdit" && Array.isArray(input["edits"])
      ? input["edits"].map(asRecord)
      : [input];
  let text = current;
  for (const edit of edits) {
    const oldString = edit["old_string"];
    const newString = edit["new_string"];
    if (typeof oldString !== "string" || typeof newString !== "string") return undefined;
    text =
      edit["replace_all"] === true
        ? text.split(oldString).join(newString)
        : text.replace(oldString, () => newString);
  }
  return text;
}

// ---------------------------------------------------------------- entry

/**
 * @param {{ tool_name?: unknown, tool_input?: unknown, cwd?: unknown }} input
 * @param {Context} context
 * @returns {Verdict}
 */
export function evaluate(input, context) {
  const toolName = typeof input.tool_name === "string" ? input.tool_name : "";
  const toolInput =
    typeof input.tool_input === "object" && input.tool_input !== null
      ? /** @type {Record<string, unknown>} */ (input.tool_input)
      : {};
  const cwd = typeof input.cwd === "string" ? input.cwd : context.projectDir;
  /** @param {string} key */
  const field = (key) => {
    const value = toolInput[key];
    return typeof value === "string" ? value : undefined;
  };

  switch (toolName) {
    case "Read":
    case "Edit":
    case "MultiEdit":
    case "Write": {
      const path = field("file_path");
      if (path === undefined) return ALLOW;
      if (isSecretFileName(basename(path))) return block("reading or writing a secret file (.env)");
      if (toolName === "Read") return ALLOW;
      if (GUARDRAIL_PATH.test(path)) {
        return block(
          "changing a guardrail file (Git hooks, Git configuration, or local Claude Code settings)",
        );
      }
      if (SETTINGS_PATH.test(path)) {
        const current = context.readFile(path);
        const next = contentAfter(toolName, toolInput, current);
        if (next === undefined) {
          return block("the guard could not work out the new .claude/settings.json");
        }
        return checkSettingsChange(next, current);
      }
      return ALLOW;
    }
    case "NotebookEdit": {
      const path = field("notebook_path");
      if (path !== undefined && isSecretFileName(basename(path)))
        return block("writing a secret file (.env)");
      return ALLOW;
    }
    case "Grep":
    case "Glob": {
      for (const key of ["path", "glob", "pattern"]) {
        if (key === "pattern" && toolName === "Grep") continue;
        const value = field(key);
        if (value !== undefined && isSecretPathOrGlob(value))
          return block("reading a secret file (.env)");
      }
      return ALLOW;
    }
    case "Bash": {
      const command = field("command");
      if (command === undefined) return ALLOW;
      return checkBash(command, { ...context, command }, cwd);
    }
    default:
      return ALLOW;
  }
}

/** @returns {Context} */
function realContext() {
  const projectDir = process.env["CLAUDE_PROJECT_DIR"] ?? process.cwd();
  return {
    projectDir,
    currentBranch: () => {
      try {
        return execFileSync("git", ["-C", projectDir, "branch", "--show-current"], {
          encoding: "utf8",
          stdio: ["ignore", "pipe", "ignore"],
        }).trim();
      } catch {
        // Not a repository, or Git is missing: no branch to protect here.
        return "";
      }
    },
    readFile: (path) => {
      try {
        return readFileSync(path, "utf8");
      } catch {
        // The caller treats an unreadable file as a block.
        return undefined;
      }
    },
  };
}

function main() {
  /** @type {Verdict} */
  let verdict;
  try {
    const parsed = JSON.parse(readFileSync(0, "utf8"));
    verdict = evaluate(typeof parsed === "object" && parsed !== null ? parsed : {}, realContext());
  } catch (error) {
    verdict = block(
      `guard could not read its input: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (verdict.decision === "block") {
    process.stderr.write(
      `Blocked by the repository guard (scripts/claude-guard.mjs): ${verdict.reason}. ` +
        "See docs/spec/05-engineering-handbook.md section 2. If this is wrong, stop and ask the owner.\n",
    );
    process.exit(2);
  }
  process.exit(0);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main();
}
