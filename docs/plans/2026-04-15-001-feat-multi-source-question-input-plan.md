---
title: "feat: Multi-Channel Question Input and Confirmation Workflow"
type: feat
status: active
date: 2026-04-15
---

# feat: Multi-Channel Question Input and Confirmation Workflow

## Overview

Extend the question explanation system beyond screenshot-only image input to support three input channels: direct conversation text, external file paths (text/markdown/doc/image), and the existing screenshot flow. Add a mandatory confirmation step when question recognition is uncertain or incomplete.

## Problem Frame

Currently the system handles questions exclusively through user-uploaded screenshot images processed by LLM multimodal vision. Users may also:
- Type questions directly in conversation
- Reference external files containing one or more questions

The system needs to accept all three input channels, parse questions from files, handle multi-question files sequentially, and critically — **must not blindly answer when recognition is uncertain**. Instead, it must present the recognized content back to the user for confirmation.

## Requirements Trace

- R1. Users can provide questions directly in conversation text — the system must recognize and route these the same as screenshot questions
- R2. Users can specify an external file path; the system reads the file and extracts questions from it
- R3. Supported file formats: plain text (.txt), Markdown (.md), images (existing), with doc formats as best-effort. When a file cannot be read, the system must tell the user clearly: "无法读取文件 [path]，请确认文件格式是否支持" and suggest alternatives (paste text or provide screenshot).
- R4. External files may contain multiple questions — the system processes them sequentially in order. The orchestrator identifies individual questions by numbering patterns (题1./题2. or 1./2.), blank-line separators, or "题目N" headers. When boundaries are ambiguous, the system asks the user to confirm the splitting.
- R5. When question recognition is uncertain, incomplete, or potentially erroneous, the system MUST NOT answer blindly — it must ask the user to confirm, showing the recognized content for comparison. Specifically: confirmation triggers when QuestionArtifact `confidence ∈ {medium, low}` OR `completeness ∈ {partial, insufficient}`.
- R6. The confirmation step shows the user exactly what was recognized so they can identify discrepancies: "我识别到的题目内容如下，请确认是否有误或信息不完整：\n[recognized content]"

## Scope Boundaries

- This plan does NOT add TypeScript production tools for file parsing/OCR — the LLM's native multimodal and text capabilities handle all parsing (test file updates in Unit 5 are除外)
- This plan does NOT add new agent roles — existing teachers and champions handle question explanation
- This plan does NOT change the grading or question-generator tools
- Doc format support (.doc, .docx) is limited to what the LLM can read via the platform's built-in file reading; no external parsing libraries are added

## Context & Research

### Relevant Code and Patterns

- `.opencode/rules/screenshot-question-workflow.md` — Current workflow (screenshot-only)
- `.opencode/rules/question-artifact-contract.md` — QuestionArtifact validation contract
- `.opencode/rules/summary-first-workflow.md` — Knowledge-first response ordering
- `.opencode/skills/explain-screenshot-question/SKILL.md` — Current screenshot skill
- `.opencode/agents/orchestrator.md` — Routing table, keyword→teacher mapping
- `.opencode/plugins/coaching-tools/shared/question-artifact.ts` — TypeScript type + runtime validator

### Institutional Learnings

- QuestionArtifact is prompt-contract-only, not enforced at runtime (from ce:review 2026-04-15)
- Shared rules in `.opencode/rules/` are the single source of truth — never duplicate into agent files
- The orchestrator reads files via OpenCode's built-in `read` tool; subagents also have `read` access

### Key Insight

The current workflow is entirely prompt-driven. The LLM sees uploaded images natively and is instructed to structure output as a QuestionArtifact via rules. Similarly, the LLM can read text files via the `read` tool and parse questions from them. No new TypeScript tools are needed for text/markdown file reading — the orchestrator already has `read` tool access.

## Key Technical Decisions

