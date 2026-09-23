import type {
  AppraisalDateSnapshot,
  AppraisalDetail,
  AwardOption,
  MatricLookupMode,
  MatricLookupResult,
} from '@perf-appraisal-app/shared'
import {
  computeServiceYears,
  formatLengthOfService,
  resolveAwardEligibilityScenario,
  resolveDatePrefill,
  resolveEligibleAwardIds,
} from '@perf-appraisal-app/shared'
import { prisma } from '../db.js'

export class PersonnelNotFoundError extends Error {
  constructor(matric: string) {
    super(
      `No personnel record found for Matric: ${matric}. Please initialize as new personnel.`,
    )
    this.name = 'PersonnelNotFoundError'
  }
}

function toDateOnly(value: Date | null | undefined): string | null {
  if (!value) return null
  const y = value.getFullYear()
  const m = String(value.getMonth() + 1).padStart(2, '0')
  const d = String(value.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function ageFrom(dateOfBirth: Date | null | undefined): number | null {
  if (!dateOfBirth) return null
  const today = new Date()
  let age = today.getFullYear() - dateOfBirth.getFullYear()
  const monthDiff = today.getMonth() - dateOfBirth.getMonth()
  if (
    monthDiff < 0 ||
    (monthDiff === 0 && today.getDate() < dateOfBirth.getDate())
  ) {
    age -= 1
  }
  return age
}

type AppraisalRowWithAward = {
  id: number
  appyear: number | null
  matric: string | null
  date_lmerit: Date | null
  date_lstat: Date | null
  date_lpro: Date | null
  lengthservice: string | null
  pre_cat: string | null
  pro_cat: string | null
  tbl_award_id: number | null
  awardName: string | null
}

async function loadAwards(): Promise<AwardOption[]> {
  const rows = await prisma.tbl_award.findMany({ orderBy: { id: 'asc' } })
  return rows.map((r) => ({ id: r.id, award: r.award }))
}

async function getAppraisalForYear(
  matric: string,
  appyear: number,
): Promise<AppraisalRowWithAward | null> {
  const row = await prisma.tbl_perfappraisal.findFirst({
    where: { matric, appyear },
  })
  if (!row) return null

  let awardName: string | null = null
  if (row.tbl_award_id != null) {
    const award = await prisma.tbl_award.findUnique({
      where: { id: row.tbl_award_id },
      select: { award: true },
    })
    awardName = award?.award ?? null
  }

  return { ...row, awardName }
}

function toDateSnapshot(row: AppraisalRowWithAward): AppraisalDateSnapshot {
  return {
    dateLmerit: toDateOnly(row.date_lmerit),
    dateLstat: toDateOnly(row.date_lstat),
    dateLpro: toDateOnly(row.date_lpro),
    awardName: row.awardName,
  }
}

async function getSalaryReviewSnapshot(
  matric: string,
  appyear: number,
): Promise<AppraisalDateSnapshot | null> {
  const row = await prisma.tbl_salaryreview.findFirst({
    where: { matric, appyear },
    orderBy: { id: 'desc' },
  })
  if (!row) return null
  return {
    dateLmerit: toDateOnly(row.date_lmer),
    dateLstat: toDateOnly(row.date_lstat),
    dateLpro: toDateOnly(row.date_lpro),
    awardName: row.award ?? null,
  }
}

async function getPriorYearSnapshot(
  matric: string,
  appyear: number,
): Promise<AppraisalDateSnapshot | null> {
  const priorAppraisal = await getAppraisalForYear(matric, appyear - 1)
  if (priorAppraisal) return toDateSnapshot(priorAppraisal)
  return getSalaryReviewSnapshot(matric, appyear - 1)
}

function appraisalToDetail(
  row: AppraisalRowWithAward,
  names: string | null,
  employee: AppraisalDetail['employee'],
): AppraisalDetail {
  return {
    id: row.id,
    appyear: row.appyear,
    matric: row.matric ?? '',
    names,
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

async function loadPersonnelCategory(
  matric: string,
  appyear: number,
): Promise<string | null> {
  const row = await prisma.tbl_personel_category.findFirst({
    where: {
      matric,
      OR: [
        { effdate: { lte: new Date(appyear, 11, 31) } },
        { effdate: null },
      ],
    },
    orderBy: { effdate: 'desc' },
  })
  return row?.cat ?? null
}

async function loadEmployeeDetails(
  matric: string,
  appyear: number,
): Promise<AppraisalDetail['employee']> {
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
  const rawSectionId = sectionRow?.tbl_section_id
  if (rawSectionId != null && rawSectionId !== '' && rawSectionId !== '0') {
    const sectionPk = Number(rawSectionId)
    if (Number.isInteger(sectionPk)) {
      const section = await prisma.tbl_section.findUnique({
        where: { id: sectionPk },
      })
      sectionName = section?.section ?? null
    }
  }

  const serviceYears = computeServiceYears(person?.date_eng, appyear)

  return {
    section: sectionName,
    designation: designationRow?.design ?? null,
    dateEngaged: toDateOnly(person?.date_eng),
    dateOfBirth: toDateOnly(person?.date_birth),
    presentAge: ageFrom(person?.date_birth),
    lengthService: formatLengthOfService(serviceYears),
  }
}

export async function resolveMatricLookup(
  matric: string,
  appyear: number,
  mode: MatricLookupMode = 'create',
): Promise<MatricLookupResult> {
  const trimmed = matric.trim()
  const person = await prisma.tbl_personel_list.findUnique({
    where: { matric: trimmed },
  })

  if (!person) {
    throw new PersonnelNotFoundError(trimmed)
  }

  const [employee, personnelCategory, awards, currentYearAppraisal] =
    await Promise.all([
      loadEmployeeDetails(trimmed, appyear),
      loadPersonnelCategory(trimmed, appyear),
      loadAwards(),
      getAppraisalForYear(trimmed, appyear),
    ])

  const names = person.names ?? null

  if (currentYearAppraisal) {
    const detail = appraisalToDetail(currentYearAppraisal, names, employee)
    const priorSnapshot = await getPriorYearSnapshot(trimmed, appyear)
    const scenario = resolveAwardEligibilityScenario({
      serviceYears: computeServiceYears(person.date_eng, appyear),
      priorYearAppraisal: priorSnapshot,
      currentYearAppraisal: toDateSnapshot(currentYearAppraisal),
    })
    return {
      ...detail,
      eligibleAwardIds: resolveEligibleAwardIds(awards, scenario),
    }
  }

  if (mode === 'edit') {
    const emptyDetail: AppraisalDetail = {
      id: null,
      appyear,
      matric: trimmed,
      names,
      preCat: null,
      proCat: null,
      dateLmerit: null,
      dateLstat: null,
      dateLpro: null,
      awardId: null,
      lengthservice: employee.lengthService,
      employee,
    }
    return {
      ...emptyDetail,
      eligibleAwardIds: resolveEligibleAwardIds(awards, 'no_history'),
    }
  }

  const serviceYears = computeServiceYears(person.date_eng, appyear)
  const priorSnapshot = await getPriorYearSnapshot(trimmed, appyear)

  const scenario = resolveAwardEligibilityScenario({
    serviceYears,
    priorYearAppraisal: priorSnapshot,
    currentYearAppraisal: null,
  })

  const dates = resolveDatePrefill({
    scenario,
    appyear,
    source: priorSnapshot,
  })

  const lengthservice = employee.lengthService

  return {
    id: null,
    appyear,
    matric: trimmed,
    names,
    preCat: personnelCategory,
    proCat: null,
    dateLmerit: dates.dateLmerit,
    dateLstat: dates.dateLstat,
    dateLpro: dates.dateLpro,
    awardId: null,
    lengthservice,
    employee,
    eligibleAwardIds: resolveEligibleAwardIds(awards, scenario),
  }
}
