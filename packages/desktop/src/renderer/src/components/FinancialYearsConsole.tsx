import type { FinancialYear, User } from '@perf-appraisal-app/shared'
import { Pencil, Plus, Trash2, X } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
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

type FinancialYearsConsoleProps = {
  user: User
  financialYear: FinancialYear | null
  onFinancialYearChange: (year: FinancialYear | null, nextUser?: User) => void
  onClose: () => void
}

type FormState = {
  appyear: string
  closed: boolean
}

const emptyForm = (): FormState => ({
  appyear: String(new Date().getFullYear()),
  closed: false,
})

export function FinancialYearsConsole({
  user,
  financialYear,
  onFinancialYearChange,
  onClose,
}: FinancialYearsConsoleProps) {
  const [years, setYears] = useState<FinancialYear[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogMode, setDialogMode] = useState<'create' | 'edit'>('create')
  const [form, setForm] = useState<FormState>(emptyForm)
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)

  const loadYears = useCallback(async () => {
    setLoading(true)
    setStatus(null)
    try {
      const client = await createApiClient()
      const res = await client['financial-years'].$get()
      if (!res.ok) {
        throw new Error(await res.text())
      }
      const data = await res.json()
      setYears(data)
      setSelectedId(null)
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err))
      setYears([])
    } finally {
      setLoading(false)
    }
  }, [])

  const syncSessionYear = useCallback(
    async (saved?: FinancialYear | null) => {
      const client = await createApiClient()
      if (saved && !saved.closed) {
        const res = await client.users[':id']['financial-year'].$put({
          param: { id: String(user.id) },
          json: { financialYearId: saved.id },
        })
        if (res.ok) {
          const data = await res.json()
          onFinancialYearChange(data.financialYear, data.user)
          return
        }
      }

      const res = await client['financial-years'].current.$get()
      if (res.ok) {
        const data = await res.json()
        onFinancialYearChange(data.financialYear)
        return
      }

      if (saved && financialYear?.id === saved.id) {
        onFinancialYearChange(saved.closed ? null : saved)
      }
    },
    [user.id, financialYear?.id, onFinancialYearChange],
  )

  useEffect(() => {
    void loadYears()
  }, [loadYears])

  function openCreate() {
    setDialogMode('create')
    setForm(emptyForm())
    setDialogOpen(true)
  }

  function openEdit(year: FinancialYear) {
    setSelectedId(year.id)
    setDialogMode('edit')
    setForm({
      appyear: String(year.appyear),
      closed: year.closed,
    })
    setDialogOpen(true)
  }

  function requestDelete(year: FinancialYear) {
    setSelectedId(year.id)
    setConfirmDeleteOpen(true)
  }

  async function handleSave() {
    const appyear = Number(form.appyear)
    if (!Number.isInteger(appyear) || appyear < 1900 || appyear > 2100) {
      setStatus('Enter a valid year between 1900 and 2100.')
      return
    }

    setLoading(true)
    setStatus(null)
    try {
      const client = await createApiClient()
      const res =
        dialogMode === 'edit' && selectedId != null
          ? await client['financial-years'][':id'].$put({
              param: { id: String(selectedId) },
              json: { appyear, closed: form.closed },
            })
          : await client['financial-years'].$post({
              json: { appyear, closed: form.closed },
            })

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string
        } | null
        throw new Error(body?.error ?? `Save failed (${res.status})`)
      }

      const saved = await res.json()
      await syncSessionYear(saved)

      setDialogOpen(false)
      await loadYears()
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
      const res = await client['financial-years'][':id'].$delete({
        param: { id: String(selectedId) },
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string
        } | null
        throw new Error(body?.error ?? `Delete failed (${res.status})`)
      }

      await syncSessionYear()
      await loadYears()
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
      setConfirmDeleteOpen(false)
    }
  }

  return (
    <section className="flex h-full min-h-0 flex-1 flex-col gap-3 overflow-hidden p-4">
      <h2 className="m-0 shrink-0 text-xl font-bold">Financial Years</h2>

      <Toolbar>
        <Button type="button" size="sm" onClick={openCreate}>
          <Plus className="size-4" />
          Add/New
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={onClose}>
          <X className="size-4" />
          Close
        </Button>
      </Toolbar>

      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto rounded-md border bg-background">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-muted">
              <TableRow>
                <TableHead>Year</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-24 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {years.map((year) => (
                <TableRow
                  key={year.id}
                  className="cursor-default"
                  onDoubleClick={() => openEdit(year)}
                >
                  <TableCell className="font-medium">{year.appyear}</TableCell>
                  <TableCell>{year.closed ? 'Closed' : 'Open'}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Modify financial year"
                        disabled={loading}
                        onClick={(e) => {
                          e.stopPropagation()
                          openEdit(year)
                        }}
                      >
                        <Pencil />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Delete financial year"
                        disabled={loading}
                        onClick={(e) => {
                          e.stopPropagation()
                          requestDelete(year)
                        }}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {years.length === 0 && !loading ? (
                <TableRow>
                  <TableCell
                    colSpan={3}
                    className="px-3 py-6 text-center text-muted-foreground"
                  >
                    No financial years defined yet.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>

      {status ? (
        <Alert className="shrink-0" variant="destructive">
          <AlertDescription>{status}</AlertDescription>
        </Alert>
      ) : null}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {dialogMode === 'create'
                ? 'Add Financial Year'
                : 'Edit Financial Year'}
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="fy-appyear">Year</Label>
              <Input
                id="fy-appyear"
                type="number"
                value={form.appyear}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, appyear: e.target.value }))
                }
              />
            </div>
            <div className="grid gap-2">
              <Label>Status</Label>
              <Select
                value={form.closed ? 'closed' : 'open'}
                onValueChange={(value) =>
                  setForm((prev) => ({ ...prev, closed: value === 'closed' }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>
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
            <AlertDialogTitle>Delete financial year?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the selected financial year. Years
              that are in use by appraisal records or users cannot be deleted.
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
