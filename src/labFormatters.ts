type LabTemplateId = 'ust-cbc' | 'ust-urinalysis' | 'ust-electrolytes' | 'ust-abg' | 'others'

const ULN_KEY_PREFIX = '__uln:'
const NORMAL_RANGE_KEY_PREFIX = '__nv:'

const BLOOD_CHEM_FIELDS = [
  'Sodium', 'Potassium', 'Chloride', 'Magnesium', 'Ionized Calcium', 'BUN', 'Creatinine', 'eGFR',
  'AST', 'ALT', 'ALP', 'Total Bilirubin', 'Direct Bilirubin', 'Indirect Bilirubin', 'Total Protein',
  'Albumin', 'Globulin', 'Cholesterol', 'Triglycerides', 'HDL', 'LDL', 'VLDL', 'HbA1c',
  'Fasting Plasma Glucose', 'LDH', 'D-Dimer', 'ESR', 'CRP', 'TSH', 'FT4', 'FT3',
] as const

const CBC_FIELDS = [
  'RBC', 'Hgb', 'Hct', 'MCV', 'MCH', 'MCHC', 'RDW', 'Plt', 'MPV', 'WBC', 'N', 'Metamyelocytes', 'Bands',
  'S', 'L', 'M', 'E', 'B', 'Blasts', 'Myelocytes', 'MDW',
] as const

const ULN_FIELDS = new Set(['AST', 'ALT', 'Total Bilirubin', 'Direct Bilirubin', 'Indirect Bilirubin', 'LDH', 'D-Dimer', 'ESR', 'CRP'])
const NV_FIELDS = new Set(['TSH', 'FT3', 'FT4'])

const BLOOD_CHEM_LABELS: Record<string, string> = {
  Sodium: 'Na',
  Potassium: 'K',
  Chloride: 'Cl',
  Creatinine: 'Crea',
  'Total Bilirubin': 'TB',
  'Direct Bilirubin': 'DB',
  'Indirect Bilirubin': 'IB',
}

const UA_MARKER_DEFAULTS: Record<string, string> = {
  Albumin: 'neg',
  Sugar: 'neg',
  Leukocytes: 'neg',
  Erythrocytes: 'neg',
  Bilirubin: 'neg',
  Nitrite: 'neg',
  Ketone: 'neg',
  Yeast: 'neg',
  Squamous: 'neg',
  Renal: 'neg',
  TEC: 'neg',
  Bacteria: 'neg',
  Mucus: 'neg',
  Hyaline: 'neg',
  Granular: 'neg',
  Waxy: 'neg',
  'RBC Cast': 'neg',
  'WBC Cast': 'neg',
  'Amorphous Urates': 'neg',
  'Uric Acid': 'neg',
  'Calcium Oxalate': 'neg',
  'Amorphous Phosphates': 'neg',
  'Triple Phosphate': 'neg',
}

const trimValue = (value: string | undefined) => (value ?? '').trim()

const ABG_PO2_KEY = 'pO2'
const ABG_ACTUAL_FIO2_KEY = 'Actual FiO2'
const ABG_PF_RATIO_KEY = 'pO2/FiO2'
const ABG_TARGET_PAO2 = 60

const parseNumericInput = (value: string | undefined): number | null => {
  const sanitized = trimValue(value).replaceAll(',', '').replaceAll('%', '')
  if (!sanitized) return null
  const parsed = Number.parseFloat(sanitized)
  return Number.isFinite(parsed) ? parsed : null
}

const format1 = (value: number) => Number.parseFloat(value.toFixed(1)).toString()
const format2 = (value: number) => Number.parseFloat(value.toFixed(2)).toString()

const valOr = (results: Record<string, string>, key: string, fallback = '') => {
  const value = trimValue(results[key])
  if (value) return value
  return fallback
}

const getUlnKey = (testKey: string) => `${ULN_KEY_PREFIX}${testKey}`
const getNormalRangeKey = (testKey: string) => `${NORMAL_RANGE_KEY_PREFIX}${testKey}`

