# Safe, Efficient Codex Prompts for CaseGraph

## Start of every fresh Codex session
```text
Read AGENTS.md and README.md, then docs/REQUIREMENTS.md, docs/TASKS.md,
docs/STACK.md and docs/SECURITY.md. This is a local, zero-paid-API
prototype using fictional cybercrime data only. Do not code yet.
Summarize the current implementation state from actual files, list the next
unblocked task from docs/TASKS.md, identify its acceptance criteria, and
state tests you will run. Don't assume planned features already exist.
```

## Implement a single task
```text
Implement only task T__ from docs/TASKS.md. Read the relevant specialized
specs before coding. Use our agreed stack and local-only, free adapters.
First explain affected files and tests. Implement incrementally; run the
tests you can actually run; report actual output and blockers. Update the
checkbox and build log only when the acceptance criteria are met. Do not add
paid APIs, fake TigerGraph results, or real personal data.
```

## Review for security
```text
Review the changes in this branch against docs/SECURITY.md, focusing on
unauthorized file access, cross-organization graph leaks, prompt injection
from uploaded screenshots, upload safety, original-evidence integrity,
secret exposure, and AI-derived false claims. Report specific vulnerable
files/lines and write failing tests before suggesting a fix. Do not perform
any destructive or external operations.
```

## Debug a failing task
```text
Investigate the failing command using actual logs and code. Reproduce once,
identify the root cause, add or update a regression test, and make the
smallest correct patch. Do not rewrite unrelated modules or bypass security.
Give commands and results. If the service isn't installed, state that rather
than claiming the test passed.
```

## Demo readiness audit
```text
Inspect docs/DEMO.md and docs/TEST_PLAN.md. Run the available lint, tests,
typecheck, API smoke check, and synthetic TigerGraph functional query. List
PASS/FAIL/NOT RUN for each; do not invent output. Identify the smallest
changes that make the 3-minute fictional demo reproducible with no paid API.
```

## Working with a teammate
```text
I am responsible for [subsystem]. Another teammate owns [subsystem].
Read the relevant docs. Avoid changing their module without agreement.
Make typed API contracts and examples explicit. Propose interfaces first;
keep changes small and test them. Record decisions in docs/DECISIONS.md.
```

## Non-negotiable end-of-task report
Changed files; implemented behavior; actual test commands and results;
limitations; new dependencies and cost implications; next task.
