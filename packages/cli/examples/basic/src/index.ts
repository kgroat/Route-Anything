import { compileRouters } from '@any-router/core'
import bop, {
  myRouterBuilder as boop,
  boopPath,
  ResponseType,
} from './myRouterBuilder'

const bopRouter = bop('/doot/:userId')
  .get(async function getBop({
    routeResult: { userId },
  }): Promise<ResponseType<string>> {
    return {
      code: 200,
      body: `User ${userId}`,
    }
  })
  .build()

// const boopPath = '/user/:userId'

const getBoop = async function boopHandler({ routeResult: { userId } }) {
  return {
    code: 200,
    body: { userId },
  } as ResponseType<{ userId: string }>
}

const boopRouter = boop(boopPath).get(getBoop).build()

function getCallPath<TStart extends string>(start: TStart) {
  return `${start}/:userId` as const
}

const callRouter = boop(getCallPath('/foo'))
  .get(async ({ routeResult: { userId } }) => {
    const bod = {
      /**
       * body nope
       * @deprecated
       */
      body: 'Nope!',
    }

    function getResult() {
      return {
        code: 200,
        /**
         * body foo
         * @example { "message": "foo" }
         * @see https://foo.bar
         */
        get body() {
          return {
            /**
             * message foo
             * @see https://foo.bar
             */
            get message() {
              return `User ${userId}`
            },
          }
        },
      }
    }

    if (userId === '123') {
      return getResult()
    }

    return {
      get code() {
        return 404
      },
      /**
       * BOD
       */
      ...bod,
    }
  })
  .build()

export const handler = compileRouters([bopRouter, boopRouter, callRouter])