const withUlnSuffix = (field: string, value: string, results: Record<string, string>) => {
  if (!ULN_FIELDS.has(field)) return ''
  const numericValue = parseNumericInput(value)
  const uln = parseNumericInput(results[getUlnKey(field)])
  if (numericValue === null || uln === null || uln <= 0) return ''
  const multiplier = numericValue / uln
  if (multiplier <= 1) return ''
  return ` (${format1(multiplier)}x ULN)`
}

const formatCasts = (results: Record<string, string>) => {
  const keys = ['Hyaline', 'Granular', 'Waxy', 'RBC Cast', 'WBC Cast']
  const positives = keys
    .map((key) => ({ key, value: valOr(results, key, 'neg') }))
    .filter(({ value }) => !['neg', '0', '-'].includes(value.toLowerCase()))
  if (positives.length === 0) return 'Casts neg'
  return `Casts ${positives.map(({ key, value }) => `${key} ${value}`).join(' / ')}`
}

const formatCrystals = (results: Record<string, string>) => {
  const keys = ['Amorphous Urates', 'Uric Acid', 'Calcium Oxalate', 'Amorphous Phosphates', 'Triple Phosphate']
  const positives = keys
    .map((key) => ({ key, value: valOr(results, key, 'neg') }))
    .filter(({ value }) => !['neg', '0', '-'].includes(value.toLowerCase()))
  if (positives.length === 0) return 'Crystals neg'
  return `Crystals ${positives.map(({ key, value }) => `${key} ${value}`).join(' / ')}`
}

const validateUrinalysisRequired = (results: Record<string, string>) => {
  const missing: string[] = []
  const requiredKeys = [
    ['Color', 'Color'],
    ['Transparency', 'Appearance'],
    ['pH', 'pH'],
    ['Specific Gravity', 'SG'],
    ['RBC', 'RBC'],
    ['Pus', 'Pus'],
  ] as const
  requiredKeys.forEach(([key, label]) => {
    if (!trimValue(results[key])) missing.push(label)
  })
  if (missing.length > 0) {
    throw new Error(`Urinalysis missing required fields: ${missing.join(', ')}`)
  }
}

export function formatUrinalysis(results: Record<string, string>): string {
  const safe = { ...results }
  const parts = [
    valOr(safe, 'Color', ''),
    valOr(safe, 'Transparency', ''),
    `pH ${valOr(safe, 'pH', '')}`,
    `SG ${valOr(safe, 'Specific Gravity', '')}`,
    `Alb ${valOr(safe, 'Albumin', UA_MARKER_DEFAULTS.Albumin)}`,
    `Sugar ${valOr(safe, 'Sugar', UA_MARKER_DEFAULTS.Sugar)}`,
    `Leu ${valOr(safe, 'Leukocytes', UA_MARKER_DEFAULTS.Leukocytes)}`,
    `Eryth ${valOr(safe, 'Erythrocytes', UA_MARKER_DEFAULTS.Erythrocytes)}`,
    `Bili ${valOr(safe, 'Bilirubin', UA_MARKER_DEFAULTS.Bilirubin)}`,
    `Nitrite ${valOr(safe, 'Nitrite', UA_MARKER_DEFAULTS.Nitrite)}`,
    `Ketone ${valOr(safe, 'Ketone', UA_MARKER_DEFAULTS.Ketone)}`,
    `Urobili ${valOr(safe, 'Urobilinogen', 'normal')}`,
    `RBC ${valOr(safe, 'RBC', '')}`,
    `Pus ${valOr(safe, 'Pus', '')}`,
    `Yeast ${valOr(safe, 'Yeast', UA_MARKER_DEFAULTS.Yeast)}`,
    `Squamous ${valOr(safe, 'Squamous', UA_MARKER_DEFAULTS.Squamous)}`,
    `Renal ${valOr(safe, 'Renal', UA_MARKER_DEFAULTS.Renal)}`,
    `TEC ${valOr(safe, 'TEC', UA_MARKER_DEFAULTS.TEC)}`,
    `Bacteria ${valOr(safe, 'Bacteria', UA_MARKER_DEFAULTS.Bacteria)}`,
    `Mucus ${valOr(safe, 'Mucus', UA_MARKER_DEFAULTS.Mucus)}`,
    formatCasts(safe),
    formatCrystals(safe),
  ].filter(Boolean)

  return parts.join(', ')
}

