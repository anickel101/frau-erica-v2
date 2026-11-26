import { describe, expect, test } from 'vitest'
import { toBlocks as scriptToBlocks } from '../../scripts/parallelTextSplitter.ts'
import { toBlocks } from './paragraphs'

// The editor, the page and the export must agree on where a paragraph
// ends, or the editor would call a pair balanced that the export refuses.
describe('toBlocks', () => {
  test.each([
    'One.\n\nTwo.',
    'One.\n\n\n\nTwo.',
    'One.\n   \nTwo.\n\t\nThree.',
    '\n\nLeading and trailing.\n\n',
    'One line\nstill one paragraph.',
    '',
  ])('splits %j exactly as the export does', (text) => {
    expect(toBlocks(text)).toEqual(scriptToBlocks(text))
  })
})
