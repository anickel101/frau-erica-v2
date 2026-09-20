declare global {
  interface Window {
    grecaptcha?: {
      ready: (callback: () => void) => void
      execute: (siteKey: string, options: { action: string }) => Promise<string>
    }
  }
}

let scriptLoaded = false

// Call this when the form mounts, NOT at submit time. reCAPTCHA v3 scores
// a request on the behavior it observed during the session -- mouse
// movement, dwell time, how the page was interacted with. A script that
// loads and executes within the same few hundred milliseconds hands
// Google almost no signal, and a real person filling in a form carefully
// then scores like a bot. Loading early is what makes the score
// meaningful; execute() still happens at the action itself.
//
// Exported (it used to be called implicitly from executeRecaptcha) so the
// two halves can happen at the right times.
export function loadRecaptchaScript(siteKey: string): void {
  if (scriptLoaded) return
  scriptLoaded = true

  const script = document.createElement('script')
  script.src = `https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(siteKey)}`
  // Reset the latch on failure -- otherwise a blocked or failed load
  // (ad blocker, school/corporate network) leaves scriptLoaded stuck true
  // and every later attempt waits the full timeout for a script that is
  // never coming.
  script.onerror = () => {
    scriptLoaded = false
  }
  document.head.appendChild(script)
}

// v3 has no visible widget -- call this right before the action being
// protected (not on page load), with an action name Google's admin
// console can later break down scores by.
export function executeRecaptcha(siteKey: string, action: string): Promise<string> {
  loadRecaptchaScript(siteKey)

  return new Promise((resolve, reject) => {
    const start = Date.now()

    function waitForGrecaptcha() {
      if (window.grecaptcha) {
        window.grecaptcha.ready(() => {
          window.grecaptcha!.execute(siteKey, { action }).then(resolve).catch(reject)
        })
        return
      }
      if (Date.now() - start > 10_000) {
        reject(new Error('reCAPTCHA script did not load in time'))
        return
      }
      setTimeout(waitForGrecaptcha, 100)
    }

    waitForGrecaptcha()
  })
}
