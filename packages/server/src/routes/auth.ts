import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { LoginRequestSchema } from '@perf-appraisal-app/shared'
import { verifyLogin } from '../services/auth.service.js'
import { resolveUserFinancialYear } from '../services/financialyear.service.js'

const auth = new Hono().post(
  '/login',
  zValidator('json', LoginRequestSchema),
  async (c) => {
    const { username, password } = c.req.valid('json')

    const user = await verifyLogin(username, password)
    if (!user) {
      return c.json({ error: 'Invalid username or password' }, 401)
    }

    const financialYear = await resolveUserFinancialYear(user.id)
    return c.json({ user, financialYear })
  },
)

export { auth }
