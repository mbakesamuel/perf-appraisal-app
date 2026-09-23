import type {
  Role,
  RoleCreateInput,
  RoleDefinition,
  RolePermissions,
  RoleScope,
  RoleUpdateInput,
} from '@perf-appraisal-app/shared'
import {
  defaultPermissionsForRole,
  fallbackLabelForRole,
  fallbackScopeForRole,
  isBuiltinRole,
  isRoleScope,
  isValidRoleCode,
  ROLES,
} from '@perf-appraisal-app/shared'
import { Prisma } from '@prisma/client'
import { prisma } from '../db.js'

export class RoleNotFoundError extends Error {
  constructor(message = 'Role not found') {
    super(message)
    this.name = 'RoleNotFoundError'
  }
}

export class RoleValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RoleValidationError'
  }
}

export class RoleConflictError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RoleConflictError'
  }
}

function mapRoleRow(row: {
  code: string
  label: string
  jurisdiction: string
  can_appraisals: boolean
  can_financial_years: boolean
  can_organization: boolean
  can_letter_cc: boolean
  can_decision_matrix: boolean
  can_through_officers: boolean
  can_import_history: boolean
  can_export_history: boolean
  can_users: boolean
  can_roles: boolean
}): RoleDefinition {
  const jurisdiction = isRoleScope(row.jurisdiction)
    ? row.jurisdiction
    : fallbackScopeForRole(row.code)
  return {
    code: row.code,
    label: row.label || fallbackLabelForRole(row.code),
    jurisdiction,
    canAppraisals: row.can_appraisals,
    canFinancialYears: row.can_financial_years,
    canOrganization: row.can_organization,
    canLetterCc: row.can_letter_cc,
    canDecisionMatrix: row.can_decision_matrix,
    canThroughOfficers: row.can_through_officers,
    canImportHistory: row.can_import_history,
    canExportHistory: row.can_export_history,
    canUsers: row.can_users,
    canRoles: row.can_roles,
  }
}

function fallbackDefinition(code: Role): RoleDefinition {
  return {
    code,
    label: fallbackLabelForRole(code),
    jurisdiction: fallbackScopeForRole(code),
    ...defaultPermissionsForRole(code),
  }
}

export async function getRoleDefinition(code: string): Promise<RoleDefinition> {
  const row = await prisma.tbl_roles.findUnique({ where: { code } })
  if (row) return mapRoleRow(row)
  if (isBuiltinRole(code)) return fallbackDefinition(code)
  throw new RoleNotFoundError(`Unknown role: ${code}`)
}

export async function getPermissionsForRole(
  code: string,
): Promise<RolePermissions> {
  const def = await getRoleDefinition(code)
  return {
    canAppraisals: def.canAppraisals,
    canFinancialYears: def.canFinancialYears,
    canOrganization: def.canOrganization,
    canLetterCc: def.canLetterCc,
    canDecisionMatrix: def.canDecisionMatrix,
    canThroughOfficers: def.canThroughOfficers,
    canImportHistory: def.canImportHistory,
    canExportHistory: def.canExportHistory,
    canUsers: def.canUsers,
    canRoles: def.canRoles,
  }
}

export async function getJurisdictionForRole(code: string): Promise<RoleScope> {
  return (await getRoleDefinition(code)).jurisdiction
}

export async function listRoles(): Promise<RoleDefinition[]> {
  const rows = await prisma.tbl_roles.findMany({ orderBy: { code: 'asc' } })
  const byCode = new Map(rows.map((row) => [row.code, mapRoleRow(row)]))

  // Ensure built-in roles always appear even if not yet seeded.
  for (const code of ROLES) {
    if (!byCode.has(code)) {
      byCode.set(code, fallbackDefinition(code))
    }
  }

  return [...byCode.values()].sort((a, b) => a.code.localeCompare(b.code))
}

function assertAdminInvariants(code: string, input: RoleUpdateInput) {
  if (code !== 'ADMINISTRATOR') return
  if (input.jurisdiction !== 'all') {
    throw new RoleValidationError(
      'Administrator jurisdiction must remain "all"',
    )
  }
  if (!input.canRoles) {
    throw new RoleValidationError(
      'Administrator must retain the can_roles permission',
    )
  }
}

export async function createRole(
  input: RoleCreateInput,
): Promise<RoleDefinition> {
  const code = input.code.trim().toUpperCase()
  if (!isValidRoleCode(code)) {
    throw new RoleValidationError(
      'Role code must start with A–Z and contain only A–Z, 0–9, or underscore',
    )
  }
  if (code === 'ADMINISTRATOR') {
    throw new RoleValidationError('Cannot create a duplicate Administrator role')
  }

  assertAdminInvariants(code, input)

  try {
    const row = await prisma.tbl_roles.create({
      data: {
        code,
        label: input.label.trim(),
        jurisdiction: input.jurisdiction,
        can_appraisals: input.canAppraisals,
        can_financial_years: input.canFinancialYears,
        can_organization: input.canOrganization,
        can_letter_cc: input.canLetterCc,
        can_decision_matrix: input.canDecisionMatrix,
        can_through_officers: input.canThroughOfficers,
        can_import_history: input.canImportHistory,
        can_export_history: input.canExportHistory,
        can_users: input.canUsers,
        can_roles: input.canRoles,
      },
    })
    return mapRoleRow(row)
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2002'
    ) {
      throw new RoleConflictError(`Role ${code} already exists`)
    }
    throw err
  }
}

export async function updateRole(
  code: string,
  input: RoleUpdateInput,
): Promise<RoleDefinition> {
  assertAdminInvariants(code, input)

  const existing = await prisma.tbl_roles.findUnique({ where: { code } })
  if (!existing && !isBuiltinRole(code)) {
    throw new RoleNotFoundError(`Unknown role: ${code}`)
  }

  const row = await prisma.tbl_roles.upsert({
    where: { code },
    create: {
      code,
      label: input.label.trim(),
      jurisdiction: input.jurisdiction,
      can_appraisals: input.canAppraisals,
      can_financial_years: input.canFinancialYears,
      can_organization: input.canOrganization,
      can_letter_cc: input.canLetterCc,
      can_decision_matrix: input.canDecisionMatrix,
      can_through_officers: input.canThroughOfficers,
      can_import_history: input.canImportHistory,
      can_export_history: input.canExportHistory,
      can_users: input.canUsers,
      can_roles: input.canRoles,
    },
    update: {
      label: input.label.trim(),
      jurisdiction: input.jurisdiction,
      can_appraisals: input.canAppraisals,
      can_financial_years: input.canFinancialYears,
      can_organization: input.canOrganization,
      can_letter_cc: input.canLetterCc,
      can_decision_matrix: input.canDecisionMatrix,
      can_through_officers: input.canThroughOfficers,
      can_import_history: input.canImportHistory,
      can_export_history: input.canExportHistory,
      can_users: input.canUsers,
      can_roles: input.canRoles,
    },
  })

  return mapRoleRow(row)
}