- **Decision**: Extend the existing workflow rules rather than create parallel flows. Rationale: The prompt dedup principle in AGENTS.md mandates shared rules, and the current screenshot workflow already provides the right skeleton (QuestionArtifact → teacher → explanation).
- **Decision**: Rename "screenshot-question-workflow" to the broader "question-input-workflow" to encompass all input channels. Rationale: The current name is misleading when we support non-screenshot inputs.
- **Decision**: The confirmation step is implemented as a prompt-level rule, not a TypeScript tool. Rationale: Confirmation is a conversational interaction pattern — the LLM asks the user and waits for a response. No state needs to be persisted.
- **Decision**: Multi-question sequential processing is handled by the orchestrator's routing logic (iterate over recognized questions). Rationale: The orchestrator already manages agent routing; iterating is a natural extension of its existing loop.

## Open Questions

### Resolved During Planning

- Should we add a TypeScript tool for file parsing? No — the LLM's native capabilities + the `read` tool cover text/markdown. Image parsing is already handled by multimodal. Doc files are best-effort via the platform.
- Should QuestionArtifact become a runtime-enforced TypeScript gate? Not in this plan — that's a Phase 2 concern from the AGENTS.md roadmap.

### Deferred to Implementation

- Exact phrasing for the confirmation prompt when recognition is uncertain — left to implementation for natural language quality
- Whether .doc/.docx files are readable depends on the OpenCode platform's file handling capabilities — implementation will discover this

## Implementation Units

- [ ] **Unit 1: Rename and extend the question input workflow rule**

**Goal:** Replace the screenshot-only workflow with a unified multi-source question input workflow that covers conversation text, external files, and screenshots.

**Requirements:** R1, R2, R3, R4

**Dependencies:** None

**Files:**
- Rename: `.opencode/rules/screenshot-question-workflow.md` → `.opencode/rules/question-input-workflow.md`
- Modify: `.opencode/rules/question-input-workflow.md`

**Approach:**
- Rename the file from `screenshot-question-workflow.md` to `question-input-workflow.md`
- Restructure the workflow to define three input channels:
  1. **Conversation text** — user types or pastes question text directly
  2. **External file** — user specifies a file path; orchestrator reads it via the `read` tool
  3. **Screenshot/image** — user uploads an image (existing behavior, unchanged)
- For external files: specify that the orchestrator reads the file, identifies individual questions, and processes them sequentially. Question splitting heuristics: numbered patterns (1./2./3.), blank-line separators, "题目N" headers. When boundaries are ambiguous, ask the user to confirm.
- For all channels: the QuestionArtifact contract still applies as the handoff to teachers
- Preserve the existing fallback rules (no image, ask user to upload; unclear content, ask for clarification)

**Patterns to follow:**
- `.opencode/rules/` shared rule pattern (see existing rules for structure)
- QuestionArtifact contract in `.opencode/rules/question-artifact-contract.md`

**Test scenarios:**
- Happy path: Workflow rule references all three input channels (conversation, file, screenshot)
- Happy path: Workflow rule still mandates QuestionArtifact as the handoff structure
- Edge case: Workflow rule handles "no input available" case for each channel
- Error path: Workflow rule requires fallback when file cannot be read

**Verification:**
- The workflow rule file exists at the new path and covers all three channels
- The old file path no longer exists

- [ ] **Unit 2: Add mandatory question confirmation step to the workflow**

**Goal:** When question recognition is uncertain, incomplete, or potentially erroneous, the system must present the recognized content back to the user and ask for confirmation before proceeding.

**Requirements:** R5, R6

**Dependencies:** Unit 1

**Files:**
- Modify: `.opencode/rules/question-input-workflow.md`
- Modify: `.opencode/rules/question-artifact-contract.md`

**Approach:**
- Add a confirmation gate to the workflow: after constructing the QuestionArtifact but before routing to teachers, check confidence and completeness
- If confidence is not "high" OR completeness is not "complete", the system MUST:
  1. Show the user the recognized question content verbatim
  2. Ask: "我识别到的题目内容如下，请确认是否有误或信息不完整：\n[recognized content]"
  3. Wait for user confirmation before proceeding
