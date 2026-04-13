---
title: "feat: Multi-Agent Coaching System for Civil Service Exams"
type: feat
status: active
date: 2026-04-13
origin: docs/brainstorms/gwy-multi-agent-coaching-requirements.md
deepened: 2026-04-13
---

# Multi-Agent Coaching System for Civil Service Exams

## Overview

Build a multi-agent coaching system for Chinese civil service (公务员) and public institution (事业单位) exam preparation. The system replaces the current 2-agent setup (numeric IDs `666`/`667`) with an orchestrated multi-agent platform featuring teacher agents (subject-matter experts), student agents (exam champions), an orchestrator agent for routing, and custom tools for question generation, timing, grading, points, and user profiles.

Delivery is phased: **Phase 1 delivers a complete "行测教练"** (aptitude test coach) with all 6 行测 module teachers, 2 champion students, question generation with timer, grading, basic points, and persistent user profiles. Subsequent phases expand to 申论, subjective grading, and full 事业单位 coverage.

## Problem Frame

Users preparing for civil service exams need subject-specific tutoring, practice questions with timing, progress tracking, and study planning. The current repo has only 2 generic champion agents with no question generation, no timing, no grading, no persistence, and no subject specialization. This plan builds the complete infrastructure from scratch.

(see origin: `docs/brainstorms/gwy-multi-agent-coaching-requirements.md`)

## Requirements Trace

Phase 1 requirements (this plan):

- R0. Orchestrator via primary agent (deviation: origin specifies plugin; see Key Technical Decisions)
- R0b. Integration of multi-agent output into unified response (deviation: origin specifies separate integration agent role; Phase 1 performs inline)
- R1. Multi-user identity with persistent profiles
- R2. User identity switching (simple: re-enter name to switch, loads/creates profile)
- R3. Cross-terminal persistence via project files
- R4. User memory: answer records, per-topic mastery, points
- R4b. Statistical validity floor (min 5 samples per topic)
- R5-R7. Agent system with readable names, teacher-style personas
- R8. Shared teachers across exam types (行测 module teachers serve both)
- R9. Champion student agents with distinct personas (国考状元, 重庆状元)

### Agents

- R5-R7. Agent system with readable names, teacher-style personas
- R8. Shared teachers across exam types (行测 module teachers serve both)

### Question Practice

- R19. Question generation with self-check
- R19c. Cold-start strategy (random mode for new users)
- R20a. Timer with timeout and abandon (in-memory for Phase 1; cross-session persistence deferred to Phase 2 as R20b)
- R21. Binary grading for objective questions
- R22. Multi-agent roundtable analysis view (simplified for Phase 1)
- R23. Custom tools with error handling (basic for Phase 1)

### Points & Levels

- R24-R27. Points and level system

### Routing & Output

- R28-R30. Intent recognition and subject routing
- R32. 差生 excluded from Phase 1
- R33-R35. Multi-agent output format: short role statements + integrated conclusion
- R37. 重庆状元 work-constraint perspective (covered in persona; learning plan scenario deferred to Phase 2+)

Deferred to later phases:

- R0c. Context window budget management (Phase 3+)
- R10. 行测第一/申论第一 单科尖子 (Phase 2/3)
- R11/R32. 差生 agent (Phase 4)
- R12-R15. 考情教研老师 and exam info skill (Phase 4)
- R16-R18. 时间管理老师 (Phase 4)
- R19b. Targeted weak-subject practice (Phase 2)
- R20b. Cross-session timer persistence (Phase 2)
- R21 subjective grading A/B/C/D (Phase 3)
- R22 full roundtable (simplified in Phase 1, full in Phase 2+)
- R29b 事业单位 routing (Phase 4)

## Scope Boundaries

- Phase 1 covers 行测 (aptitude test) only — no 申论, no 事业单位
- No study planning (deferred to Phase 2+)
- No exam info lookup skill (deferred to Phase 4)
- No 差生, 时间管理老师, 考情教研老师 agents (deferred)
- Timer is in-memory only (no cross-session persistence in Phase 1)
- No subjective question grading (Phase 1 = objective only)

