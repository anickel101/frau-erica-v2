import { describe, expect, it } from 'vitest'
import documentsDetail from '../../data/generated/documents.json'
import imagesRaw from '../../data/generated/images.json'
import { getDocumentById, listDocuments } from './documents'

// The fixture is FOUND, not hardcoded.
//
// This test used to name document 2 ("A User's Guide to FrauErica.org")
// directly, with a comment calling it "a real fixture, not synthetic."
// It was -- right up until that document was deleted from the archive as
// legacy site chrome, at which point the test failed for a reason that
// had nothing to do with the code it covers.
//
// The archive is editable data, so any specific id is a fixture with an
// expiry date. Searching for a document with the shape this test needs
// keeps the assertion real while making it immune to ordinary content
// work. If the archive ever contains no such document, the guard below
// says so plainly rather than letting the test pass vacuously.
const PLACEHOLDER = /\{\{image:(\d+)(?::\w+)?\}\}/g

function findDocumentWithBothPlaceholderKinds(): number {
  const publishedImageIds = new Set(
    (imagesRaw as { image_id: number }[]).map((image) => image.image_id),
  )
  for (const document of documentsDetail as { document_id: number; content: string }[]) {
    const ids = [...document.content.matchAll(PLACEHOLDER)].map((m) => Number(m[1]))
    const resolvable = ids.some((id) => publishedImageIds.has(id))
    const unresolvable = ids.some((id) => !publishedImageIds.has(id))
    if (resolvable && unresolvable) return document.document_id
  }
  return -1
}

describe('getDocumentById', () => {
  it('resolves {{image:ID}} placeholders to markdown image syntax, and strips unresolvable ones', () => {
    const id = findDocumentWithBothPlaceholderKinds()
    expect(
      id,
      'no published document contains both a resolvable and an unresolvable {{image:ID}} placeholder, so this test can no longer prove anything',
    ).toBeGreaterThan(0)

    const document = getDocumentById(id)

    expect(document).toBeDefined()
    // Every placeholder is gone: the resolvable ones became markdown
    // image syntax, the unresolvable ones were stripped entirely rather
    // than left as literal braces on the page.
    expect(document?.content).not.toContain('{{image:')
    expect(document?.content).toContain('![')
  })

  it('returns undefined for an unknown or unpublished document id', () => {
    expect(getDocumentById(999999)).toBeUndefined()
  })

  it('no longer carries the three legacy site-chrome documents', () => {
    // 1 was the old error page, 2 the old User's Guide, 85 the old home
    // page -- all three superseded by real pages and deleted 2026-09-18.
    // Asserted so a future reimport from a stale source cannot quietly
    // put them back.
    for (const id of [1, 2, 85]) {
      expect(
        getDocumentById(id),
        `document ${id} should not be published`,
      ).toBeUndefined()
    }
    const titles = listDocuments().map((d) => d.title)
    expect(titles.some((t) => t.includes('FrauErica.org'))).toBe(false)
  })
})
