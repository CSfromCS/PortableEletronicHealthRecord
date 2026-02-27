import { formatBloodChemistry, formatUrinalysis } from '../../labFormatters'

export type LabTemplateTest = {
  key: string
  fullName?: string
  unit?: string
  section?: string
  requiresUln?: boolean
  requiresNormalRange?: boolean
}

export type LabTemplate = {
  id: string
  name: string
  tests: LabTemplateTest[]
  formatReport?: (results: Record<string, string>) => string
}

export const OTHERS_LAB_TEMPLATE_ID = 'others'
export const OTHERS_LABEL_KEY = '__customLabel'
export const OTHERS_RESULT_KEY = '__freeformResult'
export const UST_BLOOD_CHEM_TEMPLATE_ID = 'ust-electrolytes'
export const UST_ABG_TEMPLATE_ID = 'ust-abg'
export const ABG_PO2_KEY = 'pO2'
export const ABG_ACTUAL_FIO2_KEY = 'Actual FiO2'
export const ABG_PF_RATIO_KEY = 'pO2/FiO2'
export const ABG_DESIRED_FIO2_KEY = 'Desired FiO2'
export const DEFAULT_ABG_DESIRED_PAO2 = 60

const ULN_KEY_PREFIX = '__uln:'
const NORMAL_RANGE_KEY_PREFIX = '__nv:'

export const getUlnFieldKey = (testKey: string) => `${ULN_KEY_PREFIX}${testKey}`
export const getNormalRangeFieldKey = (testKey: string) => `${NORMAL_RANGE_KEY_PREFIX}${testKey}`

export const LAB_TEMPLATES: LabTemplate[] = [
  {
    id: 'ust-cbc',
    name: 'CBC',
    tests: [
      { key: 'RBC', fullName: 'RBC count', unit: 'x10^12/L' },
      { key: 'Hgb', fullName: 'Hemoglobin', unit: 'g/L' },
      { key: 'Hct', fullName: 'Hematocrit' },
      { key: 'MCV', fullName: 'Mean Cell Volume', unit: 'fL' },
      { key: 'MCH', fullName: 'Mean Cell Hemoglobin', unit: 'pg' },
      { key: 'MCHC', fullName: 'Mean Cell Hemoglobin Concentration', unit: 'g/dL' },
      { key: 'RDW', fullName: 'Red Cell Distribution Width', unit: '%' },
      { key: 'Plt', fullName: 'Platelet Count', unit: 'x10^9/L' },
      { key: 'MPV', fullName: 'Mean Platelet Volume', unit: 'fL' },
      { key: 'WBC', fullName: 'WBC Count', unit: 'x10^9/L' },
      { key: 'N', fullName: 'Neutrophils' },
      { key: 'Metamyelocytes' },
      { key: 'Bands' },
      { key: 'S', fullName: 'Segmenters' },
      { key: 'L', fullName: 'Lymphocytes' },
      { key: 'M', fullName: 'Monocytes' },
      { key: 'E', fullName: 'Eosinophils' },
      { key: 'B', fullName: 'Basophils' },
      { key: 'Blasts' },
      { key: 'Myelocytes' },
      { key: 'MDW', fullName: 'Monocyte Distribution Width' },
    ],
  },
  {
    id: 'ust-urinalysis',
    name: 'Urinalysis',
    formatReport: formatUrinalysis,
    tests: [
      { key: 'Color', section: 'Physical' },
      { key: 'Transparency', section: 'Physical' },
      { key: 'pH', section: 'Chemical' },
      { key: 'Specific Gravity', section: 'Chemical' },
      { key: 'Albumin', section: 'Chemical' },
      { key: 'Sugar', section: 'Chemical' },
      { key: 'Leukocytes', section: 'Chemical' },
      { key: 'Erythrocytes', section: 'Chemical' },
      { key: 'Bilirubin', section: 'Chemical' },
      { key: 'Nitrite', section: 'Chemical' },
      { key: 'Ketone', section: 'Chemical' },
      { key: 'Urobilinogen', section: 'Chemical' },
      { key: 'RBC', section: 'Microscopic' },
      { key: 'Pus', section: 'Microscopic' },
      { key: 'Yeast', section: 'Microscopic' },
      { key: 'Squamous', section: 'Microscopic' },
      { key: 'Renal', section: 'Microscopic' },
      { key: 'TEC', section: 'Microscopic' },
      { key: 'Bacteria', section: 'Microscopic' },
      { key: 'Mucus', section: 'Microscopic' },
      { key: 'Amorphous Urates', section: 'Crystals' },
      { key: 'Uric Acid', section: 'Crystals' },
      { key: 'Calcium Oxalate', section: 'Crystals' },
      { key: 'Amorphous Phosphates', section: 'Crystals' },
      { key: 'Triple Phosphate', section: 'Crystals' },
      { key: 'Hyaline', section: 'Casts' },
      { key: 'Granular', section: 'Casts' },
      { key: 'Waxy', section: 'Casts' },
      { key: 'RBC Cast', section: 'Casts' },
      { key: 'WBC Cast', section: 'Casts' },
    ],
  },
  {
    id: UST_BLOOD_CHEM_TEMPLATE_ID,
    name: 'Blood Chemistry',
    formatReport: formatBloodChemistry,
    tests: [
      { key: 'Sodium' },
      { key: 'Potassium' },
      { key: 'Chloride' },
      { key: 'Magnesium' },
      { key: 'Ionized Calcium' },
      { key: 'BUN' },
      { key: 'Creatinine' },
      { key: 'eGFR' },
      { key: 'AST', requiresUln: true },
      { key: 'ALT', requiresUln: true },
      { key: 'ALP' },
      { key: 'Total Bilirubin', requiresUln: true },
      { key: 'Direct Bilirubin', requiresUln: true },
      { key: 'Indirect Bilirubin', requiresUln: true },
      { key: 'Total Protein' },
      { key: 'Albumin' },
      { key: 'Globulin' },
      { key: 'Cholesterol' },
      { key: 'Triglycerides' },
      { key: 'HDL' },
      { key: 'LDL' },
      { key: 'VLDL' },
      { key: 'HbA1c' },
      { key: 'Fasting Plasma Glucose' },
      { key: 'LDH', requiresUln: true },
      { key: 'D-Dimer', requiresUln: true },
      { key: 'ESR', requiresUln: true },
      { key: 'CRP', requiresUln: true },
      { key: 'TSH', requiresNormalRange: true },
      { key: 'FT4', requiresNormalRange: true },
      { key: 'FT3', requiresNormalRange: true },
    ],
  },
  {
    id: UST_ABG_TEMPLATE_ID,
    name: 'ABG (Arterial Blood Gas)',
    tests: [
      { key: 'pH' },
      { key: 'pCO2', unit: 'mmHg' },
      { key: 'pO2', unit: 'mmHg' },
      { key: 'HCO3', unit: 'mmol/L' },
      { key: 'a/A' },
      { key: 'A-aDO2', unit: 'mmHg' },
      { key: 'Actual FiO2', unit: '%' },
      { key: 'pO2/FiO2' },
      { key: 'Desired FiO2', unit: '%' },
    ],
  },
  {
    id: OTHERS_LAB_TEMPLATE_ID,
    name: 'Others',
    tests: [],
  },
]

export const DEFAULT_LAB_TEMPLATE_ID = LAB_TEMPLATES[0].id