## Context & Research

### Relevant Code and Patterns

- Current agents: `.opencode/agents/666.md`, `.opencode/agents/667.md` — simple markdown prompts with sections: 角色定位, 专业能力, 答题原则, 回答格式
- OpenCode config: `opencode.json` — declares agents with `mode: "subagent"`, `tools` permissions, `color`
- Plugin SDK: `@opencode-ai/plugin` v1.4.3 with `tool()` helper, zod schemas, `ToolContext` (sessionID, directory, worktree, metadata())
- Reference project: `E:\Documents\IdeaProjects\oh-my-openagent` — factory pattern for tools, safe hook creation, atomic file writes, agent factories with `AgentConfig`
- Data directory: `data/` at project root (sibling to `.opencode/`), not inside `.opencode/`

### Key Technical Findings

1. **Plugin hooks don't fire for subagents** — orchestration must use the agent pattern (primary agent with `task` tool), NOT plugin message interception
2. **Tools are stateless** — all persistence must be file-based; use `context.worktree` for stable paths
3. **Agent .md files** are pure markdown (no frontmatter required by OpenCode, but opencode.json declares metadata)
4. **Tool return type** is always `string`; errors returned as `"Error: <message>"` strings
5. **Named exports** from tool files create `<filename>_<exportname>` tools; default export uses filename

## Key Technical Decisions

| Decision | Rationale |
|----------|-----------|
| **Orchestrator as primary agent** (not plugin) | Plugin hooks don't fire for subagents (Issue #5894). An orchestrator agent with `task` tool can call subagents reliably. **Deviation from origin**: origin R0 specifies plugin-based orchestration; this plan uses agent-based orchestration instead. |
| **Custom tools via plugin** (not standalone files) | Tools need shared state (user profile path, data directory, in-memory timer Map). A single plugin registers all tools via `{ tool: { name: tool({...}) } }` pattern. Tool names are the object keys (e.g., `timer`, `grading`), NOT prefixed with filename. **Deviation from origin**: tools consolidated into `.opencode/plugins/` instead of individual files in `.opencode/tools/`. |
| **User data in `data/` directory** (project root, sibling to `.opencode/`) | User preference. Easier to access, gitignore-friendly, clearly separate from OpenCode infrastructure. |
| **File-based persistence** (JSON per user) | Cross-terminal requirement (R3). OpenCode tools are stateless, no built-in state sharing. |
| **Agent definitions as `.md` files** (not AgentConfig factories) | Simpler for this project's scope. Agents are static personas, not model-dependent. Config in `opencode.json`. |
| **In-memory timer for Phase 1** | MVP validation. Cross-tool timer persistence adds complexity; user will just request a new question if interrupted. |
| **Phase 1 = full 行测** (all 6 modules) | A single module is not a credible coaching product. All 6 modules makes Phase 1 a genuine "行测教练". |

## Open Questions

### Resolved During Planning

- **Who orchestrates?** → Primary orchestrator agent (not plugin). Plugin registers tools only.
- **User data location?** → `data/` at project root, sibling to `.opencode/`
- **Phase 1 scope?** → Full 行测 (all 6 modules + module-level teachers + 2 students)
- **Timer persistence?** → In-memory for Phase 1, file-based in Phase 2+

### Deferred to Implementation

- Exact points values and level thresholds (R25)
- Exact output format template for multi-agent responses (word counts, section structure)
- Exact agent prompt wording for each teacher/student
- Timer timeout values per question type (default 3 min objective)
- File format details for user profiles

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

### Architecture Overview

