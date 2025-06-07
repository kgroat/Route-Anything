# @any-router/core

A powerful but minimal router

##

### Installation

```bash
npm install @any-router/core
```

### Example

```ts
import { compileRouters, routerBuilder } from '@any-router/core'
import { z } from 'zod'
import { IncomingMessage, createServer } from 'node:http'

import { userRepo, commentRepo } from './repositories'

type RouteResult = {
  statusCode: number
  body: unknown
}

// Define your request and response types
const nodeRouterBuilder = routerBuilder<IncomingMessage, RouteResult>()

// Define your routers
const userRouter = nodeRouterBuilder('/user/:userId')
  .get(async ({ routeResult: { userId } }) => ({
    statusCode: 200,
    body: await userRepo.getUser(userId),
  }))
  .put(
    z.object({ name: z.string() }),
    async ({ routeResult: { userId }, body: { name } }) => ({
      statusCode: 200,
      body: await userRepo.updateUser(userId, name),
    }),
  )
  .build()

const commentRouter = nodeRouterBuilder('/user/:userId/comment/:commentId')
  // ... handlers for GET, POST, PUT, DELETE, or PATCH
  .build()

// Compile your routers
const handler = compileRouters([userRouter, commentRouter])

// Use your route handler
const server = createServer(async (req, res) => {
  const result = handler('/user/123/comment/456', 'GET', getBody(req), req)

  res.writeHead(result.statusCode)
  res.end(JSON.stringify(result.body))
})

function getBody(req: IncomingMessage): unknown {
  // ... Parse the body of the request
}
```
