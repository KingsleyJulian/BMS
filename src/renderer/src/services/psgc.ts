// Lightweight wrapper around the public Philippine Standard Geographic Code
// API (https://psgc.gitlab.io/api). Provinces, cities/municipalities, and
// barangays are fetched on demand and cached for the session so the cascading
// Province → City → Barangay selectors don't refetch on every reopen.
//
// All fetchers reject on non-2xx so the caller can degrade to free-text
// inputs when offline. Caches are keyed by parent code to keep memory bounded.

const BASE = 'https://psgc.gitlab.io/api'

export interface PsgcEntry {
  code: string
  name: string
}

interface PsgcRaw {
  code: string
  name: string
}

const sortByName = (a: PsgcEntry, b: PsgcEntry): number => a.name.localeCompare(b.name)

function normalize(items: PsgcRaw[]): PsgcEntry[] {
  return items
    .map((d) => ({ code: d.code, name: d.name }))
    .sort(sortByName)
}

let provincesPromise: Promise<PsgcEntry[]> | null = null
const citiesByProvince = new Map<string, Promise<PsgcEntry[]>>()
const barangaysByCity = new Map<string, Promise<PsgcEntry[]>>()

async function fetchJson<T>(url: string): Promise<T> {
  const r = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!r.ok) throw new Error(`PSGC ${r.status}: ${url}`)
  return (await r.json()) as T
}

export function fetchProvinces(): Promise<PsgcEntry[]> {
  if (!provincesPromise) {
    provincesPromise = fetchJson<PsgcRaw[]>(`${BASE}/provinces/`)
      .then(normalize)
      .catch((e) => {
        provincesPromise = null
        throw e
      })
  }
  return provincesPromise
}

export function fetchCities(provinceCode: string): Promise<PsgcEntry[]> {
  let p = citiesByProvince.get(provinceCode)
  if (!p) {
    p = fetchJson<PsgcRaw[]>(
      `${BASE}/provinces/${provinceCode}/cities-municipalities/`
    )
      .then(normalize)
      .catch((e) => {
        citiesByProvince.delete(provinceCode)
        throw e
      })
    citiesByProvince.set(provinceCode, p)
  }
  return p
}

export function fetchBarangays(cityCode: string): Promise<PsgcEntry[]> {
  let p = barangaysByCity.get(cityCode)
  if (!p) {
    p = fetchJson<PsgcRaw[]>(`${BASE}/cities-municipalities/${cityCode}/barangays/`)
      .then(normalize)
      .catch((e) => {
        barangaysByCity.delete(cityCode)
        throw e
      })
    barangaysByCity.set(cityCode, p)
  }
  return p
}
