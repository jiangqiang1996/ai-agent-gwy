import type { ExamType } from "./types.js"

export const DATA_DIR = "data"
export const USERS_DIR = `${DATA_DIR}/users`
export const ATTEMPTS_DIR = `${DATA_DIR}/attempts`
export const SYSTEM_DIR = `${DATA_DIR}/system`
export const SESSION_POINTERS_DIR = `${SYSTEM_DIR}/sessions`
export const IDENTITY_INDEX_PATH = `${SYSTEM_DIR}/identity-index.json`
export const MIGRATION_MANIFEST_PATH = `${SYSTEM_DIR}/migration-manifest.json`

export const LEVEL_THRESHOLDS = [0, 50, 150, 300, 500, 800, 1200, 1700, 2300, 3000]
export const POINTS_CORRECT = 10
export const POINTS_WRONG = 3

export const XINGCE_SUBJECTS = [
  "言语理解与表达",
  "数量关系",
  "判断推理",
  "资料分析",
  "常识判断",
  "政治理论",
]

export const XINGCE_LEAF_TOPICS: Record<string, string[]> = {
  "言语理解与表达": ["逻辑填空", "片段阅读", "语句表达"],
  "数量关系": ["数学运算"],
  "判断推理": ["图形推理", "定义判断", "类比推理", "逻辑判断"],
  "资料分析": ["资料分析"],
  "常识判断": ["法律", "经济", "科技与生活", "人文与历史", "国情地理", "管理与公文"],
  "政治理论": ["政治理论"],
}

export const EXAM_TYPE_MAP: Record<string, string> = {
  "国考": "guokao",
  guokao: "guokao",
  "省考": "shengkao",
  shengkao: "shengkao",
  "事业单位": "shiyedanwei",
  shiyedanwei: "shiyedanwei",
}

export const EXAM_LABELS: Record<string, string> = {
  guokao: "国考",
  shengkao: "省考",
  shiyedanwei: "事业单位",
}

export const EXAM_CONFIGS: Record<ExamType, {
  subjects: string[]
  weights: Record<string, number>
  difficulty: string
}> = {
  guokao: {
    subjects: ["言语理解与表达", "数量关系", "判断推理", "资料分析", "常识判断", "政治理论"],
    weights: {
      "言语理解与表达": 0.2,
      "数量关系": 0.15,
      "判断推理": 0.2,
      "资料分析": 0.15,
      "常识判断": 0.15,
      "政治理论": 0.15,
    },
    difficulty: "中高",
  },
  shengkao: {
    subjects: ["言语理解与表达", "数量关系", "判断推理", "资料分析", "常识判断"],
    weights: {
      "言语理解与表达": 0.22,
      "数量关系": 0.15,
      "判断推理": 0.22,
      "资料分析": 0.18,
      "常识判断": 0.23,
    },
    difficulty: "中",
  },
  shiyedanwei: {
    subjects: ["言语理解与表达", "数量关系", "判断推理", "资料分析", "常识判断"],
    weights: {
      "言语理解与表达": 0.25,
      "数量关系": 0.1,
      "判断推理": 0.25,
      "资料分析": 0.15,
      "常识判断": 0.25,
    },
    difficulty: "中低",
  },
}

export const REGION_SPECIAL_SUBJECTS: Record<string, Array<{ subject: string; leafTopics: string[] }>> = {
  "广东": [{ subject: "科学推理", leafTopics: ["物理推理", "化学推理", "生物推理"] }],
}

export const REGIONS = [
  "北京", "天津", "上海", "重庆", "河北", "山西", "辽宁", "吉林", "黑龙江",
  "江苏", "浙江", "安徽", "福建", "江西", "山东", "河南", "湖北", "湖南",
  "广东", "海南", "四川", "贵州", "云南", "陕西", "甘肃", "青海", "台湾",
  "内蒙古", "广西", "西藏", "宁夏", "新疆",
]
