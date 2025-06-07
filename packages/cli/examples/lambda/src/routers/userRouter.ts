import { routerBuilder } from '../routerBuilder.js'

export const userRouter = routerBuilder('/user/:userId')
  .get(async ({ routeResult: { userId } }) => ({
    statusCode: 200,
    body: { userId },
  }))
  .build()
