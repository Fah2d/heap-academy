# Security policy

## Reporting a vulnerability

Please report a vulnerability privately, through GitHub's private vulnerability reporting: open the repository's **Security** tab and choose **Report a vulnerability**. Do not open a public issue, discussion, or pull request about it.

Say what you found, where, and how to reproduce it. Do not access, change, or delete data that is not yours, and do not run tests that degrade the service for others (for example, load tests or attempts to use up a free-tier limit).

You will get an answer from the owner. Fixes are released through the normal pipeline. You will be credited in the fix if you want to be.

## Scope

- The application served from this repository, and its API routes.
- The Python runtime as it runs in the learner's browser. Learner code is meant to run there and only there; a way to make it run anywhere else, or reach data it should not, is in scope.
- This repository's workflows and configuration.

Out of scope: the hosting, database, and email providers' own services, which have their own programs.

## Design

How the product is meant to be secure is public. The trust boundaries, threats, and controls are in `docs/spec/06-security-privacy.md`.