export function formatUrinalysisStrict(results: Record<string, string>): string {
  validateUrinalysisRequired(results)
  return formatUrinalysis(results)
}

const getBloodChemResult = (results: Record<string, string>, field: string) => {
  const direct = trimValue(results[field])
  if (direct) return direct
  const alias = BLOOD_CHEM_LABELS[field]
  if (!alias) return ''
  return trimValue(results[alias])
}

export function formatBloodChemistry(results: Record<string, string>): string {
  const parts: string[] = []
  BLOOD_CHEM_FIELDS.forEach((field) => {
    const value = getBloodChemResult(results, field)
    if (!value) return
    const label = BLOOD_CHEM_LABELS[field] ?? field
    const ulnSuffix = withUlnSuffix(field, value, results)
    const nv = NV_FIELDS.has(field) ? trimValue(results[getNormalRangeKey(field)]) : ''
    const nvSuffix = nv ? ` (NV ${nv})` : ''
    parts.push(`${label} ${value}${ulnSuffix}${nvSuffix}`)
  })
  return parts.length > 0 ? parts.join(', ') : '-'
}

const formatCbcSingle = (results: Record<string, string>) => {
  const parts = CBC_FIELDS
    .map((field) => {
      const value = trimValue(results[field])
      if (!value) return null
      return `${field} ${value}`
    })
    .filter((value): value is string => value !== null)
  return parts.length > 0 ? parts.join(', ') : '-'
}

const isPositiveUaValue = (value: string) => {
  const normalized = value.trim().toLowerCase()
  if (!normalized) return false
  return !['neg', 'normal', '0', '-', 'none'].includes(normalized)
}

const uaCompareValue = (newValue: string, oldValue: string, numeric = false) => {
  if (!oldValue) return `${newValue} (-)`
  if (numeric) return `${newValue} (${oldValue})`
  return `${newValue} (${isPositiveUaValue(oldValue) ? '+' : '-'})`
}

const formatUrinalysisComparison = (newer: Record<string, string>, older: Record<string, string>) => {
  validateUrinalysisRequired(newer)
  const newerLine = formatUrinalysis(newer)
  const labels = newerLine.split(', ').map((segment) => segment.trim()).filter(Boolean)

  const replacements: Array<[string, string]> = [
    ['Alb', 'Albumin'],
    ['Sugar', 'Sugar'],
    ['Leu', 'Leukocytes'],
    ['Eryth', 'Erythrocytes'],
    ['Bili', 'Bilirubin'],
    ['Nitrite', 'Nitrite'],
    ['Ketone', 'Ketone'],
    ['Urobili', 'Urobilinogen'],
    ['RBC', 'RBC'],
    ['Pus', 'Pus'],
    ['Bacteria', 'Bacteria'],
  ]

  const mapped = labels.map((item) => {
    const matched = replacements.find(([label]) => item.startsWith(`${label} `))
    if (!matched) return item
    const [label, key] = matched
    const newValue = item.slice(label.length + 1)
    const oldValue = trimValue(older[key])
    const numeric = label === 'RBC' || label === 'Pus'
    return `${label} ${uaCompareValue(newValue, oldValue, numeric)}`
  })

  return mapped.join(', ')
}

