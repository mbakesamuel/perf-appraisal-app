import type { RoleDefinition, RoleScope } from '@perf-appraisal-app/shared'
import { ROLE_SCOPES } from '@perf-appraisal-app/shared'
import { Pencil, Plus, X } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { createApiClient } from '../api/client'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Toolbar } from '@/components/ui/toolbar'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

type RolesConsoleProps = {
  onClose: () => void
}

type FormState = {
  code: string
  label: string
  jurisdiction: RoleScope
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

const JURISDICTION_LABELS: Record<RoleScope, string> = {
  section: 'Section',
  unit: 'Unit',
  group: 'Group',
  all: 'All',
}

function emptyForm(): FormState {
  return {
    code: '',
    label: '',
    jurisdiction: 'section',
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

function permissionsSummary(role: RoleDefinition): string {
  const flags: string[] = []
  if (role.canAppraisals) flags.push('Appraisals')
  if (role.canFinancialYears) flags.push('FY')
  if (role.canOrganization) flags.push('Org')
  if (role.canLetterCc) flags.push('CC')
  if (role.canDecisionMatrix) flags.push('Matrix')
  if (role.canThroughOfficers) flags.push('Thro')
  if (role.canImportHistory) flags.push('Import')
  if (role.canExportHistory) flags.push('Export')
  if (role.canUsers) flags.push('Users')
  if (role.canRoles) flags.push('Roles')
  return flags.length > 0 ? flags.join(', ') : 'None'
}

export function RolesConsole({ onClose }: RolesConsoleProps) {
  const [roles, setRoles] = useState<RoleDefinition[]>([])
  const [selectedCode, setSelectedCode] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogMode, setDialogMode] = useState<'create' | 'edit'>('edit')
  const [form, setForm] = useState<FormState | null>(null)

  const loadRoles = useCallback(async () => {
    setLoading(true)
    setStatus(null)
    try {
      const client = await createApiClient()
      const res = await client.roles.$get()
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string
        } | null
        throw new Error(body?.error ?? `Failed to load roles (${res.status})`)
      }
      setRoles(await res.json())
      setSelectedCode(null)
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadRoles()
  }, [loadRoles])

  function openCreate() {
    setDialogMode('create')
    setForm(emptyForm())
    setDialogOpen(true)
  }

  function openEdit(row: RoleDefinition) {
    setSelectedCode(row.code)
    setDialogMode('edit')
    setForm({
      code: row.code,
      label: row.label,
      jurisdiction: row.jurisdiction,
      canAppraisals: row.canAppraisals,
      canFinancialYears: row.canFinancialYears,
      canOrganization: row.canOrganization,
      canLetterCc: row.canLetterCc,
      canDecisionMatrix: row.canDecisionMatrix,
      canThroughOfficers: row.canThroughOfficers,
      canImportHistory: row.canImportHistory,
      canExportHistory: row.canExportHistory,
      canUsers: row.canUsers,
      canRoles: row.canRoles,
    })
    setDialogOpen(true)
  }

  async function handleSave() {
    if (!form) return
    setLoading(true)
    setStatus(null)
    try {
      const client = await createApiClient()
      const payload = {
        label: form.label.trim(),
        jurisdiction: form.jurisdiction,
        canAppraisals: form.canAppraisals,
        canFinancialYears: form.canFinancialYears,
        canOrganization: form.canOrganization,
        canLetterCc: form.canLetterCc,
        canDecisionMatrix: form.canDecisionMatrix,
        canThroughOfficers: form.canThroughOfficers,
        canImportHistory: form.canImportHistory,
        canExportHistory: form.canExportHistory,
        canUsers: form.canUsers,
        canRoles: form.canRoles,
      }

      const res =
        dialogMode === 'create'
          ? await client.roles.$post({
              json: {
                code: form.code.trim().toUpperCase(),
                ...payload,
              },
            })
          : await client.roles[':code'].$put({
              param: { code: selectedCode! },
              json: payload,
            })

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string
        } | null
        throw new Error(body?.error ?? `Save failed (${res.status})`)
      }
      setDialogOpen(false)
      await loadRoles()
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  const editingAdmin =
    dialogMode === 'edit' && selectedCode === 'ADMINISTRATOR'

  return (
    <section className="flex h-full min-h-0 flex-1 flex-col gap-3 overflow-hidden p-4">
      <h2 className="m-0 shrink-0 text-xl font-bold">Roles &amp; permissions</h2>

      {status ? (
        <Alert variant="destructive" className="shrink-0">
          <AlertDescription>{status}</AlertDescription>
        </Alert>
      ) : null}

      <Toolbar>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={openCreate}
          disabled={loading}
        >
          <Plus className="size-4" />
          Add
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={onClose}>
          <X className="size-4" />
          Close
        </Button>
      </Toolbar>

      <div className="min-h-0 flex-1 overflow-y-auto rounded-md border bg-background">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-muted">
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Label</TableHead>
              <TableHead>Jurisdiction</TableHead>
              <TableHead>Permissions</TableHead>
              <TableHead className="w-16 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {roles.map((row) => (
              <TableRow
                key={row.code}
                className="cursor-default"
                onDoubleClick={() => openEdit(row)}
              >
                <TableCell className="font-mono text-xs">{row.code}</TableCell>
                <TableCell>{row.label}</TableCell>
                <TableCell>{JURISDICTION_LABELS[row.jurisdiction]}</TableCell>
                <TableCell>{permissionsSummary(row)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Edit role"
                      disabled={loading}
                      onClick={(e) => {
                        e.stopPropagation()
                        openEdit(row)
                      }}
                    >
                      <Pencil />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {roles.length === 0 && !loading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-muted-foreground">
                  No roles found.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialogMode === 'create'
                ? 'Add role'
                : `Edit role — ${selectedCode}`}
            </DialogTitle>
          </DialogHeader>
          {form ? (
            <div className="grid gap-3 py-2">
              {dialogMode === 'create' ? (
                <div className="grid gap-1">
                  <Label htmlFor="role-code">Code</Label>
                  <Input
                    id="role-code"
                    value={form.code}
                    placeholder="e.g. UNIT_CLERK"
                    className="font-mono uppercase"
                    onChange={(e) =>
                      setForm((prev) =>
                        prev
                          ? {
                              ...prev,
                              code: e.target.value
                                .toUpperCase()
                                .replace(/[^A-Z0-9_]/g, ''),
                            }
                          : prev,
                      )
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Starts with a letter; use A–Z, 0–9, or underscore only.
                  </p>
                </div>
              ) : null}
              <div className="grid gap-1">
                <Label htmlFor="role-label">Label</Label>
                <Input
                  id="role-label"
                  value={form.label}
                  onChange={(e) =>
                    setForm((prev) =>
                      prev ? { ...prev, label: e.target.value } : prev,
                    )
                  }
                />
              </div>
              <div className="grid gap-1">
                <Label>Jurisdiction</Label>
                <Select
                  value={form.jurisdiction}
                  onValueChange={(value) =>
                    setForm((prev) =>
                      prev
                        ? { ...prev, jurisdiction: value as RoleScope }
                        : prev,
                    )
                  }
                  disabled={editingAdmin}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLE_SCOPES.map((scope) => (
                      <SelectItem key={scope} value={scope}>
                        {JURISDICTION_LABELS[scope]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <fieldset className="grid gap-2">
                <legend className="text-sm font-medium">Permissions</legend>
                {(
                  [
                    ['canAppraisals', 'Appraisals'],
                    ['canFinancialYears', 'Financial years'],
                    ['canOrganization', 'Organization'],
                    ['canLetterCc', 'Letter copies (CC)'],
                    ['canDecisionMatrix', 'Decision Matrix'],
                    ['canThroughOfficers', 'Through Officers'],
                    ['canImportHistory', 'Import historic appraisals'],
                    ['canExportHistory', 'Export historic appraisals'],
                    ['canUsers', 'Users'],
                    ['canRoles', 'Roles'],
                  ] as const
                ).map(([key, label]) => (
                  <label
                    key={key}
                    className="flex items-center gap-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      className="size-4 accent-primary"
                      checked={form[key]}
                      disabled={editingAdmin && key === 'canRoles'}
                      onChange={(e) =>
                        setForm((prev) =>
                          prev
                            ? { ...prev, [key]: e.target.checked }
                            : prev,
                        )
                      }
                    />
                    {label}
                  </label>
                ))}
              </fieldset>
            </div>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void handleSave()}
              disabled={
                loading ||
                !form ||
                !form.label.trim() ||
                (dialogMode === 'create' && !form.code.trim())
              }
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}
