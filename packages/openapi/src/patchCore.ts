import '@any-router/core/routing'

declare module '@any-router/core/routing' {
  export interface CompileOptions<TResult> {
    openapi: {
      info: import('openapi-types').OpenAPIV3_1.InfoObject
      servers?: import('openapi-types').OpenAPIV3_1.ServerObject[]
      components?: import('openapi-types').OpenAPIV3_1.ComponentsObject
    }
  }
}
