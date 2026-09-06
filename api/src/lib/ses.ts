import {
  SendEmailCommand,
  SESClient,
  type SendEmailCommandInput,
} from '@aws-sdk/client-ses'

const ADMIN_EMAIL = 'FrauErica.archivist@gmail.com'

// Sending as @gmail.com from SES is actively bad for deliverability:
// Gmail sees mail claiming to be from one of its own domains that didn't
// originate at Google, fails DKIM/SPF alignment, and treats it as
// spoofing-shaped -- which is why these notifications kept landing in
// spam. Sending from the domain we control, with DKIM published in our
// own Route53 zone, is what actually earns inbox placement.
//
// No mailbox exists at this address and none is needed: SES only
// requires the *domain* to be a verified identity in order to send from
// it. Replies are steered to the real inbox via Reply-To below.
//
// Requires the EmailIdentity in hosting/dns.yaml to be verified first --
// deploying this before that exists would break the notification
// entirely rather than merely filing it in spam.
const FROM_ADDRESS = 'The Frau Erica Project <archivist@frauerica.org>'

const ses = new SESClient({})

export interface RequestAccessDetails {
  name: string
  email: string
  connection: string
}

// Pure -- testable without touching SES. Recipient stays the archivist's
// real inbox; only the sender moves to the domain. Still fine in SES
// sandbox, which requires the recipient to be verified -- and
// FrauErica.archivist@gmail.com already is.
export function buildRequestEmail(
  details: RequestAccessDetails,
  frontendOrigin: string,
): SendEmailCommandInput {
  // /admin/approve still exists as a redirect (for any already-sent
  // email still pointing there), but new emails link straight to the
  // merged admin page (approve form + existing-users table together).
  const approveUrl = `${frontendOrigin}/admin/users?email=${encodeURIComponent(details.email)}&name=${encodeURIComponent(details.name)}`

  return {
    Source: FROM_ADDRESS,
    Destination: { ToAddresses: [ADMIN_EMAIL] },
    // Hitting reply on a notification should reach a mailbox that exists.
    ReplyToAddresses: [ADMIN_EMAIL],
    Message: {
      Subject: { Data: `Frau Erica: access request from ${details.name}` },
      Body: {
        Text: {
          Data: [
            `Name: ${details.name}`,
            `Email: ${details.email}`,
            '',
            'How they connect to the family tree:',
            details.connection,
            '',
            `Review and approve: ${approveUrl}`,
          ].join('\n'),
        },
      },
    },
  }
}

export async function sendAdminNotification(
  details: RequestAccessDetails,
  frontendOrigin: string,
): Promise<void> {
  await ses.send(new SendEmailCommand(buildRequestEmail(details, frontendOrigin)))
}
