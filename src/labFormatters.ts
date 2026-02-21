/**
 * Lab report formatters
 *
 * Each lab template can optionally carry a `formatReport` function that
 * turns a `Record<string, string>` of user-entered values into a
 * single-line clinical report string.
 *
 * Templates WITHOUT a formatter fall back to the default
 * "key: value, key: value" concatenation in `buildStructuredLabLines`.
 *
 * This module exports named formatter functions so they can be unit-tested
 * independently of the React component tree.
 */

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

/** Return the value if non-empty, otherwise the provided default. */
const valOrDefault = (val: string | undefined, defaultVal: string): string => {
  const trimmed = (val ?? '').trim()
  return trimmed === '' ? defaultVal : trimmed
}

// ---------------------------------------------------------------------------
// UST – Urinalysis formatter
// ---------------------------------------------------------------------------

/**
 * Produces a single-line, comma-separated urinalysis report.
 *
 * See the full spec in the codebase docs — key rules:
 *  - Color & Transparency appear first, unlabelled.
 *  - Standard params use abbreviated labels.
 *  - Blank fields default to "neg" (except Urobilinogen → "normal";
 *    Color/Transparency/pH/SG must always have values).
 *  - Casts & Crystals use positive-first then grouped-negative notation.
 */
export function formatUrinalysis(r: Record<string, string>): string {
  const v = (key: string, def: string = 'neg'): string => valOrDefault(r[key], def)

  const parts: string[] = []

  // 1. Physical (unlabelled)
  parts.push(v('Color', ''))
  parts.push(v('Transparency', ''))

  // 2. Chemical — abbreviated labels
  parts.push(`pH ${v('pH', '')}`)
  parts.push(`SG ${v('Specific Gravity', '')}`)
  parts.push(`Alb ${v('Albumin')}`)
  parts.push(`Sugar ${v('Sugar')}`)
  parts.push(`Leu ${v('Leukocytes')}`)
  parts.push(`Eryth ${v('Erythrocytes')}`)
  parts.push(`Bili ${v('Bilirubin')}`)
  parts.push(`Nitrite ${v('Nitrite')}`)
  parts.push(`Ketone ${v('Ketone')}`)
  parts.push(`Urobili ${v('Urobilinogen', 'normal')}`)

  // 3. Casts — special grouping logic
  const castKeys: { key: string; label: string }[] = [
    { key: 'Hyaline', label: 'hyaline' },
    { key: 'Granular', label: 'granular' },
    { key: 'Waxy', label: 'waxy' },
    { key: 'RBC Cast', label: 'RBC' },
    { key: 'WBC Cast', label: 'WBC' },
  ]

  const positiveCasts = castKeys.filter((c) => {
    const val = (r[c.key] ?? '').trim()
    return val !== '' && val.toLowerCase() !== 'neg' && val !== '0'
  })
  const negativeCasts = castKeys.filter((c) => !positiveCasts.includes(c))

  if (positiveCasts.length === 0) {
    parts.push('Casts neg')
  } else {
    for (const c of positiveCasts) {
      parts.push(`${c.label} cast ${v(c.key)}`)
    }
    if (negativeCasts.length > 0) {
      parts.push(`${negativeCasts.map((c) => c.label).join('/')} cast neg`)
    }
  }

  // 4. Microscopic
  parts.push(`RBC ${v('RBC')}`)
  parts.push(`Pus ${v('Pus')}`)
  parts.push(`Yeast ${v('Yeast')}`)
  parts.push(`Squamous ${v('Squamous')}`)
  parts.push(`Renal ${v('Renal')}`)
  parts.push(`TEC ${v('TEC')}`)
  parts.push(`Bacteria ${v('Bacteria')}`)
  parts.push(`Mucus ${v('Mucus')}`)

  // 5. Crystals — special grouping logic
  const crystalKeys: { key: string; label: string }[] = [
    { key: 'Amorphous Urates', label: 'amorphous urates' },
    { key: 'Uric Acid', label: 'Uric acid' },
    { key: 'Calcium Oxalate', label: 'Calcium oxalate' },
    { key: 'Amorphous Phosphates', label: 'Amorphous phosphate' },
    { key: 'Triple Phosphate', label: 'Triple phosphate' },
  ]

  const positiveCrystals = crystalKeys.filter((c) => {
    const val = (r[c.key] ?? '').trim()
    return val !== '' && val.toLowerCase() !== 'neg' && val !== '0'
  })
  const negativeCrystals = crystalKeys.filter((c) => !positiveCrystals.includes(c))

  if (positiveCrystals.length === 0) {
    parts.push('Crystals neg')
  } else {
    for (const c of positiveCrystals) {
      parts.push(`${c.label} crystals ${v(c.key)}`)
    }
    if (negativeCrystals.length > 0) {
      parts.push(`${negativeCrystals.map((c) => c.label).join('/')} neg`)
    }
  }

  return parts.join(', ')
}
