import { type Plugin, tool } from "@opencode-ai/plugin"
import { readFileSync, writeFileSync, mkdirSync, existsSync, renameSync } from "fs"
import { join, dirname } from "path"

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
}

function createUserProfile(name: string): UserProfile {
  return {
    name,
    createdAt: new Date().toISOString(),
    points: 0,
    level: 1,
    streak: { current: 0, best: 0 },
    mastery: {},
    history: [],
  }
}

function getProfilePath(worktree: string, username: string): string {
  return join(worktree, USERS_DIR, `${username}.json`)
}

function atomicWrite(filePath: string, data: string): void {
  const dir = dirname(filePath)
  mkdirSync(dir, { recursive: true })
  const tmp = `${filePath}.tmp`
  writeFileSync(tmp, data, "utf-8")
  renameSync(tmp, filePath)
}

function loadProfile(worktree: string, username: string): UserProfile | null {
  const p = getProfilePath(worktree, username)
  if (!existsSync(p)) return null
  try {
    return JSON.parse(readFileSync(p, "utf-8"))
  } catch {
    return null
  }
}

function saveProfile(worktree: string, profile: UserProfile): void {
  atomicWrite(getProfilePath(worktree, profile.name), JSON.stringify(profile, null, 2))
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
        description: "用户档案管理。操作: loadOrCreate(加载或创建用户), getStats(获取学习统计), updateMastery(更新答题记录)。每次调用必须传 username 参数。",
        args: {
          action: tool.schema.enum(["loadOrCreate", "getStats", "updateMastery"]).describe("操作类型"),
          username: tool.schema.string().describe("用户名"),
          subject: tool.schema.string().optional().describe("科目 (updateMastery 时必填)"),
          leafTopic: tool.schema.string().optional().describe("叶子题型 (updateMastery 时可选)"),
          correct: tool.schema.boolean().optional().describe("是否正确 (updateMastery 时必填)"),
          timeSeconds: tool.schema.number().optional().describe("答题耗时秒数 (updateMastery 时必填)"),
        },
        async execute(args, context) {
          try {
            const worktree = context.worktree
            switch (args.action) {
              case "loadOrCreate": {
                let profile = loadProfile(worktree, args.username)
                if (!profile) {
                  profile = createUserProfile(args.username)
                  saveProfile(worktree, profile)
                  return `新用户 ${args.username} 创建成功。积分: 0, 等级: 1`
                }
                const totalQ = profile.history.length
                const totalCorrect = profile.history.filter(h => h.correct).length
                const accuracy = totalQ > 0 ? Math.round((totalCorrect / totalQ) * 100) : 0
                return `欢迎回来，${args.username}！等级: Lv.${profile.level}, 积分: ${profile.points}, 已答题: ${totalQ}题, 正确率: ${accuracy}%, 连续正确: ${profile.streak.current}题`
              }
              case "getStats": {
                const profile = loadProfile(worktree, args.username)
                if (!profile) return `Error: 用户 ${args.username} 不存在`
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
                return lines.join("\n")
              }
              case "updateMastery": {
                if (!args.subject || args.correct === undefined || !args.timeSeconds) {
                  return "Error: updateMastery 需要 subject, correct, timeSeconds 参数"
                }
                const profile = loadProfile(worktree, args.username)
                if (!profile) return `Error: 用户 ${args.username} 不存在`
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
        description: "出题工具。根据科目选择题型，生成出题提示模板供编排器发送给老师代理。支持指定科目或随机出题。冷启动用户(无答题记录)自动随机选择科目。",
        args: {
          subject: tool.schema.string().optional().describe("科目名称 (可选, 不填则根据用户画像选择薄弱项或随机)"),
          username: tool.schema.string().describe("用户名 (用于查询学习画像)"),
          leafTopic: tool.schema.string().optional().describe("叶子题型 (可选)"),
        },
        async execute(args, context) {
          try {
            const worktree = context.worktree
            let selectedSubject = args.subject
            let selectedLeaf = args.leafTopic

            if (!selectedSubject) {
              const profile = loadProfile(worktree, args.username)
              if (profile && Object.keys(profile.mastery).length > 0) {
                let worstAcc = 100
                let worstSubj = XINGCE_SUBJECTS[0]
                for (const subj of XINGCE_SUBJECTS) {
                  const m = profile.mastery[subj]
                  if (m && m.total >= 5) {
                    const acc = (m.correct / m.total) * 100
                    if (acc < worstAcc) {
                      worstAcc = acc
                      worstSubj = subj
                    }
                  } else if (!m) {
                    worstSubj = subj
                    break
                  }
                }
                selectedSubject = worstSubj
              } else {
                const idx = Math.floor(Math.random() * XINGCE_SUBJECTS.length)
                selectedSubject = XINGCE_SUBJECTS[idx]
              }
            }

            if (!XINGCE_SUBJECTS.includes(selectedSubject)) {
              return `Error: 未知科目 "${selectedSubject}"。可选: ${XINGCE_SUBJECTS.join(", ")}`
            }

            if (!selectedLeaf) {
              const leaves = XINGCE_LEAF_TOPICS[selectedSubject]
              if (leaves && leaves.length > 0) {
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
            const profile = loadProfile(worktree, args.username)
            if (!profile) return `Error: 用户 ${args.username} 不存在`

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
