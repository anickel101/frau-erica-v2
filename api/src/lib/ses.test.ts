import { describe, expect, test } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { buildRequestEmail } from './ses'

describe('buildRequestEmail', () => {
  // Sends FROM the domain but replies go to the real inbox. The From
  // address deliberately has no mailbox behind it -- SES only needs the
  // domain verified to send -- so without Reply-To, answering a
  // notification would bounce. Sending as @gmail.com (the previous
  // behavior) fails DKIM/SPF alignment and is what put these in spam.
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

// The half of this that tests could not see, until it broke.
//
// SES authorises a send against the identity of the FROM address. The
// test above asserts the sender is @frauerica.org and has always passed
// -- but the IAM policy in template.yaml still granted ses:SendEmail on
// identity/FrauErica.archivist@gmail.com, the address the sender used to
// be. So every access-request notification failed with AccessDenied from
// 2026-09-08 to 2026-10-05: four weeks, three real relatives who asked
// for access and whose requests nobody was told about.
//
// Nothing in the type system or the test suite connected the two. This
// reads the template and makes the connection explicit, so moving the
// sender again fails here rather than in production four weeks later.
describe('the IAM policy behind the sender', () => {
  test('grants SendEmail on the identity the From address actually uses', () => {
    const template = readFileSync(path.join(__dirname, '../../template.yaml'), 'utf-8')
    const senderDomain = buildRequestEmail(
      { name: 'n', email: 'e@example.com', connection: 'c' },
      'http://localhost:5173',
    ).Source!.match(/@([^\s>]+)/)![1]

    // The granted identity, read out of the SendAdminNotification
    // statement rather than hardcoded -- a test that restates the
    // template's own string would pass no matter what either half said.
    const granted = template
      .split('Sid: SendAdminNotification')[1]
      .split('- Sid:')[0]
      .match(/identity\/(\S+)/)![1]

    expect(granted).toBe(senderDomain)
  })
})
