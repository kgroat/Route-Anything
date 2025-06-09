import { routerBuilder } from '@any-router/lambda'

export const userRouter = routerBuilder('/user/:userId')
  .get(async ({ routeResult: { userId } }) => ({
    statusCode: 200,
    body: { userId },
  }))
  .build()