const formatSodiumComparison = (newer: Record<string, string>, older: Record<string, string>, elapsedHours: number) => {
  const newerNa = parseNumericInput(getBloodChemResult(newer, 'Sodium'))
  const olderNa = parseNumericInput(getBloodChemResult(older, 'Sodium'))
  if (newerNa === null || olderNa === null) return ''
  const diff = newerNa - olderNa
  const roundedHours = Math.round(elapsedHours * 2) / 2
  const durationLabel = roundedHours >= 24
    ? `${format1(roundedHours / 24)} days`
    : `${format1(roundedHours)} hours`
  const sign = diff >= 0 ? `+${format1(diff)}` : `${format1(diff)}`
  return `Na ${format1(newerNa)} (${format1(olderNa)}) ${sign} in ${durationLabel}`
}

const formatBloodChemComparison = (
  newer: Record<string, string>,
  older: Record<string, string>,
  elapsedHours: number,
) => {
  const lines: string[] = []

  const sodiumLine = formatSodiumComparison(newer, older, elapsedHours)
  if (sodiumLine) lines.push(sodiumLine)

  BLOOD_CHEM_FIELDS.forEach((field) => {
    if (field === 'Sodium') return
    const newValue = getBloodChemResult(newer, field)
    if (!newValue) return
    const oldValue = getBloodChemResult(older, field)
    const label = BLOOD_CHEM_LABELS[field] ?? field

    if (NV_FIELDS.has(field)) {
      const nv = trimValue(newer[getNormalRangeKey(field)])
      lines.push(`${label} ${newValue}${oldValue ? ` (${oldValue})` : ''}${nv ? ` (NV ${nv})` : ''}`)
      return
    }

    if (ULN_FIELDS.has(field)) {
      const newMultiplier = withUlnSuffix(field, newValue, newer)
      const oldMultiplier = withUlnSuffix(field, oldValue, older)
      const newNumeric = parseNumericInput(newValue)
      const newUln = parseNumericInput(newer[getUlnKey(field)])
      const newerElevated = newNumeric !== null && newUln !== null && newUln > 0 && newNumeric / newUln > 1
      if (newerElevated) {
        if (!oldValue) {
          lines.push(`${label} ${newValue}${newMultiplier}`)
          return
        }
        lines.push(`${label} ${newValue}${newMultiplier} [${oldValue}${oldMultiplier ? `, ${oldMultiplier.replace(/[()]/g, '')}` : ''}]`)
        return
      }
    }

    if (!oldValue) {
      lines.push(`${label} ${newValue}`)
      return
    }
    lines.push(`${label} ${newValue} (${oldValue})`)
  })

  return lines.join(', ')
}

const formatCbcComparison = (newer: Record<string, string>, older: Record<string, string>) => {
  const lines = CBC_FIELDS
    .map((field) => {
      const newValue = trimValue(newer[field])
      if (!newValue) return null
      const oldValue = trimValue(older[field])
      return oldValue ? `${field} ${newValue} (${oldValue})` : `${field} ${newValue}`
    })
    .filter((value): value is string => value !== null)
  return lines.length > 0 ? lines.join(', ') : '-'
}

const getAbgDerivedValues = (results: Record<string, string>) => {
  const paO2Raw = trimValue(results[ABG_PO2_KEY])
  const actualFiO2Raw = trimValue(results[ABG_ACTUAL_FIO2_KEY])
  const paO2 = parseNumericInput(paO2Raw)
  const actualFiO2 = parseNumericInput(actualFiO2Raw)

  const pfRatio =
    paO2 !== null && actualFiO2 !== null && actualFiO2 > 0
      ? format2(paO2 / (actualFiO2 / 100))
      : trimValue(results[ABG_PF_RATIO_KEY])

  const shouldShowDesiredFiO2 =
    paO2 !== null &&
    paO2 > 0 &&
    actualFiO2 !== null &&
    (actualFiO2 > 21 || paO2 < 60)

  const desiredFiO2 = shouldShowDesiredFiO2
    ? format2((actualFiO2 * ABG_TARGET_PAO2) / paO2)
    : ''

  const desiredFiO2Line = shouldShowDesiredFiO2
    ? `Desired FiO2 = (FiO2 × ${ABG_TARGET_PAO2}) / pO2 = (${actualFiO2Raw} × ${ABG_TARGET_PAO2}) / ${paO2Raw} = ${desiredFiO2}`
    : ''

  return {
    pfRatio,
    desiredFiO2Line,
  }
}

