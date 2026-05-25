#!/usr/bin/env node
// Downloads the full Philippine Standard Geographic Code (PSGC) dataset from
// https://psgc.gitlab.io/api and writes a minimal {code, name, parentCode}
// projection per level into src/renderer/src/data/psgc/. The renderer reads
// these JSON files directly so the cascading address selectors work offline
// and instantly — no runtime fetches.
//
// Re-run this script (`npm run fetch:psgc`) whenever the upstream PSGC dataset
// changes (the PSA usually publishes quarterly updates).

import { mkdirSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const BASE = 'https://psgc.gitlab.io/api'
const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, '..', 'src', 'renderer', 'src', 'data', 'psgc')

mkdirSync(outDir, { recursive: true })

async function getJson(path) {
  const url = `${BASE}${path}`
  const r = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!r.ok) throw new Error(`PSGC ${r.status}: ${url}`)
  return r.json()
}

function pick(rows, keys) {
  return rows.map((row) => {
    const o = {}
    for (const k of keys) if (row[k] != null && row[k] !== '') o[k] = row[k]
    return o
  })
}

function write(name, rows) {
  const path = join(outDir, `${name}.json`)
  writeFileSync(path, JSON.stringify(rows))
  const kb = (Buffer.byteLength(JSON.stringify(rows)) / 1024).toFixed(1)
  console.log(`  wrote ${name}.json — ${rows.length} rows, ${kb} KB`)
}

async function main() {
  console.log('Fetching PSGC dataset…')

  const regions = await getJson('/regions/')
  write('regions', pick(regions, ['code', 'name', 'regionName']))

  const provinces = await getJson('/provinces/')
  write('provinces', pick(provinces, ['code', 'name', 'regionCode']))

  const districts = await getJson('/districts/')
  write('districts', pick(districts, ['code', 'name', 'regionCode']))

  const cities = await getJson('/cities-municipalities/')
  write(
    'cities-municipalities',
    pick(cities, ['code', 'name', 'provinceCode', 'districtCode', 'regionCode'])
  )

  const barangays = await getJson('/barangays/')
  write(
    'barangays',
    pick(barangays, ['code', 'name', 'cityCode', 'municipalityCode', 'subMunicipalityCode'])
  )

  console.log(`Done. Files written to ${outDir}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
