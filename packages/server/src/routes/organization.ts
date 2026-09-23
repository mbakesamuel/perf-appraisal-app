import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import {
  GroupUpsertSchema,
  SectionUpsertSchema,
  UnitUpsertSchema,
} from '@perf-appraisal-app/shared'
import { z } from 'zod'
import type { AppVariables } from '../middleware/current-user.js'
import {
  ForbiddenError,
  orgScopeForUser,
  requirePermission,
  type OrgScope,
} from '../services/authz.service.js'
import {
  createGroup,
  createSection,
  createUnit,
  deleteGroup,
  deleteSection,
  deleteUnit,
  listGroups,
  listOrgSections,
  listOrgUnits,
  OrgConflictError,
  OrgNotFoundError,
  updateGroup,
  updateSection,
  updateUnit,
} from '../services/org.service.js'

function mapOrgError(err: unknown) {
  if (err instanceof ForbiddenError) return { status: 403 as const, message: err.message }
  if (err instanceof OrgNotFoundError) return { status: 404 as const, message: err.message }
  if (err instanceof OrgConflictError) return { status: 409 as const, message: err.message }
  return null
}

function assertGroupInScope(scope: OrgScope, groupId: string): void {
  if (!scope.unrestricted && scope.groupId !== groupId) {
    throw new ForbiddenError('Group is outside your organizational scope')
  }
}

function assertUnitInScope(scope: OrgScope, unitId: string): void {
  if (!scope.unrestricted && !scope.unitIds.includes(unitId)) {
    throw new ForbiddenError('Unit is outside your organizational scope')
  }
}

async function assertSectionInScope(
  scope: OrgScope,
  sectionId: number,
): Promise<void> {
  if (scope.unrestricted) return
  const section = (await listOrgSections()).find((row) => row.id === sectionId)
  if (
    !section?.unitId ||
    !scope.unitIds.includes(section.unitId) ||
    (scope.sectionIds !== null && !scope.sectionIds.includes(sectionId))
  ) {
    throw new ForbiddenError('Section is outside your organizational scope')
  }
}

