/**
 * An in-memory stand-in for record tools in unit tests: equality `where`,
 * newest first, `limit`. Only what the privacy and digest tests need.
 */

interface Row {
  recordId: string
  createdBy: string
  createdAt: string
  updatedAt: string
  data: Record<string, unknown>
}

const ok = <T,>(data: T) => ({ success: true as const, data })
const missing = { success: false as const, error: 'not found' }

export function fakeStore(seed: Record<string, Array<Partial<Row> & { data: Record<string, unknown> }>> = {}) {
  const rows = new Map<string, Row[]>()
  let n = 0
  const add = (collection: string, row: Partial<Row> & { data: Record<string, unknown> }) => {
    const full: Row = {
      recordId: row.recordId ?? `r${++n}`,
      createdBy: row.createdBy ?? 'owner',
      createdAt: row.createdAt ?? new Date(Date.UTC(2026, 0, 1, 0, 0, n)).toISOString(),
      updatedAt: row.updatedAt ?? '',
      data: { ...row.data },
    }
    rows.set(collection, [...(rows.get(collection) ?? []), full])
    return full
  }
  for (const [collection, list] of Object.entries(seed)) list.forEach((row) => add(collection, row))

  const tools = {
    async query(collection: string, options: { where?: Record<string, unknown>; limit?: number } = {}) {
      const matched = (rows.get(collection) ?? [])
        .filter((r) =>
          Object.entries(options.where ?? {}).every(([k, v]) =>
            k === 'recordId' ? r.recordId === v : k === 'createdBy' ? r.createdBy === v : r.data[k] === v,
          ),
        )
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, options.limit ?? Infinity)
      return ok({ records: matched, count: matched.length })
    },
    async get(collection: string, recordId: string) {
      const row = (rows.get(collection) ?? []).find((r) => r.recordId === recordId)
      return row ? ok({ record: row }) : missing
    },
    async create(collection: string, data: Record<string, unknown>) {
      return ok({ recordId: add(collection, { data }).recordId })
    },
    async update(collection: string, recordId: string, data: Record<string, unknown>) {
      const row = (rows.get(collection) ?? []).find((r) => r.recordId === recordId)
      if (!row) return missing
      Object.assign(row.data, data)
      return ok({ recordId })
    },
  }
  return { tools: tools as never, rows: (collection: string) => rows.get(collection) ?? [] }
}
