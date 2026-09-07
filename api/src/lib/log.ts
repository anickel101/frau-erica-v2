// Structured logging for the Lambda handlers.
//
// Everything written to console.* inside a Lambda is captured by the
// runtime and shipped to CloudWatch Logs automatically -- there is no
// transport to configure and nothing to store ourselves. The only real
// decisions are *what* to write and in *what shape*, which is all this
// module is.
//
// One JSON object per line, rather than interpolated prose, because
// CloudWatch Logs Insights parses JSON natively: a query like
//
//   fields @timestamp, score, hostname
//   | filter event = 'recaptcha.rejected'
//   | sort @timestamp desc
//
// works directly against the fields below. The same information written
// as `console.warn('reCAPTCHA rejected for ' + host)` can only be
// grepped, which is exactly the position the launch-day incidents were
// diagnosed from.
//
// ## On personal data
//
// This is a family archive, and some of the most useful log lines here
// necessarily name a real person -- knowing that *someone* failed to
// register is not actionable; knowing *who* is. So emails and names are
// logged deliberately on the account-lifecycle paths, and the exposure
// is bounded two ways instead:
//
//   1. Log group retention is 30 days (see template.yaml's LogGroup
//      resources), not the AWS default of "never expire".
//   2. Credentials never go in, at any retention. No reCAPTCHA tokens,
//      no JWTs, no passwords, no Authorization headers. If a new field
//      is one of those, it does not get logged -- log a boolean about
//      it instead.
//
// Callers pass fields explicitly rather than handing over whole event
// or request objects, specifically so that rule stays easy to check by
// reading the call site.

type Level = 'INFO' | 'WARN' | 'ERROR'

export interface LogFields {
  [key: string]: unknown
}

// Error is not usefully JSON-serialisable on its own -- `message` and
// `stack` are non-enumerable, so JSON.stringify(new Error('boom'))
// returns "{}". Pulled out by hand so a logged failure actually carries
// the reason. `name` matters more than it looks: the AWS SDK signals
// most recoverable conditions through the error class
// (UsernameExistsException, NoSuchKey), so it's usually the field worth
// filtering on.
function serialiseError(err: unknown): LogFields {
  if (err instanceof Error) {
    return { errorName: err.name, errorMessage: err.message, stack: err.stack }
  }
  return { errorName: 'NonError', errorMessage: String(err) }
}

function emit(level: Level, event: string, fields: LogFields): void {
  const line = JSON.stringify({ level, event, ...fields })
  // console.error for ERROR so the level survives into CloudWatch's own
  // stream metadata, not just our JSON payload; warn/info both go to
  // stdout, which is where Lambda expects non-fatal output.
  if (level === 'ERROR') console.error(line)
  else if (level === 'WARN') console.warn(line)
  else console.log(line)
}

// `event` is a dotted, stable identifier ('request-access.rejected'),
// not a sentence. It's the field every Insights query filters on, so it
// needs to survive someone rewording the human-readable description.
export const log = {
  info(event: string, fields: LogFields = {}): void {
    emit('INFO', event, fields)
  },
  warn(event: string, fields: LogFields = {}): void {
    emit('WARN', event, fields)
  },
  error(event: string, err: unknown, fields: LogFields = {}): void {
    emit('ERROR', event, { ...fields, ...serialiseError(err) })
  },
}
