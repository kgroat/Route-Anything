import { ZodType } from 'zod'
import { ParsePath, Path } from './path.js'
import {
  HttpMethodNotAllowedError,
  HttpNotFoundError,
  InvalidRequestBodyError,
} from './errors.js'
import { HttpMethod } from './http.js'

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
  bodyValidator: ZodType<TBody>
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

  get(handler: HandlerFn<ParsePath<TRoute>, undefined, TInput, TResult>) {
    this.handlers.GET = { handler }
    return this as RouterBuilderClass<
      TInput,
      TResult,
      TRoute,
      TBodies & { GET: undefined }
    >
  }

  post<TBody>(
    bodyValidator: ZodType<TBody>,
    handler: HandlerFn<ParsePath<TRoute>, TBody, TInput, TResult>,
  ) {
    this.handlers.POST = { bodyValidator, handler }
    return this as RouterBuilderClass<
      TInput,
      TResult,
      TRoute,
      TBodies & { POST: TBody }
    >
  }

  put<TBody>(
    bodyValidator: ZodType<TBody>,
    handler: HandlerFn<ParsePath<TRoute>, TBody, TInput, TResult>,
  ) {
    this.handlers.PUT = { bodyValidator, handler }
    return this as RouterBuilderClass<
      TInput,
      TResult,
      TRoute,
      TBodies & { PUT: TBody }
    >
  }

  delete<TBody>(
    bodyValidator: ZodType<TBody>,
    handler: HandlerFn<ParsePath<TRoute>, TBody, TInput, TResult>,
  ) {
    this.handlers.DELETE = { bodyValidator, handler }
    return this as RouterBuilderClass<
      TInput,
      TResult,
      TRoute,
      TBodies & { DELETE: TBody }
    >
  }

  patch<TBody>(
    bodyValidator: ZodType<TBody>,
    handler: HandlerFn<ParsePath<TRoute>, TBody, TInput, TResult>,
  ) {
    this.handlers.PATCH = { bodyValidator, handler }
    return this as RouterBuilderClass<
      TInput,
      TResult,
      TRoute,
      TBodies & { PATCH: TBody }
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

export const routerBuilder =
  <TInput, TResult>() =>
  <TRoute extends `/${string}`>(route: TRoute) => {
    return new RouterBuilderClass<TInput, TResult, TRoute>(route)
  }

export function compileRouters<TInput, TResult>(
  routers: Router<TInput, TResult>[],
  { pathPrefix }: { pathPrefix?: string } = {},
) {
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
          const bodyParseResult = bodyValidator?.safeParse(body)

          if (bodyParseResult?.error) {
            throw new InvalidRequestBodyError(bodyParseResult.error)
          }

          return handler({
            routeResult,
            body: bodyParseResult?.data,
            input,
          } as HandlerParams<any, any, TInput>)
        }

        throw new HttpMethodNotAllowedError(allowedMethods)
      },
    )
  })

  const mainHandler = async (
    path: string,
    method: HttpMethod,
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

  return mainHandler
}
