import { describe, expect, test } from 'vitest'
import { fixMojibake } from './fixMojibake'

// This runs over every piece of text leaving the archive, so the risk
// worth testing is not "does it fix the broken cases" but "does it leave
// the correct ones alone" -- a repair that mangled genuine German would
// be far worse than the corruption it replaces.
describe('fixMojibake', () => {
  test.each([
    // Real values from the archive, before the source was repaired.
    ['M√ºllers aboard *Der Adler*', 'Müllers aboard *Der Adler*'],
    ['**The Gro√ü American Game**', '**The Groß American Game**'],
    ['Pite√•, Sweden, above the Arctic Circle', 'Piteå, Sweden, above the Arctic Circle'],
    ['Siblings called him Gene or P√§sel.', 'Siblings called him Gene or Päsel.'],
    ['*Frauenflei√ü* (Women’s work)', '*Frauenfleiß* (Women’s work)'],
    ['Dick and Molly‚Äôs wedding', 'Dick and Molly’s wedding'],
    [
      'Joel ‚Äî he was Jerry through high school',
      'Joel — he was Jerry through high school',
    ],
    [
      'arrived on July 30, 2016 ‚Äì his great-grandmother',
      'arrived on July 30, 2016 – his great-grandmother',
    ],
  ])('repairs %j', (input, expected) => {
    expect(fixMojibake(input)).toBe(expected)
  })

  // The six-substitution version this replaced could not have broken
  // these, because it only ever touched six exact strings. A general
  // rule can, so these matter more than the cases above.
  test.each([
    'Müllers, already correct',
    'Sauerbraten mit Klößen',
    'Blumenthal bei Hannover',
    'Frau Erica – an en dash',
    'Molly’s wedding',
    '“Quoted” and ‘quoted’',
    'Piteå',
    'Groß',
    'café naïve résumé',
    'Fritz Müllers Reise nach Amerika',

    // The shape that actually broke, and that none of the cases above
    // could catch: every one of them puts an ASCII letter between the
    // punctuation and the umlaut. Two ADJACENT non-ASCII characters are
    // what NON_ASCII_RUN matches, and Mac Roman's layout makes several
    // such pairs encode to a valid UTF-8 two-byte sequence -- so they
    // round-tripped silently into Cyrillic. Verified against the real
    // function before the guard existed:
    //   '1900–Über' -> '1900Іber'   '—Überall' -> 'цberall'
    //   NBSP + 'ü'  -> 'ʟ'
    '1900–Über',
    '—Überall',
    'Jahrgang 1865–Ölmühle',
    '\u00a0ü',
    '„Über alles“',
    '»Köln«',
    'Große–Ähren',
  ])('leaves correct text untouched: %j', (input) => {
    expect(fixMojibake(input)).toBe(input)
  })

  test('passes null through', () => {
    expect(fixMojibake(null)).toBeNull()
  })

  test('is idempotent -- repaired text is not re-repaired', () => {
    const once = fixMojibake('M√ºllers and Molly‚Äôs')
    expect(fixMojibake(once)).toBe(once)
    expect(once).toBe('Müllers and Molly’s')
  })
})
