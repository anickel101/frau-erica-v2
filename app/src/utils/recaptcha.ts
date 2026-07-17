declare global {
  interface Window {
    grecaptcha?: {
      ready: (callback: () => void) => void
      execute: (siteKey: string, options: { action: string }) => Promise<string>
    }
  }
}

let scriptLoaded = false

function loadRecaptchaScript(siteKey: string): void {
  if (scriptLoaded) return
  scriptLoaded = true

  const script = document.createElement('script')
  script.src = `https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(siteKey)}`
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
