import { $ZodType, safeParse } from 'zod/v4/core'
import { ZodType } from 'zod/v3'

import { ParsePath, Path } from './path.js'
import {
  HttpMethodNotAllowedError,
  HttpNotFoundError,
  InvalidRequestBodyError,
} from './errors.js'
import { HttpMethod } from './http.js'
import { setCompiledMeta } from './protected/reflect.js'

export type HandlerParams<TRouteResult, TBody, TInput> = {
  input: TInput
} & (TRouteResult extends undefined ? unknown : { routeResult: TRouteResult }) &
  (TBody extends undefined ? unknown : { body: TBody })

export type HandlerFn<TRouteResult, TBody, TInput, TResult> = (
  handler: HandlerParams<TRouteResult, TBody, TInput>,
) => Promise<TResult>

export type RouteHandlerWithoutBody<TRouteResult, TInput, TResult> = {
  bodyValidator?: undefined
  handler: HandlerFn<TRouteResult, undefined, TInput, TResult>
}

export type RouteHandlerWithBody<TRouteResult, TBody, TInput, TResult> = {
  bodyValidator: $ZodType<TBody> | ZodType<TBody>
  handler: HandlerFn<TRouteResult, TBody, TInput, TResult>
}

export type RouteHandler<TRouteResult, TBody, TInput, TResult> =
  | RouteHandlerWithoutBody<TRouteResult, TInput, TResult>
  | RouteHandlerWithBody<TRouteResult, TBody, TInput, TResult>

export type Router<TInput, TResult> = {
  [route: `/${string}`]: {
    [method in HttpMethod]?: RouteHandler<any, any, TInput, TResult>
  }
}

export class RouterBuilderClass<
  TInput,
  TResult,
  TRoute extends `/${string}`,
  TBodies extends Partial<Record<HttpMethod, unknown>> = object,
> {
  readonly route: TRoute
  readonly handlers: {
    [method in HttpMethod]?: RouteHandler<
      ParsePath<TRoute>,
      any,
      TInput,
      TResult
    >
  }

  constructor(route: TRoute) {
    this.route = route
    this.handlers = {}
  }

  get<const OwnResult extends TResult>(
    handler: HandlerFn<ParsePath<TRoute>, undefined, TInput, OwnResult>,
  ) {
    this.handlers.GET = { handler }
    return this as RouterBuilderClass<
      TInput,
      TResult,
      TRoute,
      TBodies & { GET: undefined }
    >
  }

  post<TBody, const OwnResult extends TResult>(
    bodyValidator: $ZodType<TBody> | ZodType<TBody>,
    handler: HandlerFn<ParsePath<TRoute>, TBody, TInput, OwnResult>,
  ) {
    this.handlers.POST = { bodyValidator, handler }
    return this as RouterBuilderClass<
      TInput,
      TResult,
      TRoute,
      TBodies & { POST: TBody }
    >
  }

  put<TBody, const OwnResult extends TResult>(
    bodyValidator: $ZodType<TBody> | ZodType<TBody>,
    handler: HandlerFn<ParsePath<TRoute>, TBody, TInput, OwnResult>,
  ) {
    this.handlers.PUT = { bodyValidator, handler }
    return this as RouterBuilderClass<
      TInput,
      TResult,
      TRoute,
      TBodies & { PUT: TBody }
    >
  }

  delete<TBody, const OwnResult extends TResult>(
    bodyValidator: $ZodType<TBody> | ZodType<TBody>,
    handler: HandlerFn<ParsePath<TRoute>, TBody, TInput, OwnResult>,
  ) {
    this.handlers.DELETE = { bodyValidator, handler }
    return this as RouterBuilderClass<
      TInput,
      TResult,
      TRoute,
      TBodies & { DELETE: TBody }
    >
  }

  patch<TBody, const OwnResult extends TResult>(
    bodyValidator: $ZodType<TBody> | ZodType<TBody>,
    handler: HandlerFn<ParsePath<TRoute>, TBody, TInput, OwnResult>,
  ) {
    this.handlers.PATCH = { bodyValidator, handler }
    return this as RouterBuilderClass<
      TInput,
      TResult,
      TRoute,
      TBodies & { PATCH: TBody }
    >
  }

  http<TMethod extends HttpMethod, TBody, const OwnResult extends TResult>(
    method: TMethod,
    bodyValidator: $ZodType<TBody> | ZodType<TBody>,
    handler: HandlerFn<ParsePath<TRoute>, TBody, TInput, OwnResult>,
  ) {
    this.handlers[method] = { bodyValidator, handler }
    return this as RouterBuilderClass<
      TInput,
      TResult,
      TRoute,
      TBodies & { [method in TMethod]: TBody }
    >
  }

  build() {
    return {
      [this.route]: this.handlers,
    } as {
      [route in TRoute]: {
        [method in keyof TBodies]: RouteHandler<
          ParsePath<TRoute>,
          TBodies[method],
          TInput,
          TResult
        >
      }
    }
  }
}

