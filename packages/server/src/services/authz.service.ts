import type { User } from '@perf-appraisal-app/shared'
import { prisma } from '../db.js'
import { getJurisdictionForRole } from './roles.service.js'

export class ForbiddenError extends Error {
  constructor(message = 'Forbidden') {
    super(message)
    this.name = 'ForbiddenError'
  }
}

export async function requirePermission(
  user: User,
  flag: keyof User['permissions'],
  message = 'You do not have permission for this action',
): Promise<void> {
  if (!user.permissions[flag]) {
    throw new ForbiddenError(message)
  }
}

export type OrgScope =
  | { unrestricted: true }
  | {
      unrestricted: false
      groupId: string | null
      unitIds: string[]
      sectionIds: number[] | null
    }

/**
 * Resolves the organizational records a user may view or manage.
 * Unit- and section-scoped users inherit the group of their assigned record.
 */
export async function orgScopeForUser(user: User): Promise<OrgScope> {
  const jurisdiction = await getJurisdictionForRole(user.role)

  if (jurisdiction === 'all') {
    return { unrestricted: true }
  }

  if (jurisdiction === 'group') {
    if (!user.groupId) {
      return {
        unrestricted: false,
        groupId: null,
        unitIds: [],
        sectionIds: null,
      }
    }
    const units = await prisma.tbl_unit.findMany({
      where: { groupid: user.groupId },
      select: { id: true },
    })
    return {
      unrestricted: false,
      groupId: user.groupId,
      unitIds: units.map((unit) => unit.id),
      sectionIds: null,
    }
  }

  if (jurisdiction === 'unit') {
    if (!user.unitId) {
      return {
        unrestricted: false,
        groupId: null,
        unitIds: [],
        sectionIds: null,
      }
    }
    const unit = await prisma.tbl_unit.findUnique({
      where: { id: user.unitId },
      select: { id: true, groupid: true },
    })
    return {
      unrestricted: false,
      groupId: unit?.groupid ?? null,
      unitIds: unit ? [unit.id] : [],
      sectionIds: null,
    }
  }

  if (user.sectionId == null) {
    return {
      unrestricted: false,
      groupId: null,
      unitIds: [],
      sectionIds: [],
    }
  }
  const section = await prisma.tbl_section.findUnique({
    where: { id: user.sectionId },
    select: { id: true, tbl_unit_id: true },
  })
  if (!section?.tbl_unit_id) {
    return {
      unrestricted: false,
      groupId: null,
      unitIds: [],
      sectionIds: [],
    }
  }
  const unit = await prisma.tbl_unit.findUnique({
    where: { id: section.tbl_unit_id },
    select: { id: true, groupid: true },
  })
  return {
    unrestricted: false,
    groupId: unit?.groupid ?? null,
    unitIds: unit ? [unit.id] : [],
    sectionIds: [section.id],
  }
}

/**
 * Returns numeric section ids the user may oversee, or null when unrestricted.
 */
export async function sectionIdsForUser(
  user: User,
): Promise<number[] | null> {
  const scope = await getJurisdictionForRole(user.role)

  if (scope === 'all') {
    return null
  }

  if (scope === 'section') {
    return user.sectionId != null ? [user.sectionId] : []
  }

  if (scope === 'unit') {
    if (!user.unitId) return []
    const rows = await prisma.tbl_section.findMany({
      where: { tbl_unit_id: user.unitId },
      select: { id: true },
    })
    return rows.map((r) => r.id)
  }

  if (scope === 'group') {
    if (!user.groupId) return []
    const units = await prisma.tbl_unit.findMany({
      where: { groupid: user.groupId },
      select: { id: true },
    })
    const unitIds = units.map((u) => u.id)
    if (unitIds.length === 0) return []
    const rows = await prisma.tbl_section.findMany({
      where: { tbl_unit_id: { in: unitIds } },
      select: { id: true },
    })
    return rows.map((r) => r.id)
  }

  return []
}

export async function assertEmployeeInScope(
  user: User,
  matric: string,
): Promise<void> {
  const allowed = await sectionIdsForUser(user)
  if (allowed === null) return

  if (allowed.length === 0) {
    throw new ForbiddenError('No organizational scope assigned')
  }

  const assignment = await prisma.tbl_personel_section.findFirst({
    where: { matric },
    orderBy: { effdate: 'desc' },
  })

  const assignedSectionId = assignment?.tbl_section_id
  if (
    assignedSectionId == null ||
    assignedSectionId === '' ||
    assignedSectionId === '0'
  ) {
    throw new ForbiddenError('Employee is outside your oversight scope')
  }

  const assignedNumeric = Number(assignedSectionId)
  if (
    !Number.isInteger(assignedNumeric) ||
    !allowed.includes(assignedNumeric)
  ) {
    throw new ForbiddenError('Employee is outside your oversight scope')
  }
}

