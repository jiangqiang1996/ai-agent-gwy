import { createGradingTool } from "./tools/grading.js"
import { createPointsTool } from "./tools/points.js"
import { createQuestionGeneratorTool } from "./tools/question-generator.js"
import { createTimerTool } from "./tools/timer.js"
import { createUserProfileTool } from "./tools/user-profile.js"

export function registerCoachingTools() {
  return {
    "user-profile": createUserProfileTool(),
    timer: createTimerTool(),
    grading: createGradingTool(),
    "question-generator": createQuestionGeneratorTool(),
    points: createPointsTool(),
  }
}
