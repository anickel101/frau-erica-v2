import { describe, expect, it } from 'vitest'
import { floatWidth, isExhibit, segmentContent } from './documentImageLayout'

const img = (n: number, modifier?: string) =>
  modifier
    ? `![cap ${n}](https://x/${n}.jpg "${modifier}")`
    : `![cap ${n}](https://x/${n}.jpg)`

describe('segmentContent', () => {
  it('groups consecutive image-only paragraphs into one strip', () => {
    const segments = segmentContent(['Intro.', img(1), img(2), 'After.'].join('\n\n'))
    expect(segments.map((s) => s.kind)).toEqual(['markdown', 'strip', 'markdown'])
    const strip = segments[1]
    expect(strip.kind === 'strip' && strip.images.map((i) => i.src)).toEqual([
      'https://x/1.jpg',
      'https://x/2.jpg',
    ])
  })

  it('leaves a lone image in the text, where it floats', () => {
    const segments = segmentContent(['Intro.', img(1), 'After.'].join('\n\n'))
    expect(segments).toEqual([
      { kind: 'markdown', text: ['Intro.', img(1), 'After.'].join('\n\n') },
    ])
  })

  it('sets a lone image that ends the document below the text, not floated', () => {
    const segments = segmentContent(['Intro.', 'More.', img(1)].join('\n\n'))
    expect(segments.map((s) => s.kind)).toEqual(['markdown', 'strip'])
  })

  it('does the same for a hand-sized image that ends the document', () => {
    const segments = segmentContent(['Intro.', 'More.', img(1, '300')].join('\n\n'))
    expect(segments.map((s) => s.kind)).toEqual(['markdown', 'strip'])
  })

  it('keeps a deliberately sized image out of a strip', () => {
    const segments = segmentContent(
      [img(1), img(2, 'wide'), img(3), 'After.'].join('\n\n'),
    )
    expect(segments.map((s) => s.kind)).toEqual(['markdown'])
  })

  it('treats the old "stack" workaround as strip material', () => {
    const segments = segmentContent([img(1, 'stack'), img(2, 'stack')].join('\n\n'))
    expect(segments.map((s) => s.kind)).toEqual(['strip'])
  })
})

describe('isExhibit', () => {
  it('is true when the images outweigh the text', () => {
    expect(isExhibit([img(1), img(2)].join('\n\n'))).toBe(true)
    expect(isExhibit(['One line of framing.', img(1)].join('\n\n'))).toBe(true)
  })

  it('is false for prose with an illustration, and for text with no images', () => {
    expect(isExhibit(['A.', 'B.', img(1), 'C.'].join('\n\n'))).toBe(false)
    expect(isExhibit('A.\n\nB.')).toBe(false)
  })
})

describe('floatWidth', () => {
  it('gives landscapes more room than portraits', () => {
    expect(floatWidth({ width: 1200, height: 800 }, 0)).toBeGreaterThan(
      floatWidth({ width: 800, height: 1200 }, 0),
    )
  })

  it('never floats an image wider than the file', () => {
    expect(floatWidth({ width: 200, height: 400 }, 2)).toBe(200)
  })
})