export async function unitIdsForUser(user: User): Promise<string[] | null> {
  const scope = await getJurisdictionForRole(user.role)
  if (scope === 'all') return null

  if (scope === 'unit') {
    return user.unitId ? [user.unitId] : []
  }
  if (scope === 'group') {
    if (!user.groupId) return []
    const units = await prisma.tbl_unit.findMany({
      where: { groupid: user.groupId },
      select: { id: true },
    })
    return units.map((u) => u.id)
  }
  if (scope === 'section') {
    if (user.sectionId == null) return []
    const section = await prisma.tbl_section.findUnique({
      where: { id: user.sectionId },
      select: { tbl_unit_id: true },
    })
    return section?.tbl_unit_id ? [section.tbl_unit_id] : []
  }
  return []
}

export function roleCodeOrFallback(role: string) {
  return role
}

const SCOPE_RANK: Record<
  Awaited<ReturnType<typeof getJurisdictionForRole>>,
  number
> = {
  section: 1,
  unit: 2,
  group: 3,
  all: 4,
}

/**
 * Whether a managed user account falls inside the actor's organizational
 * jurisdiction (group includes that group's units and sections).
 */
export async function isUserRecordInScope(
  actor: User,
  target: User,
): Promise<boolean> {
  const scope = await orgScopeForUser(actor)
  if (scope.unrestricted) return true

  if (target.jurisdiction === 'all') return false

  const actorJurisdiction = await getJurisdictionForRole(actor.role)
  if (SCOPE_RANK[target.jurisdiction] > SCOPE_RANK[actorJurisdiction]) {
    return false
  }

  if (target.jurisdiction === 'group') {
    return (
      target.groupId != null &&
      scope.groupId != null &&
      target.groupId === scope.groupId
    )
  }

  if (target.jurisdiction === 'unit') {
    return (
      target.unitId != null && scope.unitIds.includes(target.unitId)
    )
  }

  if (target.jurisdiction === 'section') {
    if (target.sectionId == null) return false
    if (scope.sectionIds !== null) {
      return scope.sectionIds.includes(target.sectionId)
    }
    const section = await prisma.tbl_section.findUnique({
      where: { id: target.sectionId },
      select: { tbl_unit_id: true },
    })
    return (
      section?.tbl_unit_id != null &&
      scope.unitIds.includes(section.tbl_unit_id)
    )
  }

  return false
}

export async function assertUserRecordInScope(
  actor: User,
  target: User,
  message = 'User is outside your oversight scope',
): Promise<void> {
  if (!(await isUserRecordInScope(actor, target))) {
    throw new ForbiddenError(message)
  }
}

/**
 * Ensures a create/update payload would place the user inside the actor's
 * jurisdiction and not assign a wider role than the actor holds.
 */
export async function assertUserAssignmentInScope(
  actor: User,
  assignment: {
    role: string
    groupId: string | null
    unitId: string | null
    sectionId: number | null
  },
): Promise<void> {
  const targetJurisdiction = await getJurisdictionForRole(assignment.role)
  const actorJurisdiction = await getJurisdictionForRole(actor.role)
  const scope = await orgScopeForUser(actor)

  if (!scope.unrestricted) {
    if (targetJurisdiction === 'all') {
      throw new ForbiddenError(
        'You cannot create or assign unrestricted (all) users',
      )
    }
    if (SCOPE_RANK[targetJurisdiction] > SCOPE_RANK[actorJurisdiction]) {
      throw new ForbiddenError(
        'You cannot assign a role with wider jurisdiction than your own',
      )
    }
  }

  const synthetic: User = {
    id: 0,
    username: null,
    role: assignment.role,
    groupId: assignment.groupId,
    unitId: assignment.unitId,
    sectionId: assignment.sectionId,
    financialYearId: null,
    permissions: {
      canAppraisals: false,
      canFinancialYears: false,
      canOrganization: false,
      canLetterCc: false,
      canDecisionMatrix: false,
      canThroughOfficers: false,
      canImportHistory: false,
      canExportHistory: false,
      canUsers: false,
      canRoles: false,
    },
    jurisdiction: targetJurisdiction,
  }

  await assertUserRecordInScope(
    actor,
    synthetic,
    'The selected organizational scope is outside your oversight',
  )
}
