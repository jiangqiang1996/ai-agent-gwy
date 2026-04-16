declare module "marked-katex-extension" {
  interface MarkedKatexOptions {
    throwOnError?: boolean
  }

  export default function markedKatex(options?: MarkedKatexOptions): any
}
