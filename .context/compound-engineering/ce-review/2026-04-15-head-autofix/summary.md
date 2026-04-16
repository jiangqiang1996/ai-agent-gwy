# ce:review autofix run

- Mode: `autofix`
- Base: `HEAD`
- Plan: `docs/plans/2026-04-14-002-refactor-summary-first-guidance-plan.md`

## Applied Fixes

- Restored `.opencode/package.json` to `@opencode-ai/plugin@1.4.3` so the declared dependency matches `package-lock.json`.
- Fixed `question-generator` to fall back to the saved profile's `examTypes` and `region` when callers only provide `username`.
- Fixed `user-profile checkName` overwrite guidance to route callers to `overwrite` instead of `loadOrCreate`.
- Clarified the `user-profile` tool description so `updateMastery` is marked as deprecated rather than appearing like a normal supported write path.
- Added regression coverage for:
- profile-context fallback in `question-generator`
- wrong-answer objective grading output
- overwrite guidance text
- empty export rejection
- blocked profile migration for incomplete legacy score fields
- blocked profile migration for invalid identity values

## Residual Findings

- Manual: `user-profile` still exposes `updateMastery` in the action enum even though the path is deprecated and returns an error. Removing it cleanly may require a deliberate compatibility decision.
- Manual: `user-profile` cannot currently clear `identity` back to `null` through the public tool schema.
- Manual: image-based `QuestionArtifact` exists as prompt contract/tests, but not yet as an enforced plugin/runtime schema boundary.
- Advisory: several shared workflow rules are duplicated back into agent prompt files, which risks future drift from `.opencode/rules/`.

## Verification

- `npm test`
- `npm run typecheck`
