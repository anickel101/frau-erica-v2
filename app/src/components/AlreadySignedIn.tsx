import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { buttonClassName } from '../utils/formStyles'

// Shown in place of the login form when someone who is already signed in
// lands on /login.
//
// This is a normal thing to happen, not an edge case: the Cognito
// invitation email says "Sign in at frauerica.org" and links to
// /login, and for most family members that email is the only link they
// have to the site. Digging it back out months later is exactly how
// someone returns -- at which point they'd previously get a login form
// while the sidebar greeted them by name, and a raw
// "There is already a signed in user." from Amplify if they filled it in.
//
// Deliberately not a silent redirect. Someone who navigated to a login
// page has a question, and bouncing them to the home page doesn't answer
// it -- on a shared family computer the real intent is often "log in as
// someone else", which the Log out button below serves directly. A
// redirect would also have raced the sign-out flow, which navigates here
// while the Cognito call is still in flight.
export default function AlreadySignedIn({ pending }: { pending?: boolean }) {
  const { personName, email, homeFamilyId, logout } = useAuth()

  // personName is resolved by a separate lookup after sign-in and stays
  // null if that fails or the account has no linked person -- email is
  // always present, so it's the fallback rather than an empty greeting.
  const who = personName ?? email

  // A fragment, not a <section>: LoginPage's RightPanel supplies the
  // single grid-item wrapper for all three of its branches.
  return (
    <>
      {/* text-balance so this doesn't wrap to a lonely "in" on the
          second line the way the shorter "Welcome" never had to. */}
      <h1 className="text-2xl sm:text-3xl font-bold mb-4 text-balance">
        You're already signed in
      </h1>
      <p className="mb-6">
        {who ? (
          <>
            You're signed in as <strong>{who}</strong>.
          </>
        ) : (
          <>You're signed in.</>
        )}
      </p>

      {pending ? (
        <p className="mb-6">
          Your account hasn't been approved for family-tree access yet. Once the Archivist
          approves it, the family pages will open up automatically -- there's nothing else
          you need to do.
        </p>
      ) : (
        <p className="mb-6">
          <Link
            to={homeFamilyId !== null ? `/family/${homeFamilyId}` : '/'}
            className={`${buttonClassName} inline-block`}
          >
            {homeFamilyId !== null ? 'Go to your family page' : 'Go to the home page'}
          </Link>
        </p>
      )}

      <p className="text-sm text-fe-ink/70">
        Not you, or want to sign in as someone else?{' '}
        <button
          type="button"
          // No navigation afterwards, unlike the sidebar's Log out: this
          // page is already where you'd want to land, and it swaps itself
          // back to the login form as soon as the auth state clears.
          onClick={() => void logout()}
          className="text-fe-link hover:text-fe-link-dark underline"
        >
          Log out
        </button>
        .
      </p>
    </>
  )
}
