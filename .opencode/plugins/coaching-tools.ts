import { type Plugin, tool } from "@opencode-ai/plugin"
import { readFileSync, writeFileSync, mkdirSync, existsSync, renameSync, readdirSync, unlinkSync } from "fs"
import { join, dirname } from "path"
import { randomUUID } from "crypto"

const DATA_DIR = "data"
const USERS_DIR = join(DATA_DIR, "users")

interface UserProfile {
  name: string
  createdAt: string
  points: number
  level: number
  streak: { current: number; best: number }
  mastery: Record<string, {
    total: number
    correct: number
    avgTimeSeconds: number
    leafTopics: Record<string, { total: number; correct: number; avgTimeSeconds: number }>
  }>
  history: Array<{
    id: string
    timestamp: string
    subject: string
    leafTopic: string
    correct: boolean
    timeSeconds: number
    pointsChange: number
  }>
  id: string
  examTypes: string[]
  region: string | null
  studyPlan: { content: string; createdAt: string } | null
}

function createUserProfile(name: string): UserProfile {
  return {
    id: randomUUID(),
    name,
    createdAt: new Date().toISOString(),
    points: 0,
    level: 1,
    streak: { current: 0, best: 0 },
    mastery: {},
    history: [],
    examTypes: [],
    region: null,
    studyPlan: null,
  }
}

function getProfilePathById(worktree: string, id: string): string {
  return join(worktree, USERS_DIR, `${id}.json`)
}

function atomicWrite(filePath: string, data: string): void {
  const dir = dirname(filePath)
  mkdirSync(dir, { recursive: true })
  const tmp = `${filePath}.tmp`
  writeFileSync(tmp, data, "utf-8")
  renameSync(tmp, filePath)
}

function findProfileByName(worktree: string, name: string): UserProfile | null {
  const dir = join(worktree, USERS_DIR)
  if (!existsSync(dir)) return null
  try {
    const files = readdirSync(dir).filter(f => f.endsWith(".json"))
    for (const f of files) {
      try {
        const profile = JSON.parse(readFileSync(join(dir, f), "utf-8"))
        if (profile.name === name) return profile
      } catch { continue }
    }
  } catch { return null }
  return null
}

function loadProfileByName(worktree: string, name: string): UserProfile | null {
  const found = findProfileByName(worktree, name)
  if (!found) return null
  return migrateProfile(found)
}

function migrateProfile(profile: UserProfile): UserProfile {
  if (!profile.id) profile.id = randomUUID()
  if (!profile.examTypes) profile.examTypes = []
  if (profile.region === undefined) profile.region = null
  if (!profile.studyPlan) profile.studyPlan = null
  return profile
}

function saveProfile(worktree: string, profile: UserProfile): void {
  const newPath = getProfilePathById(worktree, profile.id)
  const oldPath = join(worktree, USERS_DIR, `${profile.name}.json`)
  if (oldPath !== newPath && existsSync(oldPath)) {
    try { unlinkSync(oldPath) } catch {}
  }
  atomicWrite(newPath, JSON.stringify(profile, null, 2))
}

const LEVEL_THRESHOLDS = [0, 50, 150, 300, 500, 800, 1200, 1700, 2300, 3000]
const POINTS_CORRECT = 10
const POINTS_WRONG = 3

function calcLevel(points: number): number {
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (points >= LEVEL_THRESHOLDS[i]) return i + 1
  }
  return 1
}

const XINGCE_SUBJECTS = [
  "言语理解与表达", "数量关系", "判断推理", "资料分析", "常识判断", "政治理论",
]
const XINGCE_LEAF_TOPICS: Record<string, string[]> = {
  "言语理解与表达": ["逻辑填空", "片段阅读", "语句表达"],
  "数量关系": ["数学运算"],
  "判断推理": ["图形推理", "定义判断", "类比推理", "逻辑判断"],
  "资料分析": ["资料分析"],
  "常识判断": ["法律", "经济", "科技与生活", "人文与历史", "国情地理", "管理与公文"],
  "政治理论": ["政治理论"],
}

const EXAM_TYPES = ["guokao", "shengkao", "shiyedanwei"] as const
type ExamType = typeof EXAM_TYPES[number]

