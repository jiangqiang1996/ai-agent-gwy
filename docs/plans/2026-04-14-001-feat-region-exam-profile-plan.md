---
title: "feat: 地区与考试类型感知的个性化辅导"
type: feat
status: active
date: 2026-04-14
origin: docs/brainstorms/region-exam-profile-requirements.md
---

# feat: 地区与考试类型感知的个性化辅导

## Overview

为公务员/事业单位考试辅导系统添加考试类型（国考/省考/事业单位，支持多选）和地区（省份）感知能力。影响用户档案、考试配置、出题逻辑、考情分析、学习计划五个维度。未提供信息的用户降级为通用策略。

## Problem Frame

当前系统对所有用户使用统一的行测 6 科目和通用教学策略，但实际上国考、省考、事业单位的考试科目和侧重点差异显著，不同省份还有特殊科目。用户需要针对自己报考情况获得差异化辅导。

## Requirements Trace

- R1. UserProfile 增加 `examTypes`（数组）和 `region`（可选），旧数据需补填默认值
- R2. 考试类型枚举支持多选，出题取科目并集
- R3. 地区为省份/直辖市枚举，支持空值
- R4. 首次交互收集姓名（必填）+ 考试类型/地区（选填），`loadOrCreate` 扩展支持
- R5. 新增 `updateProfile` action + "设置资料"技能，支持修改姓名/考试类型/地区
- R6. 结构化配置定义每种考试类型的科目列表、权重、难度
- R7. 配置覆盖地区特殊科目
- R8. 考情侧重由编排器传上下文给 AI 代理，不单独配置
- R9. 未指定时降级为通用配置
- R10. question-generator 从动态配置读取科目
- R11. 非考试科目软降权（极低权重），非硬排除
- R12. 地区特殊科目纳入出题
- R13. 编排器支持"考情分析"路由
- R14. 老师代理根据地区+考试类型给考情建议
- R15. 编排器支持"制定学习计划"路由
- R16. 会话开始时主动给简短学习建议
- R17. 用户请求时给完整学习计划
- R18. 学习计划存储到档案，支持跨会话对比

## Scope Boundaries

- 不实现真实考试报名等功能
- 地区考情为配置 + AI 混合，不保证 100% 准确
- 不区分同省不同年份考情变化

## Context & Research

### Relevant Code and Patterns

- `.opencode/plugins/coaching-tools.ts` — 唯一代码文件，401 行，包含所有 5 个工具
- `.opencode/agents/orchestrator.md` — 编排器路由表、意图识别、多代理输出格式
- `.opencode/agents/xingce-*-teacher.md` — 7 个科目老师代理定义
- `opencode.json` — 代理注册、工具权限、颜色配置
- UserProfile 接口（`coaching-tools.ts:8-29`）：当前 7 个字段
- XINGCE_SUBJECTS 常量（`coaching-tools.ts:80-82`）：硬编码 6 科目
- XINGCE_LEAF_TOPICS 常量（`coaching-tools.ts:83-90`）：硬编码叶子题型
- question-generator 工具（`coaching-tools.ts:266-343`）：当前硬编码科目验证
- 数据持久化模式：JSON 文件 + atomicWrite（tmp + rename）

### Institutional Learnings

- 无 `docs/solutions/` 目录，项目处于早期阶段
- 无测试基础设施（无测试文件、无测试 runner、无 CI）

### External References

- OpenCode Plugin API: `@opencode-ai/plugin` v1.4.3
- 技能（skills）目录为空，需理解 OpenCode 技能机制

## Key Technical Decisions

- **考试配置以 TS 常量嵌入插件**：项目已有 `XINGCE_SUBJECTS` 常量模式，保持一致，除非配置超过 ~200 行再提取
- **单文件扩展而非拆分**：401 行文件可管理，所有工具在同一个插件中
- **UserProfile 旧数据迁移在 loadProfile 时执行**：读取后补填缺失字段
- **编排器通过 task 工具传上下文**：在发给子代理的 prompt 中附加考试类型+地区信息
- **学习计划存入 UserProfile 新字段**：`studyPlan` 对象（计划内容 + 生成时间），跨会话对比通过 mastery 数据与存储计划的科目优先级对照实现

## Open Questions

### Resolved During Planning

