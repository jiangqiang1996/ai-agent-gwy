import { createConvertMdToHtmlTool } from "./tools/convert-md-to-html.js"
import { createExportDocumentTool } from "./tools/export-document.js"
import { createGradingTool } from "./tools/grading.js"
import { createInlineHtmlResourcesTool } from "./tools/inline-html-resources.js"
import { createQuestionGeneratorTool } from "./tools/question-generator.js"
import { createUserProfileTool } from "./tools/user-profile.js"

export function registerCoachingTools() {
  return {
    "user-profile": createUserProfileTool(),
    grading: createGradingTool(),
    "question-generator": createQuestionGeneratorTool(),
    "export-document": createExportDocumentTool(),
    "convert-md-to-html": createConvertMdToHtmlTool(),
    "inline-html-resources": createInlineHtmlResourcesTool(),
  }
}
