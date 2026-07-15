import type { BindParams, Database } from 'sql.js'

// sql.js's own row type is loosely typed (SqlValue keyed by column name);
// these two helpers add the generic so query call sites read like normal
// typed SQL, and centralize statement cleanup (stmt.free()) so callers
// can't forget it.

export function queryAll<T>(db: Database, sql: string, params?: BindParams): T[] {
  const stmt = db.prepare(sql)
  try {
    if (params) stmt.bind(params)
    const rows: T[] = []
    while (stmt.step()) {
      rows.push(stmt.getAsObject() as T)
    }
    return rows
  } finally {
    stmt.free()
  }
}

export function queryOne<T>(
  db: Database,
  sql: string,
  params?: BindParams,
): T | undefined {
  return queryAll<T>(db, sql, params)[0]
}
