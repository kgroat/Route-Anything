import { compileRouters, HttpMethod, routerBuilder } from '@any-router/core'
import { z } from 'zod'
import { IncomingMessage, ServerResponse, createServer } from 'node:http'

import { userRepo } from './repositories'

type HandlerOptions = {
  req: IncomingMessage
  res: ServerResponse
}

// Define your input and output types
const nodeRouterBuilder = routerBuilder<HandlerOptions, void>()

// Define your routers
const userRouter = nodeRouterBuilder('/user/:userId')
  .get(async ({ routeResult: { userId }, input: { res } }) => {
    const user = await userRepo.getUser(userId)
    res.writeHead(200).end(JSON.stringify(user))
  })
  .put(
    z.object({ name: z.string() }),
    async ({ routeResult: { userId }, body: { name }, input: { res } }) => {
      const updated = await userRepo.updateUser(userId, { name })
      res.writeHead(200).end(JSON.stringify(updated))
    },
  )
  .build()

const commentRouter = nodeRouterBuilder('/user/:userId/comment/:commentId')
  // ... handlers for GET, POST, PUT, DELETE, PATCH, etc.
  .build()

// Compile your routers
const handler = compileRouters([userRouter, commentRouter])

// Use your route handler
const server = createServer(async (req, res) => {
  if (!req.url || !req.method) {
    res.writeHead(400)
    res.end(JSON.stringify({ error: 'Bad Request' }))
    return
  }

  try {
    const url = new URL(req.url)
    await handler(url.pathname, req.method as HttpMethod, await getBody(req), {
      req,
      res,
    })

    if (!res.closed) {
      res.end()
    }
  } catch (err: any) {
    if ('statusCode' in err && typeof err.statusCode === 'number') {
      res
        .writeHead(err.statusCode)
        .end(JSON.stringify({ error: err.message, details: err.details }))

      return
    }

    res.writeHead(500).end(JSON.stringify({ error: 'Internal Server Error' }))
    return
  }
})

function getBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let bodyStr = ''

    req.on('data', (chunk) => {
      bodyStr += chunk
    })

    req.on('end', () => {
      try {
        resolve(JSON.parse(bodyStr))
      } catch {
        resolve(bodyStr)
      }
    })

    req.on('error', reject)
  })
}

server.listen(3000, () => {
  console.log('Server listening on port 3000')
})
