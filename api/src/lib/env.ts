// Every handler/lib module that reads a required Lambda environment
// variable was hand-rolling the same "read it, throw a descriptive error
// if missing" check -- centralized here so the error message format
// stays consistent and the check can't be typo'd differently in each
// call site.
export function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`${name} environment variable is required`)
  }
  return value
}