```
User Input
    ↓
┌─────────────────────────────────┐
│  Orchestrator Agent (primary)    │
│  - Intent recognition            │
│  - Subject/exam type routing     │
│  - Calls subagents via task tool │
│  - Integrates responses          │
└──────┬──────────────┬────────────┘
       │              │
       ▼              ▼
┌──────────┐   ┌──────────┐
│ Teachers  │   │ Students │
│ (subagent)│   │(subagent)│
│ 行测总老师 │   │ 国考状元  │
│ 言语老师   │   │ 重庆状元  │
│ 数量老师   │   └──────────┘
│ 判断老师   │
│ 资料老师   │
│ 常识老师   │
│ 政治老师   │
└──────────┘

┌─────────────────────────────────┐
│  Coaching Plugin (tools)         │
│  - question-generator            │
│  - timer                         │
│  - grading                       │
│  - points                        │
│  - user-profile                  │
└─────────────────────────────────┘
         ↕
┌─────────────────────────────────┐
│  File System (data/)             │
│  - users/{username}.json         │
│  - Each file = full user profile │
└─────────────────────────────────┘
```

### User Interaction Flow (Question Practice)

```
User: "出一道言语理解题" or "练题"
    ↓
Orchestrator → calls question-generator tool (subject="言语理解与表达")
    ↓
question-generator → selects topic, returns prompt template + question ID
    ↓
Orchestrator → calls teacher subagent via task tool with prompt template
    ↓
Teacher generates question with self-check → returns question to orchestrator
    ↓
Orchestrator → presents question → calls timer tool (action="start")
    ↓
User: "B" (submits answer)
    ↓
Orchestrator → calls grading tool (correctAnswer, userAnswer) → calls points tool
    ↓
Orchestrator → presents result (correct/wrong, time, points change)
    ↓
User: "看解析"
    ↓
Orchestrator → calls teacher subagent + student subagents → integrates analysis
    ↓
Orchestrator → presents analysis + offers next steps
```

### Data Directory Structure

```
data/
├── users/
│   ├── 张三.json          # Full user profile
│   └── 李四.json
└── .gitignore             # Ignore user data from git
```

### User Profile JSON Structure

```json
{
  "name": "张三",
  "createdAt": "2026-04-13T10:00:00Z",
  "points": 150,
  "level": 2,
  "streak": { "current": 3, "best": 7 },
  "mastery": {
    "言语理解与表达": {
      "total": 25, "correct": 18, "avgTimeSeconds": 45,
      "leafTopics": {
        "逻辑填空": { "total": 10, "correct": 7, "avgTimeSeconds": 40 },
        "片段阅读": { "total": 8, "correct": 6, "avgTimeSeconds": 50 },
        "语句表达": { "total": 7, "correct": 5, "avgTimeSeconds": 48 }
      }
    }
  },
  "history": [
    {
      "id": "q-001",
      "timestamp": "2026-04-13T10:05:00Z",
      "subject": "言语理解与表达",
      "leafTopic": "逻辑填空",
      "correct": true,
      "timeSeconds": 38,
      "pointsChange": 10
    }
  ]
}
```

## Implementation Units

- [ ] **Unit 1: Project Infrastructure**

**Goal:** Set up directory structure, AGENTS.md, data directory, and clean up old agents.

**Requirements:** R6 (readable names), R3 (file persistence foundation)

**Dependencies:** None

**Files:**
- Create: `data/.gitignore`
- Create: `AGENTS.md`
- Delete: `.opencode/agents/666.md`
- Delete: `.opencode/agents/667.md`
- Modify: `opencode.json` (remove old 666/667 agent entries)

**Approach:**
- Create `data/` directory at project root with `.gitignore` that excludes `users/`
- Create `AGENTS.md` with project-level instructions: agent naming conventions, shared output format rules, data directory location
- Remove old numeric agent files and their `opencode.json` entries

**Test expectation:** none — scaffolding only

**Verification:**
- `data/.gitignore` exists and excludes `users/`
- `AGENTS.md` exists with project conventions
- Old agent files removed, `opencode.json` has no 666/667 entries

---

