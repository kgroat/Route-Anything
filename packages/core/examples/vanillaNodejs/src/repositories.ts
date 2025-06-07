export type User = {
  name: string
}

const users: Record<string, User> = {
  '123': { name: 'John Doe' },
  '456': { name: 'Jane Doe' },
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export const userRepo = {
  getUser: async (userId: string): Promise<User> => {
    await sleep(500)
    return users[userId]
  },
  updateUser: async (userId: string, update: Partial<User>): Promise<User> => {
    await sleep(500)
    return (users[userId] = { ...users[userId], ...update })
  },
}
