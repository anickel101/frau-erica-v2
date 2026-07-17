import { describe, expect, it } from 'vitest'
import { AnniversaryEvent } from '../types/anniversary'
import { groupEventsByDay } from './anniversaryDisplay'

function event(
  overrides: Partial<AnniversaryEvent> & Pick<AnniversaryEvent, 'date'>,
): AnniversaryEvent {
  return {
    type: 'birth',
    personId: 1,
    personName: 'Test Person',
    linkedFamilyId: null,
    ...overrides,
  }
}

describe('groupEventsByDay', () => {
  it('filters out events from other months', () => {
    const events = [event({ date: '1900-06-01' }), event({ date: '1900-07-01' })]
    const grouped = groupEventsByDay(events, 7)
    expect([...grouped.keys()]).toEqual([1])
  })

  it('groups multiple events on the same day-of-month together', () => {
    const events = [
      event({ date: '1900-07-01', personName: 'A' }),
      event({ date: '1950-07-01', personName: 'B' }),
      event({ date: '1900-07-02', personName: 'C' }),
    ]
    const grouped = groupEventsByDay(events, 7)
    expect(grouped.get(1)?.map((e) => e.personName)).toEqual(['A', 'B'])
    expect(grouped.get(2)?.map((e) => e.personName)).toEqual(['C'])
  })

  it('sorts events within a day chronologically by year, earliest first', () => {
    const events = [
      event({ date: '1980-07-04', personName: 'Later' }),
      event({ date: '1850-07-04', personName: 'Earliest' }),
      event({ date: '1920-07-04', personName: 'Middle' }),
    ]
    const grouped = groupEventsByDay(events, 7)
    expect(grouped.get(4)?.map((e) => e.personName)).toEqual([
      'Earliest',
      'Middle',
      'Later',
    ])
  })

  it('returns an empty map when nothing falls in the given month', () => {
    const events = [event({ date: '1900-01-01' })]
    expect(groupEventsByDay(events, 7).size).toBe(0)
  })
})
