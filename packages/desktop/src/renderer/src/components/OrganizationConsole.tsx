import type {
  GroupOption,
  SectionOption,
  UnitOption,
  User,
} from '@perf-appraisal-app/shared'
import { Pencil, Plus, Search, Trash2, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { createApiClient } from '../api/client'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

type OrganizationConsoleProps = {
  currentUser: User
  onClose: () => void
}

type TabKey = 'groups' | 'units' | 'sections'

type GroupForm = { id: string; groupName: string; active: boolean }
type UnitForm = { id: string; unitName: string; groupId: string; active: boolean }
type SectionForm = { section: string; unitId: string; active: boolean }

const NONE_UNIT = '__none__'

function selectableGroups(groups: GroupOption[], currentId?: string) {
  return groups.filter((group) => group.active || group.id === currentId)
}

function selectableUnits(units: UnitOption[], currentId?: string) {
  return units.filter((unit) => unit.active || unit.id === currentId)
}

function statusLabel(active: boolean) {
  return active ? 'Active' : 'Inactive'
}

function matchesQuery(
  q: string,
  ...values: Array<string | number | null | undefined>
) {
  return values.some((value) =>
    String(value ?? '').toLowerCase().includes(q),
  )
}

const SEARCH_PLACEHOLDER: Record<TabKey, string> = {
  groups: 'ID or group name',
  units: 'ID, unit, or group',
  sections: 'ID, section, or unit',
}

export function OrganizationConsole({
  currentUser,
  onClose,
}: OrganizationConsoleProps) {
  const [tab, setTab] = useState<TabKey>('groups')
  const [groups, setGroups] = useState<GroupOption[]>([])
  const [units, setUnits] = useState<UnitOption[]>([])
  const [sections, setSections] = useState<SectionOption[]>([])
  const [selectedId, setSelectedId] = useState<string | number | null>(null)
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogMode, setDialogMode] = useState<'create' | 'edit'>('create')
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
  const [search, setSearch] = useState('')
  const scoped = currentUser.jurisdiction !== 'all'

  const [groupForm, setGroupForm] = useState<GroupForm>({
    id: '',
    groupName: '',
    active: true,
  })
  const [unitForm, setUnitForm] = useState<UnitForm>({
    id: '',
    unitName: '',
    groupId: '',
    active: true,
  })
  const [sectionForm, setSectionForm] = useState<SectionForm>({
    section: '',
    unitId: '',
    active: true,
  })

  const loadAll = useCallback(async () => {
    setLoading(true)
    setStatus(null)
    try {
      const client = await createApiClient()
      const [groupsRes, unitsRes, sectionsRes] = await Promise.all([
        client.organization.groups.$get(),
        client.organization.units.$get(),
        client.organization.sections.$get({ query: {} }),
      ])
      if (!groupsRes.ok || !unitsRes.ok || !sectionsRes.ok) {
        throw new Error('Failed to load organization data')
      }
      setGroups(await groupsRes.json())
      setUnits(await unitsRes.json())
      setSections(await sectionsRes.json())
      setSelectedId(null)
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadAll()
  }, [loadAll])

  useEffect(() => {
    setSelectedId(null)
    setStatus(null)
  }, [tab])

  function openCreate() {
    setDialogMode('create')
    if (tab === 'groups') {
      setGroupForm({ id: '', groupName: '', active: true })
    }
    if (tab === 'units') {
      setUnitForm({
        id: '',
        unitName: '',
        groupId: selectableGroups(groups)[0]?.id ?? '',
        active: true,
      })
    }
    if (tab === 'sections') {
      setSectionForm({
        section: '',
        unitId: selectableUnits(units)[0]?.id ?? '',
        active: true,
      })
    }
    setDialogOpen(true)
  }

  function openEditGroup(row: GroupOption) {
    setSelectedId(row.id)
    setDialogMode('edit')
    setGroupForm({ id: row.id, groupName: row.groupName, active: row.active })
    setDialogOpen(true)
  }

  function openEditUnit(row: UnitOption) {
    setSelectedId(row.id)
    setDialogMode('edit')
    setUnitForm({
      id: row.id,
      unitName: row.unitName,
      groupId: row.groupId,
      active: row.active,
    })
    setDialogOpen(true)
  }

  function openEditSection(row: SectionOption) {
    setSelectedId(row.id)
    setDialogMode('edit')
    setSectionForm({
      section: row.section ?? '',
      unitId: row.unitId ?? '',
      active: row.active,
    })
    setDialogOpen(true)
  }

  function requestDelete(id: string | number) {
    setSelectedId(id)
    setConfirmDeleteOpen(true)
  }

  async function handleSave() {
    setLoading(true)
    setStatus(null)
    try {
      const client = await createApiClient()
      let res: Response

      if (tab === 'groups') {
        if (!groupForm.id.trim() || !groupForm.groupName.trim()) {
          throw new Error('Group ID and name are required.')
        }
        res =
          dialogMode === 'edit' && typeof selectedId === 'string'
            ? await client.organization.groups[':id'].$put({
                param: { id: selectedId },
                json: {
                  id: groupForm.id.trim(),
                  groupName: groupForm.groupName.trim(),
                  active: groupForm.active,
                },
              })
            : await client.organization.groups.$post({
                json: {
                  id: groupForm.id.trim(),
                  groupName: groupForm.groupName.trim(),
                  active: groupForm.active,
                },
              })
      } else if (tab === 'units') {
        if (!unitForm.id.trim() || !unitForm.unitName.trim() || !unitForm.groupId) {
          throw new Error('Unit ID, name, and group are required.')
        }
        res =
          dialogMode === 'edit' && typeof selectedId === 'string'
            ? await client.organization.units[':id'].$put({
                param: { id: selectedId },
                json: {
                  id: unitForm.id.trim(),
                  unitName: unitForm.unitName.trim(),
                  groupId: unitForm.groupId,
                  active: unitForm.active,
                },
              })
            : await client.organization.units.$post({
                json: {
                  id: unitForm.id.trim(),
                  unitName: unitForm.unitName.trim(),
                  groupId: unitForm.groupId,
                  active: unitForm.active,
                },
              })
      } else {
        if (!sectionForm.section.trim()) {
          throw new Error('Section name is required.')
        }
        const payload = {
          section: sectionForm.section.trim(),
          unitId:
            sectionForm.unitId && sectionForm.unitId !== NONE_UNIT
              ? sectionForm.unitId
              : null,
          active: sectionForm.active,
        }
        res =
          dialogMode === 'edit' && typeof selectedId === 'number'
            ? await client.organization.sections[':id'].$put({
                param: { id: String(selectedId) },
                json: payload,
              })
            : await client.organization.sections.$post({ json: payload })
      }

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string
        } | null
        throw new Error(body?.error ?? `Save failed (${res.status})`)
      }

      setDialogOpen(false)
      await loadAll()
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete() {
    if (selectedId == null) return
    setLoading(true)
    setStatus(null)
    try {
      const client = await createApiClient()
      let res: Response
      if (tab === 'groups' && typeof selectedId === 'string') {
        res = await client.organization.groups[':id'].$delete({
          param: { id: selectedId },
        })
      } else if (tab === 'units' && typeof selectedId === 'string') {
        res = await client.organization.units[':id'].$delete({
          param: { id: selectedId },
        })
      } else {
        res = await client.organization.sections[':id'].$delete({
          param: { id: String(selectedId) },
        })
      }
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string
        } | null
        throw new Error(body?.error ?? `Delete failed (${res.status})`)
      }
      await loadAll()
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
      setConfirmDeleteOpen(false)
    }
  }

  const groupNameById = useMemo(
    () => new Map(groups.map((g) => [g.id, g.groupName])),
    [groups],
  )
  const unitNameById = useMemo(
    () => new Map(units.map((u) => [u.id, u.unitName])),
    [units],
  )
  const query = search.trim().toLowerCase()

  const visibleGroups = useMemo(() => {
    if (!query) return groups
    return groups.filter((row) =>
      matchesQuery(query, row.id, row.groupName, statusLabel(row.active)),
    )
  }, [groups, query])

  const visibleUnits = useMemo(() => {
    if (!query) return units
    return units.filter((row) =>
      matchesQuery(
        query,
        row.id,
        row.unitName,
        groupNameById.get(row.groupId) ?? row.groupId,
        statusLabel(row.active),
      ),
    )
  }, [units, query, groupNameById])

  const visibleSections = useMemo(() => {
    if (!query) return sections
    return sections.filter((row) =>
      matchesQuery(
        query,
        row.id,
        row.section,
        row.unitId,
        row.unitId ? (unitNameById.get(row.unitId) ?? row.unitId) : '',
        statusLabel(row.active),
      ),
    )
  }, [sections, query, unitNameById])

  return (
    <section className="flex h-full min-h-0 flex-1 flex-col gap-3 overflow-hidden p-4">
      <h2 className="m-0 shrink-0 text-xl font-bold">Organization</h2>

      <Toolbar>
        <Button
          type="button"
          size="sm"
          onClick={openCreate}
          disabled={scoped && tab === 'groups'}
        >
          <Plus className="size-4" />
          Add/New
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={onClose}>
          <X className="size-4" />
          Close
        </Button>
      </Toolbar>

      <Tabs
        value={tab}
        onValueChange={(value) => setTab(value as TabKey)}
        className="flex min-h-0 flex-1 flex-col gap-3"
      >
        <div className="flex shrink-0 items-end gap-3">
          <TabsList>
            <TabsTrigger value="groups">Groups</TabsTrigger>
            <TabsTrigger value="units">Units</TabsTrigger>
            <TabsTrigger value="sections">Sections</TabsTrigger>
          </TabsList>

          <div className="ml-auto grid w-full max-w-sm gap-1">
            <Label htmlFor="org-search">Search</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="org-search"
                className="pl-8"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={SEARCH_PLACEHOLDER[tab]}
                disabled={loading}
              />
            </div>
          </div>
        </div>

        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto rounded-md border bg-background">
            <TabsContent value="groups" className="m-0 h-full">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-muted">
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Group Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-24 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleGroups.map((row) => (
                    <TableRow
                      key={row.id}
                      className="cursor-default"
                      onDoubleClick={() => openEditGroup(row)}
                    >
                      <TableCell className="font-medium">{row.id}</TableCell>
                      <TableCell>{row.groupName}</TableCell>
                      <TableCell>{row.active ? 'Active' : 'Inactive'}</TableCell>
                      <RowActions
                        disabled={loading}
                        deleteDisabled={scoped}
                        onEdit={() => openEditGroup(row)}
                        onDelete={() => requestDelete(row.id)}
                        editLabel="Modify group"
                        deleteLabel="Delete group"
                      />
                    </TableRow>
                  ))}
                  {visibleGroups.length === 0 && !loading ? (
                    <EmptyRow
                      colSpan={4}
                      label={
                        query
                          ? 'No groups match the search.'
                          : 'No groups defined yet.'
                      }
                    />
                  ) : null}
                </TableBody>
              </Table>
            </TabsContent>

            <TabsContent value="units" className="m-0 h-full">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-muted">
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Unit Name</TableHead>
                    <TableHead>Group</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-24 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleUnits.map((row) => (
                    <TableRow
                      key={row.id}
                      className="cursor-default"
                      onDoubleClick={() => openEditUnit(row)}
                    >
                      <TableCell className="font-medium">{row.id}</TableCell>
                      <TableCell>{row.unitName}</TableCell>
                      <TableCell>
                        {groupNameById.get(row.groupId) ?? row.groupId}
                      </TableCell>
                      <TableCell>{row.active ? 'Active' : 'Inactive'}</TableCell>
                      <RowActions
                        disabled={loading}
                        onEdit={() => openEditUnit(row)}
                        onDelete={() => requestDelete(row.id)}
                        editLabel="Modify unit"
                        deleteLabel="Delete unit"
                      />
                    </TableRow>
                  ))}
                  {visibleUnits.length === 0 && !loading ? (
                    <EmptyRow
                      colSpan={5}
                      label={
                        query
                          ? 'No units match the search.'
                          : 'No units defined yet.'
                      }
                    />
                  ) : null}
                </TableBody>
              </Table>
            </TabsContent>

            <TabsContent value="sections" className="m-0 h-full">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-muted">
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Section</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-24 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleSections.map((row) => (
                    <TableRow
                      key={row.id}
                      className="cursor-default"
                      onDoubleClick={() => openEditSection(row)}
                    >
                      <TableCell className="font-medium">{row.id}</TableCell>
                      <TableCell>{row.section}</TableCell>
                      <TableCell>
                        {row.unitId
                          ? (unitNameById.get(row.unitId) ?? row.unitId)
                          : '—'}
                      </TableCell>
                      <TableCell>{row.active ? 'Active' : 'Inactive'}</TableCell>
                      <RowActions
                        disabled={loading}
                        onEdit={() => openEditSection(row)}
                        onDelete={() => requestDelete(row.id)}
                        editLabel="Modify section"
                        deleteLabel="Delete section"
                      />
                    </TableRow>
                  ))}
                  {visibleSections.length === 0 && !loading ? (
                    <EmptyRow
                      colSpan={5}
                      label={
                        query
                          ? 'No sections match the search.'
                          : 'No sections defined yet.'
                      }
                    />
                  ) : null}
                </TableBody>
              </Table>
            </TabsContent>
          </div>
      </Tabs>

      {status ? (
        <Alert className="shrink-0" variant="destructive">
          <AlertDescription>{status}</AlertDescription>
        </Alert>
      ) : null}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {dialogMode === 'create' ? 'Add' : 'Edit'}{' '}
              {tab === 'groups' ? 'Group' : tab === 'units' ? 'Unit' : 'Section'}
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            {tab === 'groups' ? (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="group-id">ID</Label>
                  <Input
                    id="group-id"
                    value={groupForm.id}
                    disabled={dialogMode === 'edit'}
                    onChange={(e) =>
                      setGroupForm((prev) => ({ ...prev, id: e.target.value }))
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="group-name">Group Name</Label>
                  <Input
                    id="group-name"
                    value={groupForm.groupName}
                    onChange={(e) =>
                      setGroupForm((prev) => ({
                        ...prev,
                        groupName: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Status</Label>
                  <Select
                    value={groupForm.active ? 'active' : 'inactive'}
                    onValueChange={(value) =>
                      setGroupForm((prev) => ({
                        ...prev,
                        active: value === 'active',
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            ) : null}

            {tab === 'units' ? (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="unit-id">ID (max 3 chars)</Label>
                  <Input
                    id="unit-id"
                    maxLength={3}
                    value={unitForm.id}
                    disabled={dialogMode === 'edit'}
                    onChange={(e) =>
                      setUnitForm((prev) => ({ ...prev, id: e.target.value }))
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="unit-name">Unit Name</Label>
                  <Input
                    id="unit-name"
                    value={unitForm.unitName}
                    onChange={(e) =>
                      setUnitForm((prev) => ({
                        ...prev,
                        unitName: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Group</Label>
                  <Select
                    value={unitForm.groupId || undefined}
                    onValueChange={(value) =>
                      setUnitForm((prev) => ({ ...prev, groupId: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select group" />
                    </SelectTrigger>
                    <SelectContent>
                      {selectableGroups(groups, unitForm.groupId).map((group) => (
                        <SelectItem key={group.id} value={group.id}>
                          {group.groupName}
                          {group.active ? '' : ' (inactive)'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Status</Label>
                  <Select
                    value={unitForm.active ? 'active' : 'inactive'}
                    onValueChange={(value) =>
                      setUnitForm((prev) => ({
                        ...prev,
                        active: value === 'active',
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            ) : null}

            {tab === 'sections' ? (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="section-name">Section</Label>
                  <Input
                    id="section-name"
                    value={sectionForm.section}
                    onChange={(e) =>
                      setSectionForm((prev) => ({
                        ...prev,
                        section: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Unit</Label>
                  <Select
                    value={sectionForm.unitId || NONE_UNIT}
                    onValueChange={(value) =>
                      setSectionForm((prev) => ({
                        ...prev,
                        unitId: value === NONE_UNIT ? '' : value,
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select unit" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE_UNIT}>—</SelectItem>
                      {selectableUnits(units, sectionForm.unitId).map((unit) => (
                        <SelectItem key={unit.id} value={unit.id}>
                          {unit.unitName}
                          {unit.active ? '' : ' (inactive)'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Status</Label>
                  <Select
                    value={sectionForm.active ? 'active' : 'inactive'}
                    onValueChange={(value) =>
                      setSectionForm((prev) => ({
                        ...prev,
                        active: value === 'active',
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            ) : null}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void handleSave()}
              disabled={loading}
            >
              {loading ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {tab.slice(0, -1)}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes the selected record. Items that are still
              referenced cannot be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleDelete()}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}

function EmptyRow({ colSpan, label }: { colSpan: number; label: string }) {
  return (
    <TableRow>
      <TableCell
        colSpan={colSpan}
        className="px-3 py-6 text-center text-muted-foreground"
      >
        {label}
      </TableCell>
    </TableRow>
  )
}

function RowActions({
  onEdit,
  onDelete,
  disabled,
  deleteDisabled,
  editLabel,
  deleteLabel,
}: {
  onEdit: () => void
  onDelete: () => void
  disabled?: boolean
  deleteDisabled?: boolean
  editLabel: string
  deleteLabel: string
}) {
  return (
    <TableCell className="text-right">
      <div className="flex justify-end gap-1">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={editLabel}
          disabled={disabled}
          onClick={(e) => {
            e.stopPropagation()
            onEdit()
          }}
        >
          <Pencil />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={deleteLabel}
          disabled={disabled || deleteDisabled}
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
        >
          <Trash2 />
        </Button>
      </div>
    </TableCell>
  )
}
