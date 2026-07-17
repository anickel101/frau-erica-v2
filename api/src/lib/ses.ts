import {
  SendEmailCommand,
  SESClient,
  type SendEmailCommandInput,
} from '@aws-sdk/client-ses'

const ADMIN_EMAIL = 'FrauErica.archivist@gmail.com'

const ses = new SESClient({})

export interface RequestAccessDetails {
  name: string
  email: string
  connection: string
}

// Pure -- testable without touching SES. The admin emails themselves
// (Source and ToAddresses both ADMIN_EMAIL), which sidesteps needing SES
// production access: sandbox mode only requires verified sender AND
// recipient, and here they're the same single verified address.
export function buildRequestEmail(
  details: RequestAccessDetails,
  frontendOrigin: string,
): SendEmailCommandInput {
  // /admin/approve still exists as a redirect (for any already-sent
  // email still pointing there), but new emails link straight to the
  // merged admin page (approve form + existing-users table together).
  const approveUrl = `${frontendOrigin}/admin/users?email=${encodeURIComponent(details.email)}&name=${encodeURIComponent(details.name)}`

  return {
    Source: ADMIN_EMAIL,
    Destination: { ToAddresses: [ADMIN_EMAIL] },
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