- 考试配置存储位置：TS 常量（与现有模式一致）
- R8 考情侧重：编排器上下文传递，不单独配置
- R11 科目排除：软降权而非硬排除
- 多考备考：`examTypes` 为数组，出题取并集
- 学习计划追踪：存入档案支持跨会话对比
- 用户改名策略：稳定 ID（UUID）作为文件名，name 只作显示字段

### Deferred to Implementation

- 各地区特殊科目完整清单：实现时调研填入配置
- `updateProfile` 用户改名时的文件重命名策略：使用稳定 ID（✅ 已决定）
- 学习计划生成代理选择（复用现有 vs 新增）：实现时根据 prompt 复杂度决定
- 考情分析是否需要新增 `exam-info-teacher` 代理：实现时决定
- OpenCode skills 机制的具体实现方式：需调研 OpenCode 技能 API

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification.*

```
┌─────────────────────────────────────────────────┐
│                 opencode.json                    │
│  + exam-info-teacher agent (TBD)                │
│  + skill: update-profile                        │
├─────────────────────────────────────────────────┤
│           orchestrator.md (updated)              │
│  + 考情分析 / 学习计划 意图路由                    │
│  + 上下文注入: examTypes + region → sub-agents   │
│  + 会话开始主动建议 (R16)                         │
├─────────────────────────────────────────────────┤
│        coaching-tools.ts (extended)              │
│                                                  │
│  EXAM_CONFIGS ─── 新考试配置常量                   │
│    ├─ guokao: { subjects[], weights{}, ... }     │
│    ├─ shengkao: { subjects[], ... }              │
│    ├─ shiyedanwei: { subjects[], ... }           │
│    └─ REGION_SPECIAL: { 广东: [科学推理], ... }   │
│                                                  │
│  UserProfile ─── +examTypes, region, studyPlan   │
│  user-profile ─── +loadOrCreate扩展, updateProfile│
│  question-generator ─── 从EXAM_CONFIGS动态读取    │
│  (其余工具不变)                                   │
├─────────────────────────────────────────────────┤
│        .opencode/agents/ (updated)               │
│  各老师代理 .md 中加入考试类型+地区上下文处理指导   │
└─────────────────────────────────────────────────┘
```

## Implementation Units

- [ ] **Unit 1: 考试配置数据 + UserProfile 扩展**

**Goal:** 建立考试类型配置数据结构，扩展 UserProfile 接口支持新字段

**Requirements:** R1, R2, R3, R6, R7, R9

**Dependencies:** None

**Files:**
- Modify: `.opencode/plugins/coaching-tools.ts`

**Approach:**
- 新增 `EXAM_CONFIGS` 常量，定义国考/省考/事业单位的科目列表、出题权重、难度倾向
- 新增 `REGION_SPECIAL_SUBJECTS` 常量，定义地区特殊科目（如广东科学推理）
- 新增 `REGIONS` 常量（省份枚举）
- 扩展 `UserProfile` 接口：添加 `id: string`（UUID，稳定主键）、`examTypes: string[]`、`region: string | null`、`studyPlan: { content: string, createdAt: string } | null`
- 文件名改为 `data/users/{id}.json`，`name` 只作显示字段，改名不再涉及文件操作
- 更新 `createUserProfile()` 初始化新字段（id 使用 crypto.randomUUID()）
- 更新 `getProfilePath()` 使用 id 而非 name 拼接文件名
- `loadOrCreate` 的 username 参数改为：先遍历 data/users/ 查找 name 匹配的档案，找不到再创建新用户
- 在 `loadProfile()` 中添加迁移逻辑：读取后补填缺失字段
- 区分"文件不存在"（新用户）和"文件损坏"（JSON 解析失败）：文件损坏时返回错误而非静默创建新档案

**Patterns to follow:**
- 现有 `XINGCE_SUBJECTS`、`XINGCE_LEAF_TOPICS` 常量模式
- 现有 `createUserProfile()` 工厂函数模式

**Test scenarios:**
- Test expectation: none — 无测试基础设施，手动验证通过 OpenCode CLI 交互

**Verification:**
- `loadOrCreate` 新用户时 `examTypes` 为空数组，`region` 为 null
- 旧格式档案加载后自动补填默认值

---

