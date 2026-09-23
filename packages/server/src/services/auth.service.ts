import bcrypt from 'bcryptjs'
import type { User } from '@perf-appraisal-app/shared'
import { prisma } from '../db.js'
import { mapDbUser } from './user-mapper.js'

const BCRYPT_ROUNDS = 12
const BCRYPT_PREFIX = /^\$2[aby]\$/

function isBcryptHash(value: string): boolean {
  return BCRYPT_PREFIX.test(value)
}

/**
 * Validates credentials against tbl_users and returns the user without the
 * password field, or null when the credentials don't match.
 *
 * Legacy plaintext passwords are accepted once, then upgraded to a bcrypt hash
 * on successful login so the database migrates itself.
 */
export async function verifyLogin(
  username: string,
  password: string,
): Promise<User | null> {
  const user = await prisma.tbl_users.findFirst({
    where: { username },
  })

  if (!user?.password) {
    return null
  }

  let valid = false

  if (isBcryptHash(user.password)) {
    valid = await bcrypt.compare(password, user.password)
  } else if (user.password === password) {
    valid = true
    const hashed = await bcrypt.hash(password, BCRYPT_ROUNDS)
    await prisma.tbl_users.update({
      where: { id: user.id },
      data: { password: hashed },
    })
  }

  if (!valid) {
    return null
  }

  return mapDbUser(user)
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS)
}
