import { compileRouters } from '@any-router/core'
import { userRouter } from './routers/userRouter.js'
import {
  APIGatewayProxyEvent,
  APIGatewayProxyEventV2,
  APIGatewayProxyResult,
} from 'aws-lambda'

const routerHandler = compileRouters([userRouter], {
  errorHandler: (err: any) => {
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
  },
})

export const handler = async (
  event: APIGatewayProxyEvent | APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResult> => {
  const path = 'path' in event ? event.path : event.rawPath

  const method =
    'httpMethod' in event ? event.httpMethod : event.requestContext.http.method

  const bodyStr =
    event.isBase64Encoded && event.body
      ? Buffer.from(event.body, 'base64').toString('utf-8')
      : event.body

  const body = bodyStr ? JSON.parse(bodyStr) : undefined

  const { body: resultBody, ...result } = await routerHandler(
    path,
    method,
    body,
    event,
  )

  return {
    ...result,
    body: JSON.stringify(resultBody),
  }
}
