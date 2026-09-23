import type { FinancialYear, User } from '@perf-appraisal-app/shared'
import { FolderOpen, FolderX, RefreshCw, X } from 'lucide-react'
import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { createApiClient } from '../api/client'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

type UserFinancialYearConsoleProps = {
  user: User
  financialYear: FinancialYear | null
  onFinancialYearChange: (year: FinancialYear | null, nextUser?: User) => void
  onClose: () => void
}

export function UserFinancialYearConsole({
  user,
  financialYear,
  onFinancialYearChange,
  onClose,
}: UserFinancialYearConsoleProps) {
  const [years, setYears] = useState<FinancialYear[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<string | null>(null)

  const loadYears = useCallback(async () => {
    setLoading(true)
    setStatus(null)
    try {
      const client = await createApiClient()
      const res = await client['financial-years'].$get()
      if (!res.ok) {
        throw new Error(await res.text())
      }
      const allYears = await res.json()
      setYears(allYears.filter((y: FinancialYear) => !y.closed))
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err))
      setYears([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadYears()
  }, [loadYears])

  useEffect(() => {
    if (financialYear) {
      setSelectedId(financialYear.id)
    }
  }, [financialYear])

  async function setPersonalYear(financialYearId: number | null) {
    setLoading(true)
    setStatus(null)
    try {
      const client = await createApiClient()
      const res = await client.users[':id']['financial-year'].$put({
        param: { id: String(user.id) },
        json: { financialYearId },
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string
        } | null
        throw new Error(body?.error ?? `Failed to update year (${res.status})`)
      }
      const data = await res.json()
      onFinancialYearChange(data.financialYear, data.user)
      setStatus(
        data.financialYear
          ? `Opened financial year ${data.financialYear.appyear}.`
          : 'Closed your financial year.',
      )
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  function handleOpen() {
    if (selectedId == null) {
      setStatus('Select a year to open.')
      return
    }
    if (financialYear?.id === selectedId) {
      setStatus('That year is already open.')
      return
    }
    void setPersonalYear(selectedId)
  }

  function handleCloseYear() {
    if (financialYear == null) {
      setStatus('You do not have an open financial year.')
      return
    }
    void setPersonalYear(null)
  }

  return (
    <section className="flex h-full min-h-0 flex-1 flex-col gap-3 overflow-hidden p-4">
      <h2 className="m-0 shrink-0 text-xl font-bold">Open Financial Year</h2>

      <Card className="shrink-0 py-3">
        <CardContent className="px-3 text-sm text-muted-foreground">
          {financialYear ? (
            <p>
              Your open year:{' '}
              <span className="font-semibold text-foreground">
                {financialYear.appyear}
              </span>
              . Only one financial year can be open at a time.
            </p>
          ) : (
            <p>
              You have no open financial year. Open one below before using the
              Appraisal Console.
            </p>
          )}
        </CardContent>
      </Card>

      <div className="flex min-h-0 flex-1 gap-3 overflow-hidden">
        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto rounded-md border bg-background">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-muted">
              <TableRow>
                <TableHead>Year</TableHead>
                <TableHead>Your status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {years.map((year) => {
                const isOpen = financialYear?.id === year.id
                return (
                  <TableRow
                    key={year.id}
                    data-state={
                      year.id === selectedId ? 'selected' : undefined
                    }
                    className="cursor-default"
                    onClick={() => setSelectedId(year.id)}
                    onDoubleClick={() => {
                      setSelectedId(year.id)
                      if (!isOpen) void setPersonalYear(year.id)
                    }}
                  >
                    <TableCell className="font-medium">{year.appyear}</TableCell>
                    <TableCell>{isOpen ? 'Opened' : '—'}</TableCell>
                  </TableRow>
                )
              })}
              {years.length === 0 && !loading ? (
                <TableRow>
                  <TableCell
                    colSpan={2}
                    className="px-3 py-6 text-center text-muted-foreground"
                  >
                    No open financial years are available.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>

        <aside className="flex w-40 shrink-0 flex-col gap-2 overflow-y-auto">
          <ActionButton
            icon={<FolderOpen size={16} />}
            label="Open"
            onClick={handleOpen}
            disabled={loading}
          />
          <ActionButton
            icon={<FolderX size={16} />}
            label="Close"
            onClick={handleCloseYear}
            disabled={loading || financialYear == null}
          />
          <ActionButton
            icon={<RefreshCw size={16} />}
            label="Refresh"
            onClick={() => void loadYears()}
            disabled={loading}
          />
          <ActionButton
            icon={<X size={16} />}
            label="Done"
            onClick={onClose}
          />
        </aside>
      </div>

      {status ? (
        <Alert className="shrink-0">
          <AlertDescription>{status}</AlertDescription>
        </Alert>
      ) : null}
    </section>
  )
}

function ActionButton({
  icon,
  label,
  onClick,
  disabled,
}: {
  icon: ReactNode
  label: string
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="w-full justify-start"
      onClick={onClick}
      disabled={disabled}
    >
      {icon}
      <span>{label}</span>
    </Button>
  )
}