const formatAbgSingle = (results: Record<string, string>) => {
  const preferred = ['pH', 'pCO2', 'pO2', 'HCO3', 'a/A', 'A-aDO2']
  const lines = preferred
    .map((field) => {
      const value = trimValue(results[field])
      if (!value) return null
      return `${field} ${value}`
    })
    .filter((value): value is string => value !== null)

  const { pfRatio, desiredFiO2Line } = getAbgDerivedValues(results)
  if (pfRatio) {
    lines.push(`${ABG_PF_RATIO_KEY} ${pfRatio}`)
  }

  const mainLine = lines.join(', ')
  if (!mainLine && !desiredFiO2Line) return '-'
  if (!mainLine) return desiredFiO2Line
  if (!desiredFiO2Line) return mainLine
  return `${mainLine}\n\n${desiredFiO2Line}`
}

const formatAbgComparison = (newer: Record<string, string>, older: Record<string, string>) => {
  const newerDerived = getAbgDerivedValues(newer)
  const olderDerived = getAbgDerivedValues(older)
  const lines: string[] = []

  const ordered = ['pH', 'pCO2', 'pO2', 'HCO3', 'a/A', 'A-aDO2']
  ordered.forEach((field) => {
    const newValue = trimValue(newer[field])
    if (!newValue) return
    const oldValue = trimValue(older[field])
    lines.push(oldValue ? `${field} ${newValue} (${oldValue})` : `${field} ${newValue}`)
  })

  if (newerDerived.pfRatio) {
    const olderPfRatio = olderDerived.pfRatio
    lines.push(olderPfRatio ? `${ABG_PF_RATIO_KEY} ${newerDerived.pfRatio} (${olderPfRatio})` : `${ABG_PF_RATIO_KEY} ${newerDerived.pfRatio}`)
  }

  const mainLine = lines.join(', ')
  if (!mainLine && !newerDerived.desiredFiO2Line) return '-'
  if (!mainLine) return newerDerived.desiredFiO2Line
  if (!newerDerived.desiredFiO2Line) return mainLine
  return `${mainLine}\n\n${newerDerived.desiredFiO2Line}`
}

export const formatLabSingleReport = (templateId: LabTemplateId, results: Record<string, string>) => {
  if (templateId === 'ust-cbc') return formatCbcSingle(results)
  if (templateId === 'ust-urinalysis') return formatUrinalysisStrict(results)
  if (templateId === 'ust-electrolytes') return formatBloodChemistry(results)
  if (templateId === 'ust-abg') return formatAbgSingle(results)
  const freeform = trimValue(results.__freeformResult)
  return freeform || '-'
}

export const formatLabComparisonReport = (
  templateId: LabTemplateId,
  newer: Record<string, string>,
  older: Record<string, string>,
  elapsedHours: number,
) => {
  if (templateId === 'ust-cbc') return formatCbcComparison(newer, older)
  if (templateId === 'ust-urinalysis') return formatUrinalysisComparison(newer, older)
  if (templateId === 'ust-electrolytes') return formatBloodChemComparison(newer, older, elapsedHours)
  if (templateId === 'ust-abg') return formatAbgComparison(newer, older)
  const newValue = trimValue(newer.__freeformResult)
  const oldValue = trimValue(older.__freeformResult)
  if (!newValue && !oldValue) return '-'
  if (!oldValue) return newValue || '-'
  return `${newValue || '-'} (${oldValue})`
}