- [ ] **Unit 2: User Profile Tool**

**Goal:** Build the custom tool for user identity management and profile persistence.

**Requirements:** R1, R3, R4, R4b

**Dependencies:** Unit 1

**Files:**
- Create: `.opencode/plugins/coaching-tools.ts` (initial plugin with user-profile tool)
- Modify: `.opencode/package.json` (add dependencies if needed)

**Approach:**
- Single plugin file that exports all coaching tools; start with user-profile
- User profile tool supports actions: `loadOrCreate` (load existing or create new), `save` (persist to file), `updateMastery` (record answer result), `getStats` (return summary)
- File path: `data/users/{username}.json` relative to `context.worktree`
- JSON file per user; atomic write (write-to-temp + rename) per oh-my-openagent pattern
- Mastery tracking: increment counters per subject/leafTopic; mark as "样本不足" when total < 5
- Error handling: return `"Error: ..."` strings, never throw

**Patterns to follow:**
- Tool factory pattern from oh-my-openagent: `tool({ description, args, execute })`
- Atomic file writes for corruption prevention
- Zod schema for all tool arguments

**Test scenarios:**
- Happy path: create new user → file created with correct structure
- Happy path: load existing user → profile returned correctly
- Happy path: update mastery after correct answer → counters incremented
- Edge case: user with < 5 answers in topic → mastery flagged as insufficient sample
- Error path: corrupted JSON file → graceful error message
- Error path: concurrent access → no data loss (atomic write)

**Verification:**
- Tool registered and callable from agent
- User files created at `data/users/{name}.json`
- Mastery stats correctly track per-topic accuracy and timing

---

- [ ] **Unit 3: Timer and Grading Tools**

**Goal:** Build timer tool (in-memory) and grading tool (binary for objective questions).

**Requirements:** R20, R21, R23

**Dependencies:** Unit 2 (same plugin file)

**Files:**
- Modify: `.opencode/plugins/coaching-tools.ts` (add timer and grading tools)

**Approach:**
- **Timer tool**: In-memory Map keyed by sessionID. Actions: `start` (record timestamp + question ID + timeout), `stop` (return elapsed seconds), `status` (return current elapsed). Timeout default: 180 seconds for objective questions. Support `abandon` action.
- **Grading tool**: Takes `correctAnswer`, `userAnswer`, `questionType` (always "objective" in Phase 1). Returns `{ correct: boolean, timeSeconds: number }`. Normalizes whitespace and case for comparison.
- Both tools return structured string output that the orchestrator can parse
- Error handling: timer not found, invalid action, missing args → descriptive error strings

**Patterns to follow:**
- Plugin pattern: `export const CoachingPlugin: Plugin = async (ctx) => { return { tool: { timer: tool({...}), grading: tool({...}) } } }`. Tool names are the object keys (`timer`, `grading`, etc.), NOT prefixed with filename.
- In-memory Map for timers lives in plugin closure (shared across all tool execute() calls)
- Error-as-string return pattern from oh-my-openagent

**Test scenarios:**
- Happy path: start timer → stop timer → elapsed time returned
- Happy path: grade correct answer → returns correct
- Happy path: grade wrong answer → returns incorrect
- Edge case: stop timer without starting → error message
- Edge case: abandon during timing → returns "未答" status
- Error path: invalid grading action → descriptive error

**Verification:**
- Timer tool tracks per-session timing correctly
- Grading tool correctly judges objective answers
- Both tools handle errors gracefully

---

- [ ] **Unit 4: Question Generation Tool**

**Goal:** Build question generation tool that selects topics and builds prompt templates for the orchestrator to send to teacher subagents.

**Requirements:** R19, R19c, R23

**Dependencies:** Unit 2

**Files:**
- Modify: `.opencode/plugins/coaching-tools.ts` (add question-generator tool)