const organization = new Hono<{ Variables: AppVariables }>()
  .use('*', async (c, next) => {
    const user = c.get('currentUser')
    const isWrite = c.req.method !== 'GET'
    try {
      if (isWrite) {
        await requirePermission(user, 'canOrganization')
      } else if (
        !user.permissions.canOrganization &&
        !user.permissions.canLetterCc &&
        !user.permissions.canDecisionMatrix &&
        !user.permissions.canThroughOfficers &&
        !user.permissions.canUsers &&
        !user.permissions.canRoles
      ) {
        throw new ForbiddenError('You do not have permission for this action')
      }
    } catch (err) {
      if (err instanceof ForbiddenError) {
        return c.json({ error: err.message }, 403)
      }
      throw err
    }
    await next()
  })
  .get('/groups', async (c) => {
    const scope = await orgScopeForUser(c.get('currentUser'))
    const groups = await listGroups()
    return c.json(
      scope.unrestricted
        ? groups
        : groups.filter((group) => group.id === scope.groupId),
    )
  })
  .post('/groups', zValidator('json', GroupUpsertSchema), async (c) => {
    try {
      const scope = await orgScopeForUser(c.get('currentUser'))
      if (!scope.unrestricted) {
        throw new ForbiddenError(
          'Only unrestricted users can create groups',
        )
      }
      return c.json(await createGroup(c.req.valid('json')), 201)
    } catch (err) {
      const mapped = mapOrgError(err)
      if (mapped) return c.json({ error: mapped.message }, mapped.status)
      throw err
    }
  })
  .put(
    '/groups/:id',
    zValidator('param', z.object({ id: z.string().min(1) })),
    zValidator('json', GroupUpsertSchema),
    async (c) => {
      try {
        const scope = await orgScopeForUser(c.get('currentUser'))
        const { id } = c.req.valid('param')
        const input = c.req.valid('json')
        assertGroupInScope(scope, id)
        if (!scope.unrestricted && input.id !== id) {
          throw new ForbiddenError(
            'Scoped users cannot change a group ID',
          )
        }
        return c.json(await updateGroup(id, input))
      } catch (err) {
        const mapped = mapOrgError(err)
        if (mapped) return c.json({ error: mapped.message }, mapped.status)
        throw err
      }
    },
  )
  .delete(
    '/groups/:id',
    zValidator('param', z.object({ id: z.string().min(1) })),
    async (c) => {
      try {
        const scope = await orgScopeForUser(c.get('currentUser'))
        if (!scope.unrestricted) {
          throw new ForbiddenError(
            'Only unrestricted users can delete groups',
          )
        }
        await deleteGroup(c.req.valid('param').id)
        return c.json({ ok: true })
      } catch (err) {
        const mapped = mapOrgError(err)
        if (mapped) return c.json({ error: mapped.message }, mapped.status)
        throw err
      }
    },
  )
  .get('/units', async (c) => {
    const scope = await orgScopeForUser(c.get('currentUser'))
    const units = await listOrgUnits()
    return c.json(
      scope.unrestricted
        ? units
        : units.filter((unit) => scope.unitIds.includes(unit.id)),
    )
  })
  .post('/units', zValidator('json', UnitUpsertSchema), async (c) => {
    try {
      const scope = await orgScopeForUser(c.get('currentUser'))
      const input = c.req.valid('json')
      assertGroupInScope(scope, input.groupId)
      return c.json(await createUnit(input), 201)
    } catch (err) {
      const mapped = mapOrgError(err)
      if (mapped) return c.json({ error: mapped.message }, mapped.status)
      throw err
    }
  })
  .put(
    '/units/:id',
    zValidator('param', z.object({ id: z.string().min(1) })),
    zValidator('json', UnitUpsertSchema),
    async (c) => {
      try {
        const scope = await orgScopeForUser(c.get('currentUser'))
        const { id } = c.req.valid('param')
        const input = c.req.valid('json')
        assertUnitInScope(scope, id)
        assertGroupInScope(scope, input.groupId)
        if (!scope.unrestricted && input.id !== id) {
          throw new ForbiddenError(
            'Scoped users cannot change a unit ID',
          )
        }
        return c.json(await updateUnit(id, input))
      } catch (err) {
        const mapped = mapOrgError(err)
        if (mapped) return c.json({ error: mapped.message }, mapped.status)
        throw err
      }
    },
  )
  .delete(
    '/units/:id',
    zValidator('param', z.object({ id: z.string().min(1) })),
    async (c) => {
      try {
        const scope = await orgScopeForUser(c.get('currentUser'))
        const { id } = c.req.valid('param')
        assertUnitInScope(scope, id)
        await deleteUnit(id)
        return c.json({ ok: true })
      } catch (err) {
        const mapped = mapOrgError(err)
        if (mapped) return c.json({ error: mapped.message }, mapped.status)
        throw err
      }
    },
  )
  .get(
    '/sections',
    zValidator('query', z.object({ unitId: z.string().min(1).max(3).optional() })),
    async (c) => {
      const { unitId } = c.req.valid('query')
      const scope = await orgScopeForUser(c.get('currentUser'))
      if (!scope.unrestricted && unitId && !scope.unitIds.includes(unitId)) {
        return c.json([])
      }
      const sections = await listOrgSections(unitId)
      return c.json(
        scope.unrestricted
          ? sections
          : sections.filter(
              (section) =>
                section.unitId != null &&
                scope.unitIds.includes(section.unitId) &&
                (scope.sectionIds === null ||
                  scope.sectionIds.includes(section.id)),
            ),
      )
    },
  )
  .post('/sections', zValidator('json', SectionUpsertSchema), async (c) => {
    try {
      const scope = await orgScopeForUser(c.get('currentUser'))
      const input = c.req.valid('json')
      if (!input.unitId) {
        if (!scope.unrestricted) {
          throw new ForbiddenError(
            'Scoped sections must belong to an allowed unit',
          )
        }
      } else {
        assertUnitInScope(scope, input.unitId)
      }
      return c.json(await createSection(input), 201)
    } catch (err) {
      const mapped = mapOrgError(err)
      if (mapped) return c.json({ error: mapped.message }, mapped.status)
      throw err
    }
  })
  .put(
    '/sections/:id',
    zValidator('param', z.object({ id: z.coerce.number().int() })),
    zValidator('json', SectionUpsertSchema),
    async (c) => {
      try {
        const scope = await orgScopeForUser(c.get('currentUser'))
        const { id } = c.req.valid('param')
        const input = c.req.valid('json')
        await assertSectionInScope(scope, id)
        if (!input.unitId) {
          if (!scope.unrestricted) {
            throw new ForbiddenError(
              'Scoped sections must belong to an allowed unit',
            )
          }
        } else {
          assertUnitInScope(scope, input.unitId)
        }
        return c.json(await updateSection(id, input))
      } catch (err) {
        const mapped = mapOrgError(err)
        if (mapped) return c.json({ error: mapped.message }, mapped.status)
        throw err
      }
    },
  )
  .delete(
    '/sections/:id',
    zValidator('param', z.object({ id: z.coerce.number().int() })),
    async (c) => {
      try {
        const scope = await orgScopeForUser(c.get('currentUser'))
        const { id } = c.req.valid('param')
        await assertSectionInScope(scope, id)
        await deleteSection(id)
        return c.json({ ok: true })
      } catch (err) {
        const mapped = mapOrgError(err)
        if (mapped) return c.json({ error: mapped.message }, mapped.status)
        throw err
      }
    },
  )

export { organization }
