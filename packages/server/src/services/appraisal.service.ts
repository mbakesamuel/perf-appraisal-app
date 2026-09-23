import type {
  AppraisalDetail,
  AppraisalListItem,
  AppraisalListQuery,
  AppraisalUpsertInput,
  AwardOption,
  MatricLookupMode,
  MatricLookupResult,
  SectionOption,
  UnitOption,
} from '@perf-appraisal-app/shared'
import { prisma } from '../db.js'
import { resolveMatricLookup } from './matric-lookup.service.js'

function toDateOnly(value: Date | null | undefined): string | null {
  if (!value) return null
  const y = value.getFullYear()
  const m = String(value.getMonth() + 1).padStart(2, '0')
  const d = String(value.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function parseDateInput(value: string | null | undefined): Date | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function parseSectionPk(raw: string | null | undefined): number | null {
  if (raw == null || raw === '' || raw === '0') return null
  const sectionPk = Number(raw)
  return Number.isInteger(sectionPk) ? sectionPk : null
}

function ageFrom(dateOfBirth: Date | null | undefined): number | null {
  if (!dateOfBirth) return null
  const today = new Date()
  let age = today.getFullYear() - dateOfBirth.getFullYear()
  const monthDiff = today.getMonth() - dateOfBirth.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dateOfBirth.getDate())) {
    age -= 1
  }
  return age
}

async function matricsForFilters(
  query: AppraisalListQuery,
  scopeSectionIds: number[] | null,
): Promise<string[] | null> {
  // Admin with no org filters → no matric restriction.
  if (
    scopeSectionIds === null &&
    query.sectionId == null &&
    query.unitId == null
  ) {
    return null
  }

  let sectionIds: number[]

  if (query.sectionId != null) {
    if (scopeSectionIds && !scopeSectionIds.includes(query.sectionId)) {
      return []
    }
    sectionIds = [query.sectionId]
  } else if (query.unitId != null) {
    const unitSections = (
      await prisma.tbl_section.findMany({
        where: { tbl_unit_id: query.unitId },
        select: { id: true },
      })
    ).map((s) => s.id)
    sectionIds = scopeSectionIds
      ? unitSections.filter((id) => scopeSectionIds.includes(id))
      : unitSections
  } else {
    sectionIds = scopeSectionIds ?? []
  }

  if (sectionIds.length === 0) {
    return []
  }

  const sectionIdStrings = sectionIds.map(String)
  const rows = await prisma.tbl_personel_section.findMany({
    where: { tbl_section_id: { in: sectionIdStrings } },
    select: { matric: true },
  })

  return [...new Set(rows.map((r) => r.matric).filter((m): m is string => Boolean(m)))]
}

async function loadEmployeeDetails(matric: string): Promise<AppraisalDetail['employee']> {
  const person = await prisma.tbl_personel_list.findUnique({
    where: { matric },
  })

  const [sectionRow, designationRow] = await Promise.all([
    prisma.tbl_personel_section.findFirst({
      where: { matric },
      orderBy: { effdate: 'desc' },
    }),
    prisma.tbl_personel_designation.findFirst({
      where: { matric },
      orderBy: { effdate: 'desc' },
    }),
  ])

  let sectionName: string | null = null
  const sectionPk = parseSectionPk(sectionRow?.tbl_section_id)
  if (sectionPk != null) {
    const section = await prisma.tbl_section.findUnique({
      where: { id: sectionPk },
    })
    sectionName = section?.section ?? null
  }

  return {
    section: sectionName,
    designation: designationRow?.design ?? null,
    dateEngaged: toDateOnly(person?.date_eng),
    dateOfBirth: toDateOnly(person?.date_birth),
    presentAge: ageFrom(person?.date_birth),
    lengthService: null,
  }
}