**Approach:**
- **Question generator tool**: Takes `subject` (e.g. "言语理解与表达"), `leafTopic` (optional), `username` (for cold-start check). Returns a structured string containing: selected subject/leafTopic, a prompt template for the teacher subagent, question ID, and self-check instructions.
- **This tool does NOT call subagents** — tools are stateless functions with no `task` access. Instead: (1) tool selects topic + builds prompt template, (2) orchestrator calls teacher subagent via `task` tool with the template, (3) teacher generates and self-checks the question.
- Cold-start logic: if user has no mastery data (via user-profile tool), random subject is selected.
- Subject validation: tool confirms the subject exists in the known 行测 module list.
- For Phase 1: objective questions only (single-choice, 4 options A/B/C/D)

**Test scenarios:**
- Happy path: generate question for specific subject → returns valid question with 4 options
- Happy path: generate question with self-check → answer verified
- Edge case: cold-start user → random subject selected
- Error path: invalid subject → error message
- Error path: question generation fails → retry instruction returned

**Verification:**
- Tool produces valid question structures
- Self-check step included in output
- Cold-start logic works for new users

---

- [ ] **Unit 5: Points and Level Tool**

**Goal:** Build points management tool for scoring and leveling.

**Requirements:** R24-R27

**Dependencies:** Unit 2 (user profile)

**Files:**
- Modify: `.opencode/plugins/coaching-tools.ts` (add points tool)

**Approach:**
- **Points tool**: Actions: `award` (add points after correct answer), `deduct` (subtract after wrong answer), `getLevel` (return current level info), `getSummary` (return points + level + streak). Points values: correct = +10, wrong = -3. Level thresholds defined as config constant.
- Points changes are immediately persisted to user profile file
- Streak tracking: consecutive correct/wrong counts
- Verbal feedback templates: praise for correct (e.g. "漂亮！继续保持！"), criticism for wrong (e.g. "这道题还需要加强，来看看解析")

**Test scenarios:**
- Happy path: award points → user profile updated, new level returned
- Happy path: deduct points → profile updated, never goes below 0
- Happy path: streak tracking → consecutive correct count updated
- Edge case: points would go negative → clamped to 0
- Edge case: level up → correct new level calculated

**Verification:**
- Points correctly persisted to user profile
- Level calculation correct
- Streak tracking accurate

---

- [ ] **Unit 6: Orchestrator Agent**

**Goal:** Build the primary orchestrator agent that routes user questions and coordinates subagent calls.

**Requirements:** R0, R0b, R28-R30, R33-R35, R38

**Dependencies:** Unit 1 (AGENTS.md, clean config)

**Files:**
- Create: `.opencode/agents/orchestrator.md`
- Modify: `opencode.json` (add orchestrator as primary agent)

**Approach:**
- The orchestrator is the **primary agent** — it receives all user messages first
- Its system prompt contains: routing logic, agent roster with capabilities, output format rules
- It uses the `task` tool to call subagents, passing full question context in the prompt
- **Routing**: First identify intent (答疑/出题/计划/考情/查进度), then subject (行测 module), then specific topic. For Phase 1: 答疑 routes to 行测总老师 + specific module teacher + 2 champion students; 出题 uses the question-generator tool
- **Output format**: Each subagent gives a short statement (2-3 sentences max, unique perspective, no repetition). Orchestrator integrates: merges shared views, notes disagreements, gives final conclusion.
- **Integration** (R0b for Phase 1): The orchestrator itself performs integration inline — no separate integration agent until Phase 3+ when lineup complexity warrants it
- Agent roster table embedded in orchestrator prompt for routing decisions

**Phase 1 routing table:**
| Intent | Roster |
|--------|--------|
| 行测答疑 | 行测总老师 + 对应模块老师 + 国考状元 + 重庆状元 (2老师+2学生; 3rd student slot deferred with R10) |
| 出题练习 | 对应模块老师 (via question-generator tool + task) |
| 查看解析 | 对应模块老师 + 国考状元 + 重庆状元 |
| 查进度 | user-profile tool (getStats) |
| 申论/事业单位/计划 | "Phase 1 暂不覆盖，敬请期待" |

