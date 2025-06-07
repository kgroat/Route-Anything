import type { Equal, Expect } from '@type-challenges/utils'

import type { ParsePath } from 'src/path'

type cases = [
  Expect<Equal<ParsePath<''>, undefined>>,
  Expect<Equal<ParsePath<'/user'>, undefined>>,
  Expect<Equal<ParsePath<'/user/:userId'>, Readonly<{ userId: string }>>>,
  Expect<
    Equal<
      ParsePath<'/user/:userId/post(/:postId)'>,
      Readonly<{ userId: string; postId?: string }>
    >
  >,
  Expect<
    Equal<
      ParsePath<'/user/:userId/post(/:postId)/and/:the/*rest'>,
      Readonly<{ userId: string; postId?: string; the: string; rest?: string }>
    >
  >,
]
