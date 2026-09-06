import { Component, ErrorInfo, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import Layout from './Layout'

// Set when we've already tried an automatic reload this tab session --
// without it, a genuinely missing chunk (rather than a stale one) would
// reload forever. Cleared again once the app has stayed up for a while
// (see componentDidMount), so a second deploy later in the same long-lived
// tab session can still self-heal; a reload loop never reaches that
// uptime, so clearing it can't reintroduce the loop.
const RELOAD_ATTEMPTED_KEY = 'fe-chunk-reload-attempted'
const HEALTHY_UPTIME_MS = 10_000

// Every route is lazy()-loaded and chunk filenames are content-hashed, so
// a visitor who had the tab open when a new build was deployed will
// request a chunk that no longer exists on the CDN. That rejects, React
// unmounts the whole tree, and without a boundary the result is a blank
// white page. One reload fixes it permanently (the fresh index.html
// points at the new hashes), so that specific case is worth recovering
// from automatically rather than asking a non-technical visitor to do it.
function isStaleChunkError(error: Error): boolean {
  return /dynamically imported module|Importing a module script failed|ChunkLoadError|Loading chunk \d+ failed/i.test(
    `${error.name}: ${error.message}`,
  )
}

// sessionStorage throws outright in some privacy modes -- a storage
// failure must not become a second error inside the error handler.
function safeSessionStorage(action: (storage: Storage) => void): void {
  try {
    action(window.sessionStorage)
  } catch {
    // No recovery possible or needed; fall through to the manual UI.
  }
}

interface State {
  error: Error | null
}

export default class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidMount(): void {
    window.setTimeout(() => {
      safeSessionStorage((storage) => storage.removeItem(RELOAD_ATTEMPTED_KEY))
    }, HEALTHY_UPTIME_MS)
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Nothing collects client-side errors yet, so the console is the only
    // place this is recoverable from when someone reports "it broke."
    console.error('Unhandled render error:', error, info.componentStack)

    if (!isStaleChunkError(error)) return
    safeSessionStorage((storage) => {
      if (storage.getItem(RELOAD_ATTEMPTED_KEY)) return
      storage.setItem(RELOAD_ATTEMPTED_KEY, '1')
      window.location.reload()
    })
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <Layout>
        <div className="p-6 max-w-2xl">
          <h1 className="text-2xl font-bold mb-4">Something went wrong</h1>
          <p className="mb-4">
            Sorry -- this page ran into a problem. Reloading usually fixes it, especially
            if the site was updated while you had it open.
          </p>
          <p className="mb-6">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="bg-fe-accent hover:bg-fe-accent-dark text-white px-4 py-2 rounded-sm text-sm font-bold"
            >
              Reload the page
            </button>
          </p>
          <p className="text-sm text-fe-ink/70">
            If it keeps happening, please{' '}
            <Link to="/contact" className="text-fe-link hover:text-fe-link-dark">
              contact the Archivist
            </Link>
            .
          </p>
        </div>
      </Layout>
    )
  }
}