**Session state convention:** Orchestrator always passes `username` as the first argument to every tool call. On first interaction, if no username is known, orchestrator asks user for their name, then calls `user-profile` tool with `loadOrCreate` action. Username is maintained in the orchestrator's conversation context.

**Patterns to follow:**
- Agent definition as `.md` file (existing pattern from 666.md/667.md but enhanced)
- `opencode.json` agent config with `mode: "primary"` or agent selection

**Test scenarios:**
- Happy path: user asks 行测 question → correct teachers + students routed
- Happy path: user asks for practice question → question-generator tool called
- Happy path: multi-agent output follows "short statements + integrated conclusion" format
- Edge case: ambiguous subject → orchestrator asks clarifying question
- Edge case: user asks about 申论 (out of Phase 1 scope) → graceful deferral message

**Verification:**
- Orchestrator correctly identifies intent and routes to appropriate agents
- Output format consistent across interactions
- All coaching tools accessible from orchestrator

---

- [ ] **Unit 7: 行测 Teacher Agents**

**Goal:** Create all 行测 teacher agent definitions with readable names and teacher-style personas.

**Requirements:** R5-R8, R28-R30

**Dependencies:** Unit 1

**Files:**
- Create: `.opencode/agents/xingce-zong-teacher.md` (行测总老师)
- Create: `.opencode/agents/xingce-yanyu-teacher.md` (言语理解与表达)
- Create: `.opencode/agents/xingce-shuliang-teacher.md` (数量关系)
- Create: `.opencode/agents/xingce-panduan-teacher.md` (判断推理)
- Create: `.opencode/agents/xingce-ziliao-teacher.md` (资料分析)
- Create: `.opencode/agents/xingce-changshi-teacher.md` (常识判断)
- Create: `.opencode/agents/xingce-zhengzhi-teacher.md` (政治理论)
- Modify: `opencode.json` (register all teacher agents)

**Approach:**
- Each teacher `.md` follows enhanced version of existing 666.md pattern: 角色定位, 专业能力, 教学风格, 出题原则, 回答格式
- **行测总老师**: Overview perspective, methods that span all modules, study strategy
- **Module teachers**: Deep expertise in their module, specific techniques, common traps, speed tips
- Each teacher's prompt includes: the subjects they cover, output format rules (2-3 sentences, unique angle, no repetition), and self-check instructions for question generation
- All agents registered as `mode: "subagent"` with read-only tools (read, grep, glob)

**Test scenarios:**
- Happy path: each teacher responds in character with teaching-focused answer
- Happy path: teacher generates a valid practice question with correct answer
- Edge case: question asked outside teacher's module → teacher defers to correct colleague
- Edge case: self-check catches wrong answer in generated question → corrected before delivery

**Verification:**
- All 7 teacher agents registered and callable
- Each teacher responds with module-appropriate expertise
- Question generation produces valid, self-checked questions

---

- [ ] **Unit 8: Champion Student Agents**

**Goal:** Create the 2 champion student agent definitions with distinct personas.

**Requirements:** R9-R10

**Dependencies:** Unit 1

**Files:**
- Create: `.opencode/agents/guokao-champion.md` (国考总分第一)
- Create: `.opencode/agents/chongqing-champion.md` (重庆省考总分第一)
- Modify: `opencode.json` (register student agents)

**Approach:**
- **国考状元 (guokao-champion)**: 应届生, full-time preparation, campus study rhythm, abundant time perspective. Responds with fresh-graduate insights, systematic study methods, exam-day psychology.
- **重庆状元 (chongqing-champion)**: 在职备考, 9-to-6 job with frequent overtime (often until 8:30pm, sometimes all-night), fragmented study time. Responds with efficiency-focused strategies, time-squeezing tips, realistic constraint-aware advice.
- Both agents: subagent mode, read-only tools, 2-3 sentence response format, unique personal perspective