export const makeRouterBuilder =
  <TInput, TResult>() =>
  <TRoute extends `/${string}`>(route: TRoute) => {
    return new RouterBuilderClass<TInput, TResult, TRoute>(route)
  }

export interface CompileOptions<TResult> {
  pathPrefix?: string
  errorHandler: (err: unknown) => TResult
}

export interface CustomCompileOptions<TResult>
  extends Omit<CompileOptions<TResult>, 'errorHandler'> {
  errorHandler?: CompileOptions<TResult>['errorHandler']
}

export function compileRouters<TInput, TResult>(
  routers: Router<TInput, TResult>[],
  options: CompileOptions<TResult>,
) {
  const { pathPrefix, errorHandler } = options
  type ParsedRouteHandler = (
    method: HttpMethod,
    routeResult: unknown,
    body: unknown,
    input: TInput,
  ) => Promise<TResult>

  const fullRouter: Router<TInput, TResult> = Object.assign({}, ...routers)
  const routeMap = new Map<Path<string>, ParsedRouteHandler>()

  Object.entries(fullRouter).forEach(([pathDef, handlers]) => {
    routeMap.set(
      new Path(pathDef),
      async (
        method: HttpMethod,
        routeResult: any,
        body: unknown,
        input: TInput,
      ) => {
        const allowedMethods = Object.keys(handlers) as HttpMethod[]
        const methodHandler = handlers[method]

        if (methodHandler) {
          const { bodyValidator, handler } = methodHandler
          const bodyParseResult =
            bodyValidator &&
            ('_zod' in bodyValidator
              ? safeParse(bodyValidator, body)
              : bodyValidator.safeParse(body))

          if (bodyParseResult?.error) {
            throw new InvalidRequestBodyError(bodyParseResult.error)
          }

          try {
            return await handler({
              routeResult,
              body: bodyParseResult?.data,
              input,
            } as HandlerParams<any, any, TInput>)
          } catch (err) {
            if (errorHandler) {
              return errorHandler(err)
            }

            throw err
          }
        }

        throw new HttpMethodNotAllowedError(allowedMethods)
      },
    )
  })

  const mainHandler = async (
    path: string,
    method: string,
    body: unknown,
    input: TInput,
  ): Promise<TResult> => {
    if (pathPrefix && !path.startsWith(pathPrefix)) {
      throw new HttpNotFoundError()
    }

    const finalPath = pathPrefix ? path.slice(pathPrefix.length) : path

    for (const [parsedPath, handler] of routeMap.entries()) {
      const routeResult = parsedPath.test(finalPath)

      if (routeResult) {
        return handler(method, routeResult, body, input)
      }
    }

    throw new HttpNotFoundError()
  }

  setCompiledMeta({
    compileOptions: options,
  })

  return mainHandler
}
