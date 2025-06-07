import { randomBytes } from 'node:crypto'

const aCharCode = 'A'.charCodeAt(0)

export function randomName() {
  return Array.from(randomBytes(16))
    .map((b) => {
      const letter = b % 26
      return String.fromCharCode(letter + aCharCode)
    })
    .join('')
}