export async function listAppraisals(
  query: AppraisalListQuery,
  scopeSectionIds: number[] | null = null,
): Promise<{ items: AppraisalListItem[]; total: number }> {
  const matricFilter = await matricsForFilters(query, scopeSectionIds)

  if (matricFilter && matricFilter.length === 0) {
    return { items: [], total: 0 }
  }

  const rows = await prisma.tbl_perfappraisal.findMany({
    where: {
      ...(query.appyear != null ? { appyear: query.appyear } : {}),
      ...(matricFilter ? { matric: { in: matricFilter } } : {}),
    },
    orderBy: [{ matric: 'asc' }, { id: 'asc' }],
  })

  const matrics = [
    ...new Set(rows.map((r) => r.matric).filter((m): m is string => Boolean(m))),
  ]
  const awardIds = [
    ...new Set(
      rows.map((r) => r.tbl_award_id).filter((id): id is number => id != null),
    ),
  ]

  const [people, awards, sectionRows] = await Promise.all([
    matrics.length
      ? prisma.tbl_personel_list.findMany({
          where: { matric: { in: matrics } },
          select: { matric: true, names: true },
        })
      : Promise.resolve([]),
    awardIds.length
      ? prisma.tbl_award.findMany({
          where: { id: { in: awardIds } },
          select: { id: true, award: true },
        })
      : Promise.resolve([]),
    matrics.length
      ? prisma.tbl_personel_section.findMany({
          where: { matric: { in: matrics } },
          orderBy: { effdate: 'desc' },
          select: { matric: true, tbl_section_id: true },
        })
      : Promise.resolve([]),
  ])

  const namesByMatric = new Map(people.map((p) => [p.matric, p.names ?? null]))
  const awardById = new Map(awards.map((a) => [a.id, a.award ?? null]))

  const latestSectionIdByMatric = new Map<string, number | null>()
  for (const row of sectionRows) {
    if (!row.matric || latestSectionIdByMatric.has(row.matric)) continue
    latestSectionIdByMatric.set(row.matric, parseSectionPk(row.tbl_section_id))
  }

  const sectionIds = [
    ...new Set(
      [...latestSectionIdByMatric.values()].filter(
        (id): id is number => id != null,
      ),
    ),
  ]
  const sectionRecords = sectionIds.length
    ? await prisma.tbl_section.findMany({
        where: { id: { in: sectionIds } },
        select: { id: true, section: true },
      })
    : []
  const sectionById = new Map(
    sectionRecords.map((section) => [section.id, section.section ?? null]),
  )

  const items: AppraisalListItem[] = rows.map((row) => {
    const sectionId = row.matric
      ? (latestSectionIdByMatric.get(row.matric) ?? null)
      : null
    return {
      id: row.id,
      appyear: row.appyear,
      matric: row.matric,
      names: row.matric ? (namesByMatric.get(row.matric) ?? null) : null,
      dateLmerit: toDateOnly(row.date_lmerit),
      dateLstat: toDateOnly(row.date_lstat),
      dateLpro: toDateOnly(row.date_lpro),
      lengthservice: row.lengthservice,
      preCat: row.pre_cat,
      proCat: row.pro_cat,
      award: row.tbl_award_id != null ? (awardById.get(row.tbl_award_id) ?? null) : null,
      awardId: row.tbl_award_id,
      sectionId,
      sectionName: sectionId != null ? (sectionById.get(sectionId) ?? null) : null,
    }
  })

  return { items, total: items.length }
}

export async function getAppraisalDetail(
  id: number,
): Promise<AppraisalDetail | null> {
  const row = await prisma.tbl_perfappraisal.findUnique({ where: { id } })
  if (!row?.matric) return null

  const [person, employee] = await Promise.all([
    prisma.tbl_personel_list.findUnique({ where: { matric: row.matric } }),
    loadEmployeeDetails(row.matric),
  ])

  return {
    id: row.id,
    appyear: row.appyear,
    matric: row.matric,
    names: person?.names ?? null,
    preCat: row.pre_cat,
    proCat: row.pro_cat,
    dateLmerit: toDateOnly(row.date_lmerit),
    dateLstat: toDateOnly(row.date_lstat),
    dateLpro: toDateOnly(row.date_lpro),
    awardId: row.tbl_award_id,
    lengthservice: row.lengthservice,
    employee: {
      ...employee,
      lengthService: row.lengthservice ?? employee.lengthService,
    },
  }
}

export async function lookupEmployeeByMatric(
  matric: string,
  appyear: number,
  mode: MatricLookupMode = 'create',
): Promise<MatricLookupResult> {
  return resolveMatricLookup(matric, appyear, mode)
}

export async function upsertAppraisal(
  input: AppraisalUpsertInput,
): Promise<AppraisalDetail> {
  const data = {
    appyear: input.appyear,
    matric: input.matric,
    date_lmerit: parseDateInput(input.dateLmerit),
    date_lstat: parseDateInput(input.dateLstat),
    date_lpro: parseDateInput(input.dateLpro),
    lengthservice: input.lengthservice ?? null,
    pre_cat: input.preCat ?? null,
    pro_cat: input.proCat ?? null,
    tbl_award_id: input.awardId ?? null,
  }

  const row = input.id
    ? await prisma.tbl_perfappraisal.update({ where: { id: input.id }, data })
    : await prisma.tbl_perfappraisal.create({ data })

  const detail = await getAppraisalDetail(row.id)
  if (!detail) {
    throw new Error('Failed to load appraisal after save')
  }
  return detail
}

export async function deleteAppraisal(id: number): Promise<void> {
  await prisma.tbl_perfappraisal.delete({ where: { id } })
}

export async function listAwards(): Promise<AwardOption[]> {
  const rows = await prisma.tbl_award.findMany({ orderBy: { id: 'asc' } })
  return rows.map((r) => ({ id: r.id, award: r.award }))
}

export async function listUnits(): Promise<UnitOption[]> {
  const rows = await prisma.tbl_unit.findMany({
    orderBy: { unit_name: 'asc' },
  })
  return rows.map((r) => ({
    id: r.id,
    unitName: r.unit_name,
    groupId: r.groupid,
    active: r.active,
  }))
}

export async function listSections(unitId?: string): Promise<SectionOption[]> {
  const rows = await prisma.tbl_section.findMany({
    where: unitId != null ? { tbl_unit_id: unitId } : undefined,
    orderBy: { section: 'asc' },
  })
  return rows.map((r) => ({
    id: r.id,
    section: r.section,
    unitId: r.tbl_unit_id,
    active: r.active,
  }))
}