- [ ] **Unit 2: user-profile 工具扩展**

**Goal:** `loadOrCreate` 支持传入 examTypes/region，新增 `updateProfile` action

**Requirements:** R4, R5 — updateProfile action only

**Files:**
- Modify: `.opencode/plugins/coaching-tools.ts`

**Approach:**
- 扩展 `loadOrCreate` 的 args：添加 `examTypes`（string[], optional）和 `region`（string, optional）
- 首次创建时写入传入的 examTypes/region；已有用户若 examTypes/region 为空则写入传入值（首次设置语义），若已有值则忽略
- 新增 `updateProfile` action：接收 username + 可选的 name/examTypes/region，更新档案并保存（改名只更新 name 字段，无需文件操作）
- 输入验证：examTypes 每项必须在枚举内，region 必须在省份枚举内或为空

**Patterns to follow:**
- 现有 `loadOrCreate`/`getStats`/`updateMastery` action 分支模式
- `atomicWrite()` 用于安全写入
- `args` 验证模式：`tool.schema.string().optional().describe()`

**Test scenarios:**
- Happy path: `loadOrCreate` 传入 examTypes=["guokao"] + region="北京"，新用户正确存储
- Happy path: `updateProfile` 修改 examTypes 和 region，档案正确更新
- Edge case: `loadOrCreate` 已有用户传入 examTypes，不覆盖现有值
- Error path: `updateProfile` 不存在的用户名返回错误
- Error path: 无效的 examType 或 region 值返回错误

**Verification:**
- 新用户通过 `loadOrCreate` 可同时设置 examTypes/region
- `updateProfile` 可修改任意字段，改名只更新显示名不涉及文件操作
- 返回信息包含更新后的 examTypes/region 状态

---

- [ ] **Unit 3: question-generator 动态配置**

**Goal:** question-generator 从 EXAM_CONFIGS 动态读取科目，支持考试类型+地区差异化出题

**Requirements:** R10, R11, R12

**Dependencies:** Unit 1

**Files:**
- Modify: `.opencode/plugins/coaching-tools.ts`

**Approach:**
- question-generator 新增 args：`examTypes`（string[], optional）、`region`（string, optional）
- 科目列表获取逻辑：从 `EXAM_CONFIGS` 中按 examTypes 取并集
- 未指定 examTypes 时使用 `XINGCE_SUBJECTS`（通用策略，R9）
- 地区特殊科目：检查 `REGION_SPECIAL_SUBJECTS[region]`，加入候选科目列表
- 出题权重算法（权重归一化至 1.0）：
  1. 从 EXAM_CONFIGS 按 examTypes 取科目并集
  2. 共享科目权重取各考试类型中的最大值（如数量关系在国考权重 0.2、省考权重 0.15，取 0.2）
  3. 地区特殊科目加入候选列表，赋予与考试科目相同的默认权重
  4. 非任何已选考试类型的科目（"非考试科目"）软降权至总权重预算的 5%，剩余 95% 按比例分配给考试科目
  5. 权重与薄弱项优先策略叠加：在权重筛选后的候选中，优先选薄弱项（worstAcc 逻辑）
  6. 无 mastery 数据的冷启动用户：在考试科目范围内随机选择（不按列表顺序取第一个）
- 移除硬编码的 `XINGCE_SUBJECTS.includes(selectedSubject)` 验证，改为动态验证：新增 `getValidSubjects(examTypes, region)` 辅助函数，返回 XINGCE_SUBJECTS（examTypes 为空时）或 EXAM_CONFIGS 科目并集 + 地区特殊科目
- 叶子题型查找也需适配：地区特殊科目在 REGION_SPECIAL_SUBJECTS 中定义 leafTopics，查找时先查 XINGCE_LEAF_TOPICS 再查地区配置；若无叶子题型则直接传科目名给老师

**Patterns to follow:**
- 现有 question-generator 的薄弱项优先策略（`worstAcc` 逻辑）
- 现有随机选题 fallback 逻辑

**Test scenarios:**
- Happy path: examTypes=["shiyedanwei"] 时，不考的科目权重极低但仍可出
- Happy path: examTypes=["guokao","shengkao"] 时，取两种考试科目并集
- Happy path: region="广东" 时，候选科目包含科学推理
- Edge case: examTypes 为空数组时，降级为全部行测科目均等权重
- Edge case: region 无特殊科目时，不影响出题
- Integration: 返回的 JSON 中 teacherPrompt 包含正确的科目信息

