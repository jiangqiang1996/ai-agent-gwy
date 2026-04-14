import { type Plugin } from "@opencode-ai/plugin"

import { registerCoachingTools } from "./coaching-tools/register-tools.js"

export const CoachingPlugin: Plugin = async () => {
  return {
    tool: registerCoachingTools(),
  }
}
