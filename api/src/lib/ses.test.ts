import { describe, expect, test } from 'vitest'
import { buildRequestEmail } from './ses'

describe('buildRequestEmail', () => {
  // Sends FROM the domain but replies go to the real inbox. The From
  // address deliberately has no mailbox behind it -- SES only needs the
  // domain verified to send -- so without Reply-To, answering a
  // notification would bounce. Sending as @gmail.com (the previous
  // behaviour) fails DKIM/SPF alignment and is what put these in spam.
  test('sends from the verified domain, with replies going to the archivist', () => {
    const email = buildRequestEmail(
      {
        name: 'Jane Smith',
        email: 'jane@example.com',
        connection: 'Great-granddaughter of Georg',
      },
      'http://localhost:5173',
    )
    expect(email.Source).toContain('@frauerica.org')
    expect(email.Source).not.toContain('@gmail.com')
    expect(email.Destination?.ToAddresses).toEqual(['FrauErica.archivist@gmail.com'])
    expect(email.ReplyToAddresses).toEqual(['FrauErica.archivist@gmail.com'])
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
