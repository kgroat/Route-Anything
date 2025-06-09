import '@any-router/openapi'
import { userRouter } from './routers/userRouter.js'
import { compileLambdaRouters } from '@any-router/lambda'

export const handler = compileLambdaRouters([userRouter], {
  openapi: {
    info: {
      title: 'Example API Gateway Lambda',
      version: '1.0.0',
    },
  },
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