**Test scenarios:**
- Happy path: 国考状元 responds with fresh-grad perspective
- Happy path: 重庆状元 responds with working-adult time-constrained perspective
- Edge case: both students give different angles on same question → unique, non-repetitive

**Verification:**
- Both student agents registered and callable
- Personas are distinct and consistent
- Responses complement teacher answers with student perspective

---

- [ ] **Unit 9: Integration and End-to-End Validation**

**Goal:** Wire everything together, validate full flows, and create `opencode.json` with final configuration.

**Requirements:** All Phase 1 requirements

**Dependencies:** Units 1-8

**Files:**
- Modify: `opencode.json` (final configuration with all agents, tools, permissions)
- Modify: `AGENTS.md` (final project instructions)
- Modify: `.opencode/plugins/coaching-tools.ts` (any integration fixes)

**Approach:**
- Final `opencode.json` with all agent entries, tool permissions, orchestrator as primary
- Validate end-to-end flows:
  1. **Identity flow**: New user → enter name → profile created → welcome message
  2. **Question answer flow**: User asks question → route to correct agents → integrated response
  3. **Practice flow**: Request question → generated → timer starts → answer submitted → graded → points awarded → analysis available
  4. **Progress flow**: User asks "我的学习情况" → stats retrieved from profile
- Ensure orchestrator has access to all custom tools
- Verify all agents have correct tool permissions

**Test scenarios:**
- Integration: full practice loop (出题→答题→判题→积分→看解析) works end-to-end
- Integration: user identity persists across tool calls within a session
- Integration: multi-agent response follows required format
- Integration: points correctly update after each answer
- Edge case: user switches topic mid-session → orchestrator re-routes correctly
- Edge case: session starts with existing user → profile loaded, stats shown

**Verification:**
- All 4 end-to-end flows work correctly
- User profile persists to `data/users/` files
- Multi-agent output is structured, non-repetitive, and useful
- Points and levels track correctly across questions

## System-Wide Impact

- **Agent count**: From 2 → 10 agents (orchestrator + 7 teachers + 2 students)
- **New plugin**: `.opencode/plugins/coaching-tools.ts` registers 5 tools (user-profile, timer, grading, question-generator, points)
- **Data directory**: `data/users/` for persistent user profiles (gitignored)
- **Config changes**: `opencode.json` fully rewritten with new agent registry
- **Unchanged invariants**: OpenCode platform behavior, plugin SDK API, agent `.md` file format

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Orchestrator routing accuracy | Explicit routing table in orchestrator prompt; fall back to asking user for clarification |
| LLM generating incorrect question answers | Self-check step in question generation; teacher verifies own answer before delivery |
| Multi-agent output too verbose/repetitive | Strict output format rules in each agent's prompt; orchestrator merges and deduplicates |
| Tool registration naming collision | Use plugin pattern with explicit tool name keys (`timer`, `grading`, etc.) — no filename-based naming |
| User profile file corruption | Atomic writes (write-to-temp + rename); graceful error messages on read failure |
| Phase 1 scope creep (申论, subjective) | Hard scope boundary in AGENTS.md; orchestrator deflects out-of-scope requests |

## Documentation / Operational Notes

- `AGENTS.md` will serve as the project-level convention guide for all agents
- `data/.gitignore` prevents user data from being committed
- Each agent `.md` file is self-documenting (persona, capabilities, output format)

## Sources & References

- **Origin document:** [docs/brainstorms/gwy-multi-agent-coaching-requirements.md](docs/brainstorms/gwy-multi-agent-coaching-requirements.md)
- OpenCode plugin docs: https://opencode.ai/docs/zh-cn/plugins/
- OpenCode custom tools docs: https://opencode.ai/docs/zh-cn/custom-tools/
- Reference project: `E:\Documents\IdeaProjects\oh-my-openagent` (tool factory patterns, atomic writes, agent factories)