const EXAM_CONFIGS: Record<ExamType, {
  subjects: string[]
  weights: Record<string, number>
  difficulty: string
}> = {
  guokao: {
    subjects: ["言语理解与表达", "数量关系", "判断推理", "资料分析", "常识判断", "政治理论"],
    weights: { "言语理解与表达": 0.2, "数量关系": 0.15, "判断推理": 0.2, "资料分析": 0.15, "常识判断": 0.15, "政治理论": 0.15 },
    difficulty: "中高",
  },
  shengkao: {
    subjects: ["言语理解与表达", "数量关系", "判断推理", "资料分析", "常识判断"],
    weights: { "言语理解与表达": 0.22, "数量关系": 0.15, "判断推理": 0.22, "资料分析": 0.18, "常识判断": 0.23 },
    difficulty: "中",
  },
  shiyedanwei: {
    subjects: ["言语理解与表达", "数量关系", "判断推理", "资料分析", "常识判断"],
    weights: { "言语理解与表达": 0.25, "数量关系": 0.1, "判断推理": 0.25, "资料分析": 0.15, "常识判断": 0.25 },
    difficulty: "中低",
  },
}

const REGION_SPECIAL_SUBJECTS: Record<string, Array<{ subject: string; leafTopics: string[] }>> = {
  "广东": [{ subject: "科学推理", leafTopics: ["物理推理", "化学推理", "生物推理"] }],
}

const REGIONS = [
  "北京", "天津", "上海", "重庆", "河北", "山西", "辽宁", "吉林", "黑龙江",
  "江苏", "浙江", "安徽", "福建", "江西", "山东", "河南", "湖北", "湖南",
  "广东", "海南", "四川", "贵州", "云南", "陕西", "甘肃", "青海", "台湾",
  "内蒙古", "广西", "西藏", "宁夏", "新疆",
]

function getValidSubjects(examTypes: string[], region: string | null): string[] {
  const subjects = new Set<string>()
  if (examTypes.length === 0) {
    for (const s of XINGCE_SUBJECTS) subjects.add(s)
  } else {
    for (const et of examTypes) {
      const cfg = EXAM_CONFIGS[et as ExamType]
      if (cfg) for (const s of cfg.subjects) subjects.add(s)
    }
  }
  if (region && REGION_SPECIAL_SUBJECTS[region]) {
    for (const rs of REGION_SPECIAL_SUBJECTS[region]) subjects.add(rs.subject)
  }
  return Array.from(subjects)
}

function getLeafTopics(subject: string, region: string | null): string[] {
  if (XINGCE_LEAF_TOPICS[subject]) return XINGCE_LEAF_TOPICS[subject]
  if (region && REGION_SPECIAL_SUBJECTS[region]) {
    const found = REGION_SPECIAL_SUBJECTS[region].find(rs => rs.subject === subject)
    if (found) return found.leafTopics
  }
  return []
}

interface TimerState {
  startTime: number
  questionId: string
  timeout: number
}

const activeTimers = new Map<string, TimerState>()

