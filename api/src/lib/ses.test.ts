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

// The halves of this that tests could not see, until each one broke.
//
// A send needs permission on TWO resources, and the facts that decide
// which two live in three different files:
//
//   lib/ses.ts        FROM_ADDRESS -> which identity SES authorises
//   hosting/dns.yaml  the identity's DEFAULT configuration set
//   api/template.yaml the IAM Resource ARNs that must name both
//
// Nothing in the type system connects a From address to an IAM ARN, so
// both halves drifted in turn. The sender moved to @frauerica.org and
// the policy kept naming the old gmail identity -- four weeks of
// AccessDenied, three real relatives whose requests nobody was told
// about. Granting the identity then moved the same error onto
// configuration-set/frau-erica-default, because a default config set
// applies to every send from the domain without appearing in the send
// call at all.
//
// These read the real files and assert they agree. Both take the
// granted values OUT of the template rather than restating them: a test
// that merely agrees with itself passes while production fails.

function templateYaml(): string {
  return readFileSync(path.join(__dirname, '../../template.yaml'), 'utf-8')
}

// The Resource block of the SendAdminNotification statement, as ARNs.
function grantedSesResources(): string[] {
  return (
    templateYaml()
      .split('Sid: SendAdminNotification')[1]
      .split('- Sid:')[0]
      .match(/arn:aws:ses:\S+/g) ?? []
  )
}

describe('the IAM policy behind the sender', () => {
  test('grants SendEmail on the identity the From address actually uses', () => {
    const senderDomain = buildRequestEmail(
      { name: 'n', email: 'e@example.com', connection: 'c' },
      'http://localhost:5173',
    ).Source!.match(/@([^\s>]+)/)![1]

    const identities = grantedSesResources()
      .filter((arn) => arn.includes(':identity/'))
      .map((arn) => arn.split(':identity/')[1])

    expect(identities).toContain(senderDomain)
  })

  // The identity alone is not enough, which is exactly how this failed
  // the second time.
  test("grants SendEmail on the identity's default configuration set", () => {
    const dns = readFileSync(path.join(__dirname, '../../../hosting/dns.yaml'), 'utf-8')

    // Only matters if the identity actually has a default config set --
    // if that attachment is ever removed, this requirement goes with it.
    const hasDefault = /ConfigurationSetAttributes:\s*\n\s*ConfigurationSetName:/.test(
      dns,
    )
    expect(hasDefault).toBe(true)

    const configSetName = dns
      .split('Type: AWS::SES::ConfigurationSet')[1]
      .match(/Name:\s*(\S+)/)![1]

    const granted = grantedSesResources()
      .filter((arn) => arn.includes(':configuration-set/'))
      .map((arn) => arn.split(':configuration-set/')[1])

    expect(granted).toContain(configSetName)
  })
})
