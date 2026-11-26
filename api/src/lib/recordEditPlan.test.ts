import { describe, expect, test } from 'vitest'
import { planRecordEdits, type FieldSpec } from './recordEditPlan'

const spec: Record<string, FieldSpec> = {
  name: { kind: 'line', max: 20, required: true },
  caption: { kind: 'text', max: 50 },
  year_taken: { kind: 'year' },
}
const current = { name: 'Pandas', caption: 'The team.', year_taken: null }

function plan(body: unknown) {
  const result = planRecordEdits(current, body, spec)
  if ('error' in result) throw new Error(result.error)
  return result
}
function error(body: unknown) {
  const result = planRecordEdits(current, body, spec)
  if (!('error' in result)) throw new Error('expected an error')
  return result.error
}

describe('planRecordEdits', () => {
  test('proposes a changed field, recording what the archive held', () => {
    expect(plan({ caption: 'The 1973 team.' }).put).toEqual([
      { field: 'caption', value: 'The 1973 team.', was: 'The team.' },
    ])
  })

  test("clears a field's pending edit when the archive's value comes back", () => {
    expect(plan({ caption: ' The team.\r\n' })).toEqual({ put: [], clear: ['caption'] })
  })

  test('an emptied optional field becomes none', () => {
    expect(plan({ caption: '   ' }).put).toEqual([
      { field: 'caption', value: null, was: 'The team.' },
    ])
  })

  test('a caption may run to paragraphs; a name may not', () => {
    expect(plan({ caption: 'One.\n\nTwo.' }).put[0].value).toBe('One.\n\nTwo.')
    expect(error({ name: 'Two\nlines' })).toMatch(/single line/)
  })

  test.each([
    [{ name: '' }, /can't be empty/],
    [{ name: 'x'.repeat(21) }, /at most 20/],
    [{ caption: 42 }, /must be text/],
    [{ colour: 'red' }, /Unknown field: colour/],
    [{ toString: 'x' }, /Unknown field/],
    [[], /Expected an object/],
    [{}, /Nothing to save/],
  ])('refuses %j', (body, message) => {
    expect(error(body)).toMatch(message)
  })

  test('a year is a whole number in range, or nothing', () => {
    expect(plan({ year_taken: 1973 }).put[0].value).toBe(1973)
    expect(plan({ year_taken: '1973' }).put[0].value).toBe(1973)
    expect(plan({ year_taken: '' })).toEqual({ put: [], clear: ['year_taken'] })
    for (const bad of [1650, 2200, 1973.5, 'c. 1920', true]) {
      expect(error({ year_taken: bad })).toMatch(/year between/)
    }
  })
})
