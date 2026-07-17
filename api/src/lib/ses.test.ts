import { describe, expect, test } from 'vitest'
import { buildRequestEmail } from './ses'

describe('buildRequestEmail', () => {
  test('sends from and to the admin address', () => {
    const email = buildRequestEmail(
      {
        name: 'Jane Smith',
        email: 'jane@example.com',
        connection: 'Great-granddaughter of Georg',
      },
      'http://localhost:5173',
    )
    expect(email.Source).toBe('FrauErica.archivist@gmail.com')
    expect(email.Destination?.ToAddresses).toEqual(['FrauErica.archivist@gmail.com'])
  })

  test('body includes the requester details and a working deep link', () => {
    const email = buildRequestEmail(
      {
        name: 'Jane Smith',
        email: 'jane@example.com',
        connection: 'Great-granddaughter of Georg',
      },
      'http://localhost:5173',
    )
    const body = email.Message?.Body?.Text?.Data ?? ''
    expect(body).toContain('Jane Smith')
    expect(body).toContain('jane@example.com')
    expect(body).toContain('Great-granddaughter of Georg')
    expect(body).toContain(
      'http://localhost:5173/admin/users?email=jane%40example.com&name=Jane%20Smith',
    )
  })

  test('subject includes the requester name', () => {
    const email = buildRequestEmail(
      { name: 'Jane Smith', email: 'jane@example.com', connection: 'x' },
      'http://localhost:5173',
    )
    expect(email.Message?.Subject?.Data).toContain('Jane Smith')
  })
})
