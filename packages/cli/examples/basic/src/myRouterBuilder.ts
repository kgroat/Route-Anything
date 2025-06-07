import { routerBuilder as foo } from '@any-router/core'

export type ResponseType<T = unknown> = {
  code: number
  body: T
}

export const myRouterBuilder = foo<string, ResponseType>()

export default foo<string, ResponseType>()

export const boopPath = '/foo/bar/:userId'
