import { Hono } from 'hono'
import { authMiddleware } from './middleware/auth.js'
import { corsMiddleware } from './middleware/cors.js'
import {
  currentUserMiddleware,
  type AppVariables,
} from './middleware/current-user.js'
import { appraisals } from './routes/appraisals.js'
import { auth } from './routes/auth.js'
import { decisionLevels } from './routes/decision-levels.js'
import { financialYears } from './routes/financial-years.js'
import { health } from './routes/health.js'
import { letterCc } from './routes/letter-cc.js'
import { organization } from './routes/organization.js'
import { reports } from './routes/reports.js'
import { roles } from './routes/roles.js'
import { sectionThro } from './routes/section-thro.js'
import { users } from './routes/users.js'

const app = new Hono<{ Variables: AppVariables }>()
  .use('*', corsMiddleware)
  .use('*', authMiddleware)
  .use('*', currentUserMiddleware)
  .route('/health', health)
  .route('/auth', auth)
  .route('/users', users)
  .route('/roles', roles)
  .route('/financial-years', financialYears)
  .route('/organization', organization)
  .route('/letter-cc', letterCc)
  .route('/decision-levels', decisionLevels)
  .route('/section-thro', sectionThro)
  .route('/appraisals', appraisals)
  .route('/reports', reports)

export type AppType = typeof app
export { app }
