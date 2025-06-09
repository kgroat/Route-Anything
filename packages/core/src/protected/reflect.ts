import { CompileOptions } from '../routing.js'

type CompiledMeta = {
  compileOptions: CompileOptions<any>
}

let meta: CompiledMeta | null = null

export function getCompiledMeta() {
  return meta
}

export function setCompiledMeta(newMeta: CompiledMeta) {
  meta = newMeta
}