**Verification:**
- 设置事业单位后多次出题，不相关科目出现概率极低
- 设置广东后可以出科学推理题
- 多选考试类型后科目覆盖并集

---

- [ ] **Unit 4: 编排器路由扩展**

**Goal:** 编排器支持考情分析、学习计划意图路由，会话开始主动建议，传上下文给子代理

**Requirements:** R8 (编排器上下文注入), R13, R14 (考情分析路由), R15, R16, R17

**Dependencies:** Unit 1, Unit 2

**Files:**
- Modify: `.opencode/agents/orchestrator.md`
- Possibly modify: `.opencode/agents/xingce-zong-teacher.md`（学习计划能力）
- Possibly create: `.opencode/agents/exam-info-teacher.md`（考情分析代理，TBD）

**Approach:**
- 扩展编排器路由表：新增"考情分析"和"制定学习计划"意图
- 考情分析路由：读取用户 examTypes/region，作为上下文传给老师代理
- 学习计划路由：读取 mastery 数据 + examTypes/region，生成完整计划，存入档案
- 会话开始逻辑：用户已有档案时，加载 examTypes/region + 薄弱科目，给出 1-2 句建议
- 上下文注入模式：编排器在 task 工具调用时，在 prompt 前附加 "用户信息：考试类型=[...]，地区=[...]"
- 更新"用户身份管理"部分：首次交互收集 examTypes/region
- 更新"出题练习流程"：调用 question-generator 时传入 examTypes/region

**Patterns to follow:**
- 现有路由表格式（`| 意图 | 参与代理/工具 |`）
- 现有意图识别→路由→工具调用流程
- 现有多代理输出格式（`【角色名】` + `【总结】`）

**Test scenarios:**
- Happy path: 用户说"分析一下广东国考考情" → 路由到考情分析，传入 examTypes+region
- Happy path: 用户说"帮我制定学习计划" → 路由到学习计划，综合 mastery 数据
- Happy path: 会话开始时，已有档案用户收到简短建议
- Edge case: 无 examTypes/region 的用户请求考情分析 → 通用建议
- Integration: 编排器调用 question-generator 时正确传入 examTypes/region

**Verification:**
- 用户说"考情分析"时，老师代理回答中包含地区/考试类型针对性内容
- 会话开始时，返回用户看到个性化建议
- 学习计划存入档案后下次会话可对比

---

- [ ] **Unit 5: 学习计划存储与对比**

**Goal:** UserProfile 新增 studyPlan 字段，支持存储和对比

**Requirements:** R18

**Dependencies:** Unit 1

**Files:**
- Modify: `.opencode/plugins/coaching-tools.ts`

**Approach:**
- UserProfile 新增 `studyPlan` 字段（Unit 1 已添加接口，此单元实现业务逻辑）
- `studyPlan` 结构：`{ content: string, createdAt: string }`，不存储 progress 字段（进度从 mastery 数据实时计算，始终准确）
- user-profile 工具新增 `saveStudyPlan` action：存储计划内容
- user-profile `getStats` 输出中追加学习计划进度摘要
- 编排器在学习计划路由中：先读取已有计划的 content 和 createdAt，对比当前 mastery 数据与计划科目优先级，生成"对比上次计划"的进度反馈

**Patterns to follow:**
- 现有 `updateMastery` 的档案更新模式
- `getStats` 的格式化输出模式

**Test scenarios:**
- Happy path: 存储学习计划后 `getStats` 显示计划摘要
- Happy path: 再次请求学习计划时，编排器读取旧计划与当前 mastery 对比
- Edge case: 无旧计划时直接生成新计划
- Edge case: studyPlan 字段格式兼容性

**Verification:**
- 用户第一次请求学习计划 → 存入档案
- 用户第二次请求 → 编排器提示"对比上次计划的进度"
- `getStats` 显示学习计划状态

---

- [ ] **Unit 6: "设置/更新资料"技能**

**Goal:** 创建 OpenCode 技能，允许用户主动更新姓名/考试类型/地区

**Requirements:** R5 — 设置/更新资料 skill only