- This applies to ALL input channels, not just screenshots
- Extend the QuestionArtifact contract to make this gate explicit: when `confidence ≠ high` or `completeness ≠ complete`, the workflow must not proceed to teacher routing

**Patterns to follow:**
- Existing confidence/completeness fields in QuestionArtifact contract
- The "不完整或低置信度" rule in the existing screenshot workflow

**Test scenarios:**
- Happy path: High-confidence, complete artifacts proceed directly to teacher routing
- Edge case: Medium-confidence artifact triggers confirmation prompt with recognized content
- Edge case: Low-confidence artifact triggers confirmation prompt
- Error path: Insufficient completeness triggers confirmation prompt
- Integration: Confirmation applies to conversation text input (not just screenshots)

**Verification:**
- The workflow rule contains a confirmation gate section
- The QuestionArtifact contract mentions the confirmation requirement

- [ ] **Unit 3: Update the screenshot explanation skill to cover all input channels**

**Goal:** Rename and broaden the skill to trigger on all question input intents, not just screenshots.

**Requirements:** R1, R2

**Dependencies:** Unit 1

**Files:**
- Rename: `.opencode/skills/explain-screenshot-question/SKILL.md` → `.opencode/skills/explain-question/SKILL.md`
- Modify: `.opencode/skills/explain-question/SKILL.md`

**Approach:**
- Rename the skill directory and file
- Update the YAML frontmatter: name, description, and argument-hint to cover all input channels
- Broaden trigger phrases to include: "帮我讲解这道题", "分析这道题", "讲一下这个文件里的题目", "看看这段题干"
- Keep screenshot-related triggers ("讲解这张题目截图") as a subset
- Update execution steps to reference the new unified workflow rule

**Patterns to follow:**
- Existing skill YAML frontmatter format (see `.opencode/skills/export-markdown/SKILL.md`)

**Test scenarios:**
- Happy path: Skill file references the new workflow rule path
- Happy path: Skill triggers cover conversation text, file paths, and screenshots
- Edge case: Skill description mentions external file support

**Verification:**
- The skill file exists at the new path with updated triggers

- [ ] **Unit 4: Update orchestrator routing for multi-source questions**

**Goal:** Update the orchestrator's routing table, agent capability documentation, and shared rule references to reflect the unified question input workflow.

**Requirements:** R1, R2, R3, R4

**Dependencies:** Unit 1, Unit 2, Unit 3

**Files:**
- Modify: `.opencode/agents/orchestrator.md`

**Approach:**
- Update the routing table: rename "截图题目讲解" to "题目讲解" covering all input channels
- Add routing entries for new input methods:
  - Conversation text question → recognize subject → module teacher
  - External file path → read file → parse questions → iterate per question → module teacher
- Update the routing table row to reference the new rule path: `.opencode/rules/question-input-workflow.md`
- Add a "Multi-Question Processing" section: when a file contains multiple questions, process them sequentially, showing progress between questions
- Update shared rules references to use the new file path

**Patterns to follow:**
- Existing orchestrator routing table format
- Existing keyword→teacher mapping table

**Test scenarios:**
- Happy path: Orchestrator references the new workflow rule path
- Happy path: Routing table covers all three input channels
- Integration: Multi-question sequential processing is described

**Verification:**
- The orchestrator.md references `.opencode/rules/question-input-workflow.md`
- The routing table includes non-screenshot question input routes

- [ ] **Unit 5: Update existing tests to reflect renamed files and new behavior**

**Goal:** Update prompt asset tests and smoke tests to reflect the renamed workflow rule and skill, and add test coverage for the new confirmation behavior.

**Requirements:** R5, R6

**Dependencies:** Unit 1, Unit 2, Unit 3, Unit 4

