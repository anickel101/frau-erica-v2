import { describe, expect, it } from 'vitest'
import { getDocumentById } from './documents'

describe('getDocumentById', () => {
  it('resolves {{image:ID}} placeholders to markdown image syntax, and strips unresolvable ones', () => {
    // document_id 2 ("A User's Guide to FrauErica.org") is known to contain
    // {{image:3000}} (a real, published image) and {{image:3}} (not present
    // in the published Images export) -- a real fixture, not synthetic.
    const document = getDocumentById(2)

    expect(document).toBeDefined()
    expect(document?.content).not.toContain('{{image:')
    expect(document?.content).toContain('![')
    expect(document?.content).toContain('UsersGuide3.jpg')
  })

  it('returns undefined for an unknown or unpublished document id', () => {
    expect(getDocumentById(999999)).toBeUndefined()
  })
})