**Files:**
- Create: `.opencode/skills/update-profile.md`（或 OpenCode skills 对应文件）

**Approach:**
- 调研 OpenCode skills 机制（当前 skills 目录为空）
- 创建技能定义文件，指导编排器调用 `updateProfile` action
- 技能触发：用户说"修改资料"/"更新设置"/"换考试类型"等
- 技能内容：提示编排器询问要修改的字段，调用 `user-profile` 工具的 `updateProfile` action
- 在 opencode.json 中注册技能（如需要）

**Patterns to follow:**
- AGENTS.md 中 `skills/` 描述："用户主动触发的操作"
- OpenCode 技能 API（需实现时调研）

**Test scenarios:**
- Happy path: 用户说"修改考试类型为省考" → 技能触发 → updateProfile 更新
- Happy path: 用户说"修改地区为上海" → 技能触发 → updateProfile 更新
- Edge case: 用户说"改名字为小明" → 改名成功

**Verification:**
- 用户通过自然语言触发技能，档案正确更新

---

- [ ] **Unit 7: 老师代理上下文感知更新**

**Goal:** 老师代理 .md 文件增加考试类型+地区上下文处理指导

**Requirements:** R8 (老师代理上下文消费), R14 (老师代理考情回答)

**Dependencies:** Unit 4

**Files:**
- Modify: `.opencode/agents/xingce-zong-teacher.md`
- Modify: `.opencode/agents/xingce-yanyu-teacher.md`
- Modify: `.opencode/agents/xingce-shuliang-teacher.md`
- Modify: `.opencode/agents/xingce-panduan-teacher.md`
- Modify: `.opencode/agents/xingce-ziliao-teacher.md`
- Modify: `.opencode/agents/xingce-changshi-teacher.md`
- Modify: `.opencode/agents/xingce-zhengzhi-teacher.md`

**Approach:**
- 在每个老师代理的 .md 文件中添加"考试类型与地区感知"章节
- 指导老师根据编排器传入的 examTypes 和 region 上下文调整回答
- 考情分析时提供该地区该考试类型的针对性建议
- 出题时根据考试类型调整难度和题型风格
- 各老师根据自己科目特点给出具体的地区考情指导（如数量关系老师说明某省数量关系占比高）

**Patterns to follow:**
- 现有代理 .md 格式（角色定位、专业能力、教学风格、回答格式）

**Test scenarios:**
- Happy path: 考情分析请求中，老师代理回答包含地区针对性内容
- Happy path: 出题时题目难度符合考试类型特点

**Verification:**
- 编排器传入地区+考试类型上下文后，老师代理回答中体现差异化

## System-Wide Impact

- **Interaction graph:** question-generator 现在依赖用户档案中的 examTypes/region，编排器需在出题流程中传入这些信息
- **Error propagation:** 无效的 examType/region 值应在工具层返回明确错误，不传播到子代理
- **State lifecycle risks:** UserProfile 新字段的迁移需保证旧数据不丢失
- **API surface parity:** opencode.json 需同步更新（新代理注册、技能注册）
- **Integration coverage:** 编排器→工具→代理的完整链路需端到端验证
- **Unchanged invariants:** timer、grading、points 工具不受影响；子代理的工具权限不变（只读）

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| 各地区特殊科目数据不完整 | 先覆盖主要省份（广东、上海、北京、浙江等），其余省份后续迭代补充 |
| OpenCode skills 机制不明 | 实现时调研 API，若无标准技能机制可降级为编排器 prompt 处理 |
| 用户改名导致文件引用断裂 | 使用稳定 ID（UUID）作为文件名，name 只作显示字段，改名无需文件操作 |
| 学习计划存入档案导致文件过大 | studyPlan 限制最大长度，只保留最近一份计划 |
| 事业单位考试科目数据可能不够准确 | R8 决定靠 AI 上下文提供灵活性，配置只覆盖硬事实 |

## Sources & References

- **Origin document:** [docs/brainstorms/region-exam-profile-requirements.md](docs/brainstorms/region-exam-profile-requirements.md)
- Related code: `.opencode/plugins/coaching-tools.ts`
- Related agents: `.opencode/agents/orchestrator.md`, `.opencode/agents/xingce-*-teacher.md`
- Config: `opencode.json`