**Files:**
- Modify: `.opencode/tests/prompts/screenshot-question-flow.test.ts`
- Modify: `.opencode/tests/coaching-tools/screenshot-explain-smoke.test.ts`
- Modify: `.opencode/tests/prompts/prompt-assets.test.ts`

**Approach:**
- Update all file path references from `screenshot-question-workflow.md` to `question-input-workflow.md`
- Update all file path references from `skills/explain-screenshot-question/SKILL.md` to `skills/explain-question/SKILL.md`
- Update content-based assertions that check specific Chinese strings in workflow and orchestrator files:
  - `screenshot-question-flow.test.ts`: update `toContain("用户自己上传的题目图片")` and `toContain("补图或补文字")` to match new multi-source wording
  - `screenshot-explain-smoke.test.ts`: update `toContain("截图工作流")` and regex `/截图.*QuestionArtifact.*老师|QuestionArtifact.*截图/` to match new orchestrator wording
  - `prompt-assets.test.ts`: update `toContain("截图题目讲解遵循")` to match new routing table name
- Add test cases verifying:
  - The new workflow rule covers conversation text and external file input channels
  - The confirmation gate is mentioned in the workflow rule
  - The QuestionArtifact contract references the confirmation requirement
  - The orchestrator routing table covers non-screenshot question input
  - The skill triggers include non-screenshot phrases

**Patterns to follow:**
- Existing test patterns using `readPromptAsset` and `readProjectFile`
- Existing vitest describe/it structure

**Test scenarios:**
- Happy path: All tests pass after updating both file path references AND content-based string assertions
- Happy path: New tests verify multi-source input coverage
- Happy path: New tests verify confirmation gate exists in rules
- Integration: Tests verify orchestrator references new rule path

**Verification:**
- All tests pass (`npx vitest run` from `.opencode/`)

## System-Wide Impact

- **Interaction graph:** The orchestrator's question routing changes from screenshot-only to multi-source. All 7 teachers and 4 champions are unaffected — they receive the same QuestionArtifact.
- **Error propagation:** File read failures must surface to the user with a clear message. Recognition uncertainty triggers the confirmation gate instead of proceeding.
- **State lifecycle risks:** No persistent state changes — this is purely prompt/workflow modifications.
- **API surface parity:** No TypeScript production tool changes — test-only updates in Unit 5 are limited to file-path references and content assertion strings. The `export-document`, `grading`, `question-generator`, and `user-profile` tools are unaffected.
- **Unchanged invariants:** The QuestionArtifact contract fields remain the same. Teacher and champion agent files are unchanged. The `opencode.json` config is unchanged.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| File rename breaks existing conversations that reference old paths | The old paths were internal (rules/skills), not user-facing. Agent prompts reference them via instructions glob which auto-updates. |
| Doc format files (.doc/.docx) may not be readable by the platform | Scoped as best-effort. Implementation will test and document which formats work. |
| Confirmation gate adds friction for confident recognitions | Gate only triggers on non-high confidence or non-complete artifacts, per existing QuestionArtifact fields. |
| Multi-question sequential processing may produce long responses | Each question is processed independently; the orchestrator can suggest export for long sessions. |

## Documentation / Operational Notes

- The `opencode.json` instructions glob `.opencode/rules/**/*.md` automatically picks up the renamed file — no config change needed.
- The skill rename requires no `opencode.json` change — skills are auto-discovered from `.opencode/skills/`.
- The `AGENTS.md` file does not need updating — it references "截图讲题" as a Phase 1 feature, which is now a subset of the broader question input feature.

## Sources & References

- Related code: `.opencode/rules/screenshot-question-workflow.md`, `.opencode/rules/question-artifact-contract.md`
- Related skills: `.opencode/skills/explain-screenshot-question/SKILL.md`
- Review context: `.context/compound-engineering/ce-review/2026-04-15-head-autofix/summary.md`
