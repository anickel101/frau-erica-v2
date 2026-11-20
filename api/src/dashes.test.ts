import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import { describe, expect, test } from 'vitest'

// The API's half of app/scripts/checkDashes.ts: no double hyphen standing
// in for a dash in anything a person can read. "please check it -- and
// try again" should read "please check it – and try again" (the spaced
// en dash, as the Archivist asked in 2026-11).
//
// app/ checks its built bundle, where minifying has already removed the
// comments. Nothing here is built in CI, so instead this reads the source
// with TypeScript's own parser and looks only at string literals: error
// messages, email bodies. Comments, which use "--" freely, are never
// strings. Tests and fixtures are skipped -- a test's name or a fixture's
// label is never shown to anyone.

const SRC = import.meta.dirname
const SKIP = /\.test\.ts$|testFixtures\.ts$|sqlWasmBase64\.ts$/

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return sourceFiles(full)
    return entry.name.endsWith('.ts') && !SKIP.test(entry.name) ? [full] : []
  })
}

function dashedStrings(file: string): string[] {
  const source = ts.createSourceFile(
    file,
    readFileSync(file, 'utf8'),
    ts.ScriptTarget.Latest,
  )
  const found: string[] = []
  const visit = (node: ts.Node) => {
    if (
      (ts.isStringLiteral(node) ||
        ts.isNoSubstitutionTemplateLiteral(node) ||
        ts.isTemplateHead(node) ||
        ts.isTemplateMiddle(node) ||
        ts.isTemplateTail(node)) &&
      / --( |$)/.test(node.text)
    ) {
      found.push(`${path.relative(SRC, file)}: ${node.text}`)
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return found
}

describe('visible text', () => {
  test('uses a spaced en dash, never a double hyphen', () => {
    const files = sourceFiles(SRC)
    expect(files.length).toBeGreaterThan(20) // the walk really found the source
    expect(files.flatMap(dashedStrings)).toEqual([])
  })
})
