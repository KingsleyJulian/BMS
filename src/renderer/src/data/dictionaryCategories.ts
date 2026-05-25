export const DICTIONARY_CATEGORIES = [
  'RELIGION',
  'BLOCK',
  'STREET',
  'ZIP_CODE',
  'NATURE_OF_WORK',
  'OCCUPATION',
  'PURPOSE_OF_CLEARANCE'
] as const

export type DictionaryCategory = (typeof DICTIONARY_CATEGORIES)[number]

export const CATEGORY_LABELS: Record<DictionaryCategory, string> = {
  RELIGION: 'Religion',
  BLOCK: 'Block',
  STREET: 'Street',
  ZIP_CODE: 'Zip Code',
  NATURE_OF_WORK: 'Nature of Work',
  OCCUPATION: 'Occupation',
  PURPOSE_OF_CLEARANCE: 'Purpose of Clearance'
}