export const CoachingPlugin: Plugin = async (ctx) => {
  return {
    tool: {
      "user-profile": tool({
        description: "用户档案管理。操作: loadOrCreate(加载或创建用户), getStats(获取学习统计), updateMastery(更新答题记录), updateProfile(更新资料), saveStudyPlan(保存学习计划)。每次调用必须传 username 参数。",
        args: {
          action: tool.schema.enum(["loadOrCreate", "getStats", "updateMastery", "updateProfile", "saveStudyPlan"]).describe("操作类型"),
          username: tool.schema.string().describe("用户名"),
          subject: tool.schema.string().optional().describe("科目 (updateMastery 时必填)"),
          leafTopic: tool.schema.string().optional().describe("叶子题型 (updateMastery 时可选)"),
          correct: tool.schema.boolean().optional().describe("是否正确 (updateMastery 时必填)"),
          timeSeconds: tool.schema.number().optional().describe("答题耗时秒数 (updateMastery 时必填)"),
          examTypes: tool.schema.array(tool.schema.string()).optional().describe("考试类型数组 (loadOrCreate/updateProfile 时可选)"),
          region: tool.schema.string().optional().describe("地区/省份 (loadOrCreate/updateProfile 时可选)"),
          newName: tool.schema.string().optional().describe("新名字 (updateProfile 时可选)"),
          planContent: tool.schema.string().optional().describe("学习计划内容 (saveStudyPlan 时必填)"),
        },
        async execute(args, context) {
          try {
            const worktree = context.worktree
            switch (args.action) {
              case "loadOrCreate": {
                const loaded = loadProfileByName(worktree, args.username)
                if (!loaded) {
                  const profile = createUserProfile(args.username)
                  if (args.examTypes && Array.isArray(args.examTypes)) {
                    const valid = args.examTypes.filter((t: string) => EXAM_TYPES.includes(t as ExamType))
                    profile.examTypes = valid
                  }
                  if (args.region && REGIONS.includes(args.region)) {
                    profile.region = args.region
                  }
                  saveProfile(worktree, profile)
                  return `新用户 ${args.username} 创建成功。ID: ${profile.id}, 积分: 0, 等级: 1, 考试类型: ${profile.examTypes.join(",") || "未设置"}, 地区: ${profile.region || "未设置"}`
                }
                const profile = loaded
                const totalQ = profile.history.length
                const totalCorrect = profile.history.filter(h => h.correct).length
                const accuracy = totalQ > 0 ? Math.round((totalCorrect / totalQ) * 100) : 0
                return `欢迎回来，${profile.name}！等级: Lv.${profile.level}, 积分: ${profile.points}, 已答题: ${totalQ}题, 正确率: ${accuracy}%, 连续正确: ${profile.streak.current}题, 考试类型: ${profile.examTypes.join(",") || "未设置"}, 地区: ${profile.region || "未设置"}`
              }
              case "getStats": {
                const loaded = loadProfileByName(worktree, args.username)
                if (!loaded) return `Error: 用户 ${args.username} 不存在`
                const profile = loaded
                const lines: string[] = []
                lines.push(`=== ${profile.name} 的学习数据 ===`)
                lines.push(`积分: ${profile.points} | 等级: Lv.${profile.level} | 连续正确: ${profile.streak.current} (最佳: ${profile.streak.best})`)
                lines.push("")
                for (const [subj, data] of Object.entries(profile.mastery)) {
                  const acc = data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0
                  const sampleNote = data.total < 5 ? " [样本不足]" : ""
                  lines.push(`【${subj}】${data.total}题, 正确率 ${acc}%${sampleNote}, 平均 ${data.avgTimeSeconds}s`)
                  for (const [leaf, ld] of Object.entries(data.leafTopics || {})) {
                    const la = ld.total > 0 ? Math.round((ld.correct / ld.total) * 100) : 0
                    const ln = ld.total < 5 ? " [样本不足]" : ""
                    lines.push(`  - ${leaf}: ${ld.total}题, ${la}%${ln}, 平均 ${ld.avgTimeSeconds}s`)
                  }
                }
                lines.push(`考试类型: ${profile.examTypes.join(",") || "未设置"} | 地区: ${profile.region || "未设置"}`)
                if (profile.studyPlan) {
                  lines.push(`学习计划: 已保存 (${new Date(profile.studyPlan.createdAt).toLocaleDateString("zh-CN")})`)
                }
                return lines.join("\n")
              }
              case "updateMastery": {
                if (!args.subject || args.correct === undefined || !args.timeSeconds) {
                  return "Error: updateMastery 需要 subject, correct, timeSeconds 参数"
                }
                const loaded = loadProfileByName(worktree, args.username)
                if (!loaded) return `Error: 用户 ${args.username} 不存在`
                const profile = loaded
                const qid = `q-${Date.now()}`
                if (!profile.mastery[args.subject]) {
                  profile.mastery[args.subject] = { total: 0, correct: 0, avgTimeSeconds: 0, leafTopics: {} }
                }
                const m = profile.mastery[args.subject]
                const oldAvg = m.avgTimeSeconds
                m.avgTimeSeconds = Math.round((oldAvg * m.total + args.timeSeconds) / (m.total + 1))
                m.total++
                if (args.correct) m.correct++
                if (args.leafTopic) {
                  if (!m.leafTopics[args.leafTopic]) {
                    m.leafTopics[args.leafTopic] = { total: 0, correct: 0, avgTimeSeconds: 0 }
                  }
                  const lt = m.leafTopics[args.leafTopic]
                  const ltOld = lt.avgTimeSeconds
                  lt.avgTimeSeconds = Math.round((ltOld * lt.total + args.timeSeconds) / (lt.total + 1))
                  lt.total++
                  if (args.correct) lt.correct++
                }
                profile.history.push({
                  id: qid,
                  timestamp: new Date().toISOString(),
                  subject: args.subject,
                  leafTopic: args.leafTopic || "",
                  correct: args.correct,
                  timeSeconds: args.timeSeconds,
                  pointsChange: 0,
                })
                saveProfile(worktree, profile)
                return `记录已更新: ${args.subject}${args.leafTopic ? "/" + args.leafTopic : ""} ${args.correct ? "正确" : "错误"} ${args.timeSeconds}s`
              }
              case "saveStudyPlan": {
                if (!args.planContent) return "Error: saveStudyPlan 需要 planContent 参数"
                const loadedSP = loadProfileByName(worktree, args.username)
                if (!loadedSP) return `Error: 用户 ${args.username} 不存在`
                const profileSP = loadedSP
                profileSP.studyPlan = {
                  content: args.planContent.substring(0, 5000),
                  createdAt: new Date().toISOString(),
                }
                saveProfile(worktree, profileSP)
                return `学习计划已保存 (${new Date().toLocaleDateString("zh-CN")})`
              }
              case "updateProfile": {
                const loadedUP = loadProfileByName(worktree, args.username)
                if (!loadedUP) return `Error: 用户 ${args.username} 不存在`
                const profileUP = loadedUP
                const changes: string[] = []
                if (args.newName && args.newName.trim()) {
                  const existingProfile = findProfileByName(worktree, args.newName.trim())
                  if (existingProfile && existingProfile.id !== profileUP.id) {
                    return `Error: 名字 "${args.newName.trim()}" 已被其他用户使用`
                  }
                  profileUP.name = args.newName.trim()
                  changes.push(`名字→${profileUP.name}`)
                }
                if (args.examTypes !== undefined) {
                  const valid = Array.isArray(args.examTypes) ? args.examTypes.filter((t: string) => EXAM_TYPES.includes(t as ExamType)) : []
                  profileUP.examTypes = valid
                  changes.push(`考试类型→${profileUP.examTypes.join(",") || "未设置"}`)
                }
                if (args.region !== undefined) {
                  if (REGIONS.includes(args.region)) {
                    profileUP.region = args.region
                    changes.push(`地区→${profileUP.region}`)
                  } else if (args.region === "") {
                    profileUP.region = null
                    changes.push(`地区→未设置`)
                  } else {
                    return `Error: 无效地区 "${args.region}"。可选: ${REGIONS.join("、")}`
                  }
                }
                if (changes.length === 0) return "未提供任何需要更新的字段"
                saveProfile(worktree, profileUP)
                return `资料已更新: ${changes.join(", ")}`
              }
              default:
                return `Error: 未知操作 ${args.action}`
            }
          } catch (e) {
            return `Error: ${e instanceof Error ? e.message : String(e)}`
          }
        },
      }),

      timer: tool({
        description: "计时器工具。操作: start(开始计时), stop(停止并返回耗时), status(查看当前状态), abandon(放弃当前计时)。",
        args: {
          action: tool.schema.enum(["start", "stop", "status", "abandon"]).describe("操作类型"),
          questionId: tool.schema.string().optional().describe("题目ID (start 时可选)"),
          timeout: tool.schema.number().optional().describe("超时秒数 (默认180)"),
        },
        async execute(args, context) {
          try {
            const sid = context.sessionID
            switch (args.action) {
              case "start": {
                const timeout = args.timeout || 180
                activeTimers.set(sid, {
                  startTime: Date.now(),
                  questionId: args.questionId || "unknown",
                  timeout,
                })
                return `计时开始 (超时 ${timeout}s)`
              }
              case "stop": {
                const t = activeTimers.get(sid)
                if (!t) return "Error: 没有正在进行的计时"
                activeTimers.delete(sid)
                const elapsed = Math.round((Date.now() - t.startTime) / 1000)
                const mins = Math.floor(elapsed / 60)
                const secs = elapsed % 60
                return `${elapsed} (${mins}分${secs}秒)`
              }
              case "status": {
                const t = activeTimers.get(sid)
                if (!t) return "没有正在进行的计时"
                const elapsed = Math.round((Date.now() - t.startTime) / 1000)
                const remaining = t.timeout - elapsed
                if (remaining <= 0) return `已超时 ${-remaining}s`
                return `正在计时: 已过 ${elapsed}s, 剩余 ${remaining}s`
              }
              case "abandon": {
                const t = activeTimers.get(sid)
                if (!t) return "Error: 没有正在进行的计时"
                activeTimers.delete(sid)
                return "已放弃当前计时，标记为未答"
              }
              default:
                return `Error: 未知操作 ${args.action}`
            }
          } catch (e) {
            return `Error: ${e instanceof Error ? e.message : String(e)}`
          }
        },
      }),

      grading: tool({
        description: "判题工具。对比用户答案和正确答案，返回判题结果。支持客观题(选择题)和主观题(分级评分)。",
        args: {
          correctAnswer: tool.schema.string().describe("正确答案"),
          userAnswer: tool.schema.string().describe("用户答案"),
          questionType: tool.schema.enum(["objective", "subjective"]).describe("题目类型: objective(客观题) 或 subjective(主观题)"),
        },
        async execute(args) {
          try {
            if (args.questionType === "objective") {
              const correct = args.userAnswer.trim().toUpperCase() === args.correctAnswer.trim().toUpperCase()
              return correct ? "correct" : `wrong|${args.correctAnswer.trim().toUpperCase()}`
            }
            return "subjective|需要老师评判"
          } catch (e) {
            return `Error: ${e instanceof Error ? e.message : String(e)}`
          }
        },
      }),

      "question-generator": tool({
        description: "出题工具。根据科目、考试类型和地区生成出题提示模板。支持考试类型差异化权重出题。冷启动用户自动随机选择科目。",
        args: {
          subject: tool.schema.string().optional().describe("科目名称 (可选, 不填则根据用户画像/考试类型选择)"),
          username: tool.schema.string().describe("用户名 (用于查询学习画像)"),
          leafTopic: tool.schema.string().optional().describe("叶子题型 (可选)"),
          examTypes: tool.schema.array(tool.schema.string()).optional().describe("考试类型数组 (可选, 用于差异化出题)"),
          region: tool.schema.string().optional().describe("地区/省份 (可选, 用于地区特殊科目)"),
        },
        async execute(args, context) {
          try {
            const worktree = context.worktree
            const userExamTypes = args.examTypes || []
            const userRegion = args.region || null
            const validSubjects = getValidSubjects(userExamTypes, userRegion)

            let selectedSubject = args.subject
            let selectedLeaf = args.leafTopic

            if (!selectedSubject) {
              const loaded = loadProfileByName(worktree, args.username)
              const profile = loaded
              if (profile && Object.keys(profile.mastery).length > 0) {
                const examSubjects = userExamTypes.length > 0 ? validSubjects : XINGCE_SUBJECTS
                let worstAcc = 100
                const candidates: string[] = []
                for (const subj of examSubjects) {
                  const m = profile.mastery[subj]
                  if (m && m.total >= 5) {
                    const acc = (m.correct / m.total) * 100
                    if (acc < worstAcc) {
                      worstAcc = acc
                      candidates.length = 0
                      candidates.push(subj)
                    } else if (acc === worstAcc) {
                      candidates.push(subj)
                    }
                  } else if (!m) {
                    candidates.push(subj)
                  }
                }
                if (candidates.length > 0) {
                  selectedSubject = candidates[Math.floor(Math.random() * candidates.length)]
                } else {
                  selectedSubject = examSubjects[Math.floor(Math.random() * examSubjects.length)]
                }
              } else {
                const pool = validSubjects.length > 0 ? validSubjects : XINGCE_SUBJECTS
                selectedSubject = pool[Math.floor(Math.random() * pool.length)]
              }
            }

            if (!validSubjects.includes(selectedSubject) && !XINGCE_SUBJECTS.includes(selectedSubject)) {
              return `Error: 未知科目 "${selectedSubject}"。可选: ${validSubjects.join(", ")}`
            }

            if (!selectedLeaf) {
              const leaves = getLeafTopics(selectedSubject, userRegion)
              if (leaves.length > 0) {
                selectedLeaf = leaves[Math.floor(Math.random() * leaves.length)]
              }
            }

            const qid = `q-${Date.now()}`

            const prompt = `请出一道${selectedSubject}${selectedLeaf ? " (" + selectedLeaf + ")" : ""}的练习题。

要求:
1. 必须是单项选择题 (4个选项 A/B/C/D)
2. 题目要有实际难度，不能太简单
3. 必须包含完整的题目文本、4个选项、正确答案和详细解析
4. 自检: 生成后请验证你的答案是否确实正确，选项是否有逻辑问题

输出格式:
题目: [题目文本]
A. [选项A]
B. [选项B]
C. [选项C]
D. [选项D]
正确答案: [A/B/C/D]
解析: [详细解析]`

            return JSON.stringify({
              questionId: qid,
              subject: selectedSubject,
              leafTopic: selectedLeaf || "",
              teacherPrompt: prompt,
            })
          } catch (e) {
            return `Error: ${e instanceof Error ? e.message : String(e)}`
          }
        },
      }),

      points: tool({
        description: "积分工具。操作: award(答对加分), deduct(答错扣分), getLevel(获取等级信息)。积分变化会自动持久化到用户档案。",
        args: {
          action: tool.schema.enum(["award", "deduct", "getLevel"]).describe("操作类型"),
          username: tool.schema.string().describe("用户名"),
          reason: tool.schema.string().optional().describe("原因描述"),
        },
        async execute(args, context) {
          try {
            const worktree = context.worktree
            const loaded = loadProfileByName(worktree, args.username)
            if (!loaded) return `Error: 用户 ${args.username} 不存在`
            const profile = loaded

            switch (args.action) {
              case "award": {
                const oldLevel = profile.level
                profile.points += POINTS_CORRECT
                profile.streak.current++
                if (profile.streak.current > profile.streak.best) {
                  profile.streak.best = profile.streak.current
                }
                profile.level = calcLevel(profile.points)
                saveProfile(worktree, profile)
                const levelUp = profile.level > oldLevel ? ` 恭喜升级到 Lv.${profile.level}！` : ""
                const praises = ["漂亮！继续保持！", "太棒了！", "正确！思路很清晰！", "厉害！这题不简单！", "完美！"]
                const praise = praises[Math.floor(Math.random() * praises.length)]
                return `+${POINTS_CORRECT}积分 (${praise})${levelUp} 当前: ${profile.points}分 Lv.${profile.level}`
              }
              case "deduct": {
                const oldLevel = profile.level
                profile.points = Math.max(0, profile.points - POINTS_WRONG)
                profile.streak.current = 0
                profile.level = calcLevel(profile.points)
                saveProfile(worktree, profile)
                const levelDown = profile.level < oldLevel ? ` 等级降至 Lv.${profile.level}` : ""
                const criticisms = ["这道题还需要加强，来看看解析吧。", "别灰心，错题是最好的老师。", "记住这个知识点，下次就不会错了。"]
                const criticism = criticisms[Math.floor(Math.random() * criticisms.length)]
                return `-${POINTS_WRONG}积分 (${criticism})${levelDown} 当前: ${profile.points}分 Lv.${profile.level}`
              }
              case "getLevel": {
                const nextThreshold = LEVEL_THRESHOLDS[profile.level] || 9999
                const progress = profile.points - (LEVEL_THRESHOLDS[profile.level - 1] || 0)
                const needed = nextThreshold - (LEVEL_THRESHOLDS[profile.level - 1] || 0)
                return `Lv.${profile.level} | 积分: ${profile.points} | 下一级: ${nextThreshold}分 (进度: ${progress}/${needed}) | 连续正确: ${profile.streak.current} | 最佳连胜: ${profile.streak.best}`
              }
              default:
                return `Error: 未知操作 ${args.action}`
            }
          } catch (e) {
            return `Error: ${e instanceof Error ? e.message : String(e)}`
          }
        },
      }),
    },
  }
}
