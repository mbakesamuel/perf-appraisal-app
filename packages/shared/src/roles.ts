/** Built-in roles seeded into the database. Custom roles may use any valid code. */
export const ROLES = [
  'SECRETARY',
  'FIELD_ASSISTANT',
  'ADMIN_ASSISTANT',
  'HR_OFFICER',
  'HR_MANAGER',
  'HR_DIRECTOR',
  'ADMINISTRATOR',
] as const

/** Role code stored on users / tbl_roles (built-in or custom). */
export type Role = string

export type BuiltinRole = (typeof ROLES)[number]

export type RoleScope = 'section' | 'unit' | 'group' | 'all'

export const ROLE_SCOPES = ['section', 'unit', 'group', 'all'] as const

/** Fallback labels when DB role config is unavailable. */
export const ROLE_LABELS: Record<BuiltinRole, string> = {
  SECRETARY: 'Secretary',
  FIELD_ASSISTANT: 'Field Assistant',
  ADMIN_ASSISTANT: 'Administrative Assistant',
  HR_OFFICER: 'Human Resource Officer',
  HR_MANAGER: "Manager Human Resources Dev't Services",
  HR_DIRECTOR: 'Director Human Resources',
  ADMINISTRATOR: 'Administrator',
}

/** Fallback jurisdiction when DB role config is unavailable. */
export const ROLE_SCOPE: Record<BuiltinRole, RoleScope> = {
  SECRETARY: 'section',
  FIELD_ASSISTANT: 'section',
  ADMIN_ASSISTANT: 'section',
  HR_OFFICER: 'unit',
  HR_MANAGER: 'group',
  HR_DIRECTOR: 'group',
  ADMINISTRATOR: 'all',
}

export type RolePermissions = {
  canAppraisals: boolean
  canFinancialYears: boolean
  canOrganization: boolean
  canLetterCc: boolean
  canDecisionMatrix: boolean
  canThroughOfficers: boolean
  canImportHistory: boolean
  canExportHistory: boolean
  canUsers: boolean
  canRoles: boolean
}

export type RoleDefinition = {
  code: Role
  label: string
  jurisdiction: RoleScope
} & RolePermissions

/** Uppercase letter, then letters/digits/underscores; max 30 chars. */
const ROLE_CODE_PATTERN = /^[A-Z][A-Z0-9_]{0,29}$/

export function isValidRoleCode(value: string): boolean {
  return ROLE_CODE_PATTERN.test(value)
}

export function isBuiltinRole(value: string): value is BuiltinRole {
  return (ROLES as readonly string[]).includes(value)
}

/** @deprecated Prefer isBuiltinRole or isValidRoleCode. Kept for callers that check built-ins. */
export function isRole(value: string): value is BuiltinRole {
  return isBuiltinRole(value)
}

export function isRoleScope(value: string): value is RoleScope {
  return (ROLE_SCOPES as readonly string[]).includes(value)
}

export function isAdmin(role: Role): boolean {
  return role === 'ADMINISTRATOR'
}

export function defaultPermissionsForRole(role: Role): RolePermissions {
  if (isAdmin(role)) {
    return {
      canAppraisals: true,
      canFinancialYears: true,
      canOrganization: true,
      canLetterCc: true,
      canDecisionMatrix: true,
      canThroughOfficers: true,
      canImportHistory: true,
      canExportHistory: true,
      canUsers: true,
      canRoles: true,
    }
  }
  return {
    canAppraisals: true,
    canFinancialYears: false,
    canOrganization: false,
    canLetterCc: false,
    canDecisionMatrix: false,
    canThroughOfficers: false,
    canImportHistory: false,
    canExportHistory: false,
    canUsers: false,
    canRoles: false,
  }
}

export function fallbackLabelForRole(code: Role): string {
  return isBuiltinRole(code) ? ROLE_LABELS[code] : code
}

export function fallbackScopeForRole(code: Role): RoleScope {
  return isBuiltinRole(code) ? ROLE_SCOPE[code] : 'section'
}
