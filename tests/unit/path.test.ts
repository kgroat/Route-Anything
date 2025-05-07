import { describe, it, expect } from 'vitest'

import { Path } from 'src/path'

describe('Path', () => {
  it('should allow for literal paths', () => {
    const path = new Path('/user')

    expect(path.test('/user')).toEqual({})
    expect(path.test('/user/')).toEqual(null)
    expect(path.test('/some/other/path')).toEqual(null)
  })

  it('should allow for path parameterss', () => {
    const path = new Path('/user/:userId')

    expect(path.test('/user/123')).toEqual({ userId: '123' })
    expect(path.test('/user/')).toEqual(null)
    expect(path.test('/user')).toEqual(null)
    expect(path.test('/some/other/path')).toEqual(null)
  })

  it('should allow for splat parameterss', () => {
    const path = new Path('/user/*theRest')

    expect(path.test('/user/cool')).toEqual({ theRest: '/cool' })
    expect(path.test('/user/')).toEqual({ theRest: '/' })
    expect(path.test('/user')).toEqual({})
    expect(path.test('/some/other/path')).toEqual(null)
  })

  it('should parse a complex path', () => {
    const path = new Path('/user/:userId/post(/:postId)/and/:the/*rest')

    // With :postId and *rest
    expect(path.test('/user/123/post/456/and/789/rest')).toEqual({
      userId: '123',
      postId: '456',
      the: '789',
      rest: '/rest',
    })

    // Without :postId or *rest
    expect(path.test('/user/123/post/and/456')).toEqual({
      userId: '123',
      the: '456',
    })

    // Incorrect path
    expect(path.test('/some/other/path')).toEqual(null)
  })

  it('should throw if there is no leading "/"', () => {
    expect(() => new Path('user')).toThrow()
  })
})
