// Checks that parallel-text pairs actually hold together, at export
// time, before anything reaches the site.
//
// This exists because of how the failure looks. The site renders a pair
// by position -- the nth German block beside the nth English one -- so
// a pair whose halves have drifted apart by a single block doesn't fail
// loudly. It renders, and quietly sets every paragraph from that point
// on against the wrong translation. Nobody reading only English would
// ever notice, which is precisely the audience most of this site has.
//
// So the export refuses to run rather than ship that. The archive is
// hand-edited in a database browser, the two halves are separate rows,
// and nothing in SQLite can stop someone adding a paragraph to one and
// not the other -- which makes this the only place the invariant can be
// enforced.

import { toBlocks } from './parallelTextSplitter.ts'

export interface ParallelRow {
  document_id: number
  title: string
  content: string | null
  summary: string | null
  language: string | null
  parallel_of: number | null
  is_published: number
}

export interface ValidationResult {
  // Structural breakage: the export must not proceed.
  errors: string[]
  // Worth fixing, but the pair still renders correctly.
  warnings: string[]
  pairCount: number
}

export function validateParallelTexts(rows: ParallelRow[]): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  const byId = new Map(rows.map((row) => [row.document_id, row]))

  const satellites = rows.filter((row) => row.parallel_of !== null)

  // More than one German half pointing at the same English row would
  // make "the counterpart" ambiguous, and which one rendered would come
  // down to row order.
  const targets = new Map<number, ParallelRow[]>()
  for (const satellite of satellites) {
    const list = targets.get(satellite.parallel_of as number) ?? []
    list.push(satellite)
    targets.set(satellite.parallel_of as number, list)
  }
  for (const [targetId, list] of targets) {
    if (list.length > 1) {
      errors.push(
        `Documents ${list.map((r) => r.document_id).join(', ')} all point at ` +
          `${targetId} as their parallel text. A document can only have one.`,
      )
    }
  }

  for (const satellite of satellites) {
    const targetId = satellite.parallel_of as number
    const label = `Document ${satellite.document_id} ("${satellite.title}")`

    if (targetId === satellite.document_id) {
      errors.push(`${label} names itself as its own parallel text.`)
      continue
    }

    const target = byId.get(targetId)
    if (!target) {
      errors.push(`${label} points at document ${targetId}, which does not exist.`)
      continue
    }

    // A chain would mean A is the translation of B, which is itself the
    // translation of C -- and the site resolves exactly one hop.
    if (target.parallel_of !== null) {
      errors.push(
        `${label} points at ${targetId}, which is itself a translation of ` +
          `${target.parallel_of}. Pairs are two documents, not a chain.`,
      )
      continue
    }

    // Publication has to agree, or the export emits a German half whose
    // entry point isn't there -- a page with no title and no summary.
    if (satellite.is_published !== target.is_published) {
      errors.push(
        `${label} is ${satellite.is_published ? 'published' : 'unpublished'} but ` +
          `${targetId} is ${target.is_published ? 'published' : 'unpublished'}. ` +
          'Both halves of a pair publish together or not at all.',
      )
      continue
    }

    if (satellite.language === null || target.language === null) {
      errors.push(
        `${label} and ${targetId} are a pair, but one of them has no language set.`,
      )
      continue
    }

    if (satellite.language === target.language) {
      errors.push(
        `${label} and ${targetId} are both marked '${satellite.language}'. ` +
          'A pair is one document in each language.',
      )
      continue
    }

    // The invariant this module exists for.
    const satelliteBlocks = toBlocks(satellite.content ?? '')
    const targetBlocks = toBlocks(target.content ?? '')
    if (satelliteBlocks.length !== targetBlocks.length) {
      errors.push(
        `${label} has ${satelliteBlocks.length} paragraphs but its counterpart ` +
          `${targetId} has ${targetBlocks.length}. The site pairs them by ` +
          'position, so an unequal count would set paragraphs against the ' +
          'wrong translation from that point on. Whichever half gained or ' +
          'lost a paragraph needs the other to match.',
      )
      continue
    }

    // Not fatal: one summary per work, in English, on the entry point.
    // A summary on the German half would simply never be displayed.
    if (satellite.summary !== null && satellite.summary.trim() !== '') {
      warnings.push(
        `${label} carries a summary. Only the entry point's summary is shown, ` +
          'so this one will never appear.',
      )
    }
  }

  // A language on its own is harmless -- it just records what a document
  // is written in -- but a half-finished split is worth saying out loud,
  // since it looks like nothing happened.
  for (const row of rows) {
    if (
      row.language !== null &&
      row.parallel_of === null &&
      !targets.has(row.document_id)
    ) {
      warnings.push(
        `Document ${row.document_id} ("${row.title}") is marked '${row.language}' ` +
          'but has no counterpart. If it was meant to be split, the other half ' +
          'is missing.',
      )
    }
  }

  return { errors, warnings, pairCount: satellites.length }
}
