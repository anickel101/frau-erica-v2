import { describe, expect, it } from 'vitest'
import {
  splitParallelText,
  stripTrailingNavigation,
  toBlocks,
} from './parallelTextSplitter.ts'

// Real sentences from the archive, not invented German. A synthetic
// fixture of "Ein zwei drei" would pass a word-frequency test while
// proving nothing about the documents this actually has to split.
const GERMAN_1 =
  'Wir haben Windstille. Sie und konträrer Wind sind für den Neuling auf der See eine wahre Wohltat. Er lernt sich biegen und bücken, wenn er in die Roje geht.'
const ENGLISH_1 =
  'There is no wind. That and a contrary wind are a real blessing for a newcomer at sea. He learns to bend and bow when he goes to his bunk.'
const GERMAN_2 =
  'Die Erlebnisse des ersten Tages auf dem Schiffe sind mir, nach der so bittern Trennung von meiner Heimat, besonders lieb gewesen.'
const ENGLISH_2 =
  'The experiences of the first day on the ship were particularly dear to me after the bitter separation from my homeland.'

describe('stripTrailingNavigation', () => {
  // Four shapes, because the archive really does carry all four --
  // counted across every document: 26, 8, 4 and 1 uses respectively.
  it.each([
    '**Next:** [On the High Seas](/documents/88)',
    '[Next: II. Childhood](/documents/135)',
    'Next: [something](/documents/99)',
    '**Next:** [Postscript](/documents/93)',
  ])('removes a trailing navigation link: %s', (nav) => {
    const { blocks, removed } = stripTrailingNavigation([GERMAN_1, ENGLISH_1, nav])
    expect(removed).toBe(nav)
    expect(blocks).toEqual([GERMAN_1, ENGLISH_1])
  })

  // Documents 128 and 129 each end with a real sentence built around a
  // /documents/ link. Eating those would silently delete content.
  it('leaves a trailing sentence that merely contains a document link', () => {
    const prose = '[Read](/documents/44) the obituary from the National Park Service.'
    const { blocks, removed } = stripTrailingNavigation([GERMAN_1, prose])
    expect(removed).toBeNull()
    expect(blocks).toHaveLength(2)
  })

  it('leaves a navigation-shaped block that is not the last one', () => {
    const nav = '**Next:** [On the High Seas](/documents/88)'
    const { removed } = stripTrailingNavigation([nav, GERMAN_1, ENGLISH_1])
    expect(removed).toBeNull()
  })
})

describe('splitParallelText', () => {
  it('splits strict paragraph-by-paragraph alternation', () => {
    const result = splitParallelText(
      [GERMAN_1, ENGLISH_1, GERMAN_2, ENGLISH_2].join('\n\n'),
    )

    expect(result.clean).toBe(true)
    expect(result.pairs).toHaveLength(2)
    expect(result.germanContent).toBe([GERMAN_1, GERMAN_2].join('\n\n'))
    expect(result.englishContent).toBe([ENGLISH_1, ENGLISH_2].join('\n\n'))
  })

  it('splits a section of several blocks per language', () => {
    // Document 91's shape: a whole German half, then a whole English
    // half, rather than alternating block by block.
    const result = splitParallelText(
      [GERMAN_1, GERMAN_2, ENGLISH_1, ENGLISH_2].join('\n\n'),
    )

    expect(result.clean).toBe(true)
    expect(result.pairs).toHaveLength(1)
    expect(result.pairs[0].german.map((b) => b.text)).toEqual([GERMAN_1, GERMAN_2])
    expect(result.pairs[0].english.map((b) => b.text)).toEqual([ENGLISH_1, ENGLISH_2])
  })

  // The case that motivated the whole pairing-based approach. Neither
  // heading has enough words to classify on its own -- "**21. August**"
  // and "**August 21**" are decided by sharing the token "21", being
  // the same length, and both being headings.
  it('places short headings a word-frequency classifier cannot judge', () => {
    const result = splitParallelText(
      ['**21. August**', GERMAN_1, '**August 21**', ENGLISH_1].join('\n\n'),
    )

    expect(result.clean).toBe(true)
    expect(result.pairs).toHaveLength(1)
    expect(result.pairs[0].german.map((b) => b.text)).toEqual([
      '**21. August**',
      GERMAN_1,
    ])
    expect(result.pairs[0].english.map((b) => b.text)).toEqual([
      '**August 21**',
      ENGLISH_1,
    ])
  })

  it('keeps every original block, in order, across the two halves', () => {
    const blocks = [GERMAN_1, GERMAN_2, ENGLISH_1, ENGLISH_2]
    const result = splitParallelText(blocks.join('\n\n'))

    expect(
      [...toBlocks(result.germanContent), ...toBlocks(result.englishContent)].sort(),
    ).toEqual([...blocks].sort())
  })

  it('reports an odd block count and points at the block to look at', () => {
    const orphan = 'She entertained them, told them stories and read aloud to them.'
    const result = splitParallelText(
      [GERMAN_1, ENGLISH_1, GERMAN_2, ENGLISH_2, orphan].join('\n\n'),
    )

    expect(result.clean).toBe(false)
    expect(result.pairs).toHaveLength(0)
    expect(result.warnings.join(' ')).toContain('odd number')
    // Names the actual orphan, not just "something is wrong".
    expect(result.warnings.join(' ')).toContain('block 4')
  })

  it('warns about markdown table syntax, the document 139 artifact', () => {
    const welded = `${ENGLISH_1}\n| |\n| --- |\n| ${GERMAN_2} |`
    const result = splitParallelText([GERMAN_1, welded].join('\n\n'))

    expect(result.warnings.join(' ')).toContain('table syntax')
    expect(result.clean).toBe(false)
  })

  it('notes a dropped navigation link without calling it a problem', () => {
    const result = splitParallelText(
      [GERMAN_1, ENGLISH_1, '**Next:** [On the High Seas](/documents/88)'].join('\n\n'),
    )

    expect(result.clean).toBe(true)
    expect(result.warnings).toHaveLength(0)
    expect(result.notes.join(' ')).toContain('navigation')
  })

  it('refuses an empty document rather than proposing an empty split', () => {
    const result = splitParallelText('   \n\n  ')
    expect(result.clean).toBe(false)
    expect(result.warnings.join(' ')).toContain('no content')
  })
})
