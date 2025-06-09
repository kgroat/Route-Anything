import {
  compileRouters,
  CustomCompileOptions,
  makeRouterBuilder,
  Router,
} from '@any-router/core'

import type {
  APIGatewayProxyEvent,
  APIGatewayProxyEventV2,
  APIGatewayProxyResult,
  Context,
} from 'aws-lambda'

export type HttpEvent = APIGatewayProxyEvent | APIGatewayProxyEventV2
export type HttpResult<TCode extends number, T = unknown> = Omit<
  APIGatewayProxyResult,
  'body'
> & {
  statusCode: TCode
  body: T
}

export const routerBuilder = makeRouterBuilder<HttpEvent, HttpResult<number>>()

export interface LambdaCompileOptions<TInput>
  extends CustomCompileOptions<HttpResult<number>> {
  mapper?: (event: HttpEvent, context: Context) => TInput
}

type LambdaError = {
  error: string
  details?: unknown
}

const identity = <T>(t: T) => t

const defaultErrorHandler = (err: any): HttpResult<number, LambdaError> => {
  if ('statusCode' in err && typeof err.statusCode === 'number') {
    return {
      statusCode: err.statusCode,
      body: {
        error: err.message,
        details: err.details ?? undefined,
      },
    }
  }

  return { statusCode: 500, body: { error: 'Internal Server Error' } }
}

export function compileLambdaRouters<TInput = HttpEvent>(
  routers: Router<TInput, HttpResult<number>>[],
  options: LambdaCompileOptions<TInput>,
) {
  const mapper = options.mapper ?? identity

  const baseHandler = compileRouters(routers, {
    errorHandler: defaultErrorHandler,
    ...options,
  })

  return async (
    event: HttpEvent,
    context: any,
  ): Promise<HttpResult<number>> => {
    const input = mapper(event, context) as TInput
    const path = 'path' in event ? event.path : event.rawPath

    const method =
      'httpMethod' in event
        ? event.httpMethod
        : event.requestContext.http.method

    const bodyStr =
      event.isBase64Encoded && event.body
        ? Buffer.from(event.body, 'base64').toString('utf-8')
        : event.body

    const body = bodyStr ? JSON.parse(bodyStr) : undefined

    const { body: resultBody, ...result } = await baseHandler(
      path,
      method,
      body,
      input,
    )

    return {
      ...result,
      body: JSON.stringify(resultBody),
    }
  }
}
