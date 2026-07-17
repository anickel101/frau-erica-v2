// Public site key, not a secret -- safe to ship in the bundle. The
// matching secret key lives server-side only (SSM Parameter Store, see
// api/template.yaml's RequestAccessFunction).
export const RECAPTCHA_SITE_KEY = '6LdAfFctAAAAAGPWHlgrWNs75PWiDAMuPoiwSwj3'
