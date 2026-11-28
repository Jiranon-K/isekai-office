# Isekai Office

A pixel-art guild hall that shows AI coding agent sessions as characters. Bun server, React 19,
Vite, Tailwind 4, a canvas 2D room. The UI text is Thai. Read `README.md` for the product and the
project layout.

## Workflow: pstack

pstack is the workflow for every task. Its skills are plain Markdown on this machine, under the
newest version folder of `C:\Users\stell\.claude\plugins\cache\cursor-plugins\pstack\`.

1. Read `skills/poteto-mode/SKILL.md` before the first task of a session.
2. Match the task to a playbook in `skills/poteto-mode/playbooks/` (`feature`, `bug-fix`,
   `refactoring`, `perf-issue`, `investigation`, `prototype`) and follow its steps.
3. Read the leaf skill of each principle you apply, `skills/principle-<name>/SKILL.md`.
4. A task no playbook fits goes to `skills/figure-it-out/SKILL.md`.

Use `architect` for a change that crosses a function boundary, `unslop` for prose,
`technical-writing` for docs, commits and PR text, and `no-comments` before review.

## Loop engineer

You own a loop, not a single step. Run it until the check passes.

1. State the goal and the smallest change that meets it.
2. Build it.
3. Run `bun run check`, then drive the change in `bun run demo` at `http://localhost:4310`.
4. On a failure, find the root cause, fix it, and run step 3 again.
5. Stop when the check passes and you saw the change work, or when the same check failed three
   times on one premise. Then write the premise down and test it directly before another fix.

A fork you can settle by running something is settled by a prototype, not by a question.

## Human gate

The human supervises after the fact. Decide, proceed, then report what you did and why.

Stop and ask only before an action that cannot be undone:

- merging to `main`, force pushing, or deleting a branch that is not yours
- deleting files outside the repo, or data under the data dir (`~/.isekai-office`)
- sending anything off this machine, such as a message, a publish or a deploy

Product direction comes from the human. Everything else proceeds, including adding a dependency:
state its bundle or memory cost in the report.

## Code

- No comments and no docstrings in code. Do not add one. Delete a comment you touch, and encode a
  constraint it claims as a type, a test or a runtime check.
- No commented-out code.
- A function does one thing. Use early returns over nested conditionals.
- Name a variable after what it contains and a function after what it does. Do not abbreviate.
- Handle errors explicitly. Never swallow an exception.
- Keep a file under 300 lines. Extract a module when one grows.
- Imports go at the top, grouped: runtime, external packages, internal modules.
- Prefer editing an existing file over creating a new one.
- Make the smallest change that solves the problem. Fix root causes, no temporary fixes.
- Tests sit next to the file they test (`*.test.ts`).
- Types used by both sides live in `shared/types.ts`.

## Product rules

- The room is the menu. A feature attaches to a room object or a character. No navbar and no
  settings page.
- One Bun process. No database and no queue.
- The server polls only while a browser tab is connected.
- `server/guard.ts` lets in local requests only.
- Budgets: 16 MB server memory live, 145 KB gzipped JavaScript, 21 KB gzipped CSS, 300 KB for all
  room backdrops. Measure before and after when a change can move one.

## Git

- Work on a branch, never on `main`. One agent per file at a time.
- Commit messages and PR text are in English.

## Done

Done means `bun run check` passed and you saw the change work in the running app. Say which of
the two you did. Report a failure with its output. Mark untested scope as untested. Never report
a number you did not measure.

## Talking to the user

Reply in Thai, short and plain, smallest complete answer first. Keep code, paths, commands and
technical terms in English. Lead with what changed, then the evidence.
