import { useEffect, useMemo, useState } from 'react'
import Layout from '../components/Layout'
import RecipeCard from '../components/RecipeCard'
import SearchInput from '../components/SearchInput'
import { listRecipes } from '../data-access/gated/recipes'
import { useAuth } from '../hooks/useAuth'
import { GENRE_SHORT_LABEL, RECIPE_GENRES, RecipeListItem } from '../types/recipe'

type LoadState =
  { kind: 'loading' } | { kind: 'ready'; recipes: RecipeListItem[] } | { kind: 'error' }

// Search and the genre filter compose: pick "Soups", then type "tomato".
// Both run client-side over the already-loaded index, which is small
// enough (54 rows, no bodies) that filtering it is instant and needs no
// round trip per keystroke.
function filterRecipes(
  recipes: RecipeListItem[],
  query: string,
  genre: string | null,
): RecipeListItem[] {
  const q = query.trim().toLowerCase()
  return recipes.filter((recipe) => {
    if (genre && recipe.genre !== genre) return false
    if (!q) return true
    return (
      recipe.title.toLowerCase().includes(q) ||
      (recipe.summary ?? '').toLowerCase().includes(q) ||
      (recipe.genre ?? '').toLowerCase().includes(q)
    )
  })
}

const FILTER_BASE = 'text-xs px-2 py-0.5 border transition'

// A stable empty array for the pre-load state. An inline `[]` fallback
// is a new reference on every render, which would make both useMemos
// below recompute every time rather than only when the data changes.
const NO_RECIPES: RecipeListItem[] = []

export default function KeepersPage() {
  const { status } = useAuth()
  const [state, setState] = useState<LoadState>({ kind: 'loading' })
  const [query, setQuery] = useState('')
  const [genre, setGenre] = useState<string | null>(null)

  useEffect(() => {
    if (status !== 'signedIn') return
    let cancelled = false
    listRecipes()
      .then(({ recipes }) => {
        if (!cancelled) setState({ kind: 'ready', recipes })
      })
      .catch(() => {
        if (!cancelled) setState({ kind: 'error' })
      })
    return () => {
      cancelled = true
    }
  }, [status])

  const all = state.kind === 'ready' ? state.recipes : NO_RECIPES
  const visible = useMemo(() => filterRecipes(all, query, genre), [all, query, genre])

  // Only offer a genre that actually has published recipes behind it --
  // an empty filter that returns nothing reads as a broken page.
  const availableGenres = useMemo(
    () => RECIPE_GENRES.filter((g) => all.some((r) => r.genre === g)),
    [all],
  )

  return (
    <Layout accent="keepers">
      <div className="p-6 max-w-5xl">
        <h1 className="text-2xl font-bold">Keepers</h1>
        <p className="text-sm text-fe-ink/70 italic">
          An Index to the Foods of Gideon Lawton Lane
        </p>

        {/* The lead paragraph from the original index page, kept nearly
            verbatim -- it explains what this collection is and why it
            ended up on the web, which nothing else on the page does. */}
        <p className="mt-4 max-w-2xl text-sm text-fe-ink">
          Keepers began life as a cookbook in a small three-ring binder with spatter-proof
          pages. Over time, copies found their way to kitchens in the United States and
          Spain, creating version problems and update difficulties. Posting to the web
          seemed a decent solution.
        </p>

        <hr className="mt-5 mb-5 border-t-[1.5px] border-fe-keeper" />

        {state.kind === 'loading' && (
          <p className="text-fe-ink/60 text-sm">Loading recipes...</p>
        )}
        {state.kind === 'error' && (
          <p className="text-fe-ink/60 text-sm">
            Something went wrong loading the cookbook.
          </p>
        )}

        {state.kind === 'ready' && (
          <>
            <SearchInput
              value={query}
              onChange={setQuery}
              placeholder="Search recipes..."
            />

            <div className="mt-3 flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setGenre(null)}
                aria-pressed={genre === null}
                className={`${FILTER_BASE} ${
                  genre === null
                    ? 'bg-fe-keeper border-fe-keeper text-white'
                    : 'border-fe-keeper text-fe-keeper-link hover:bg-fe-keeper/10'
                }`}
              >
                All
              </button>
              {availableGenres.map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGenre(g)}
                  aria-pressed={genre === g}
                  className={`${FILTER_BASE} ${
                    genre === g
                      ? 'bg-fe-keeper border-fe-keeper text-white'
                      : 'border-fe-keeper text-fe-keeper-link hover:bg-fe-keeper/10'
                  }`}
                >
                  {GENRE_SHORT_LABEL[g] ?? g}
                </button>
              ))}
            </div>

            {visible.length === 0 ? (
              <p className="mt-8 text-fe-ink/60 text-sm">No recipes found.</p>
            ) : (
              // No "Show more": 54 cards at this size land in about ten
              // rows, which is one scroll rather than a pagination
              // control that hides half the cookbook behind a click.
              <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-x-4 gap-y-6">
                {visible.map((recipe) => (
                  <RecipeCard key={recipe.recipe_id} recipe={recipe} />
                ))}
              </div>
            )}

            <p className="mt-8 text-xs text-fe-ink/50">
              {visible.length} of {all.length} recipes
            </p>
          </>
        )}
      </div>
    </Layout>
  )
}
