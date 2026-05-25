/**
 * Convert a residency duration in months into a human-readable phrase.
 *
 * The input field is labelled "Years of Residency" but accepts decimal
 * months — e.g. 0.5 → half a month, 12 → 1 year, 13 → 1 year and 1 month —
 * matching the examples given in the spec.
 *
 * Returns an empty string for non-positive input so the UI can hide the
 * preview row when the field is empty.
 */
export function residencyToWords(months: number, brgyName: string): string {
  if (!Number.isFinite(months) || months <= 0) return ''

  const phrase = monthsToPhrase(months)
  const tail = phrase ? `for ${phrase}` : 'for less than a month'
  return `Has been residing in Barangay ${brgyName} ${tail}.`
}

export function monthsToPhrase(months: number): string {
  // Sub-month precision
  if (months < 1) return fractionMonthLabel(months)

  const years = Math.floor(months / 12)
  const remaining = months - years * 12
  const wholeMonths = Math.floor(remaining)
  const fracMonths = remaining - wholeMonths

  const parts: string[] = []
  if (years > 0) parts.push(plural(years, 'year', 'years'))

  if (wholeMonths > 0 && fracMonths > 0) {
    // e.g. 1 year and 1.5 months — collapse to "1 year and 1 and a half months"
    parts.push(combineWholeAndFracMonths(wholeMonths, fracMonths))
  } else if (wholeMonths > 0) {
    parts.push(plural(wholeMonths, 'month', 'months'))
  } else if (fracMonths > 0) {
    parts.push(fractionMonthLabel(fracMonths))
  }

  return parts.join(' and ')
}

function plural(n: number, singular: string, pluralForm: string): string {
  return `${n} ${n === 1 ? singular : pluralForm}`
}

function combineWholeAndFracMonths(whole: number, frac: number): string {
  if (Math.abs(frac - 0.5) < 0.05) {
    return whole === 1 ? '1 and a half months' : `${whole} and a half months`
  }
  if (Math.abs(frac - 0.25) < 0.05) return `${whole} and a quarter months`
  if (Math.abs(frac - 0.75) < 0.05) return `${whole} and three-quarter months`
  return `${(whole + frac).toFixed(2)} months`
}

function fractionMonthLabel(frac: number): string {
  if (Math.abs(frac - 0.5) < 0.05) return 'half a month'
  if (Math.abs(frac - 0.25) < 0.05) return 'a quarter of a month'
  if (Math.abs(frac - 0.75) < 0.05) return 'three quarters of a month'
  return `${frac.toFixed(2)} of a month`
}
