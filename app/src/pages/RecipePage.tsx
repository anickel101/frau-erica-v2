import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { PrinterIcon } from '@heroicons/react/24/outline'
import IconAction from '../components/IconAction'
import InlineMarkdown from '../components/InlineMarkdown'
import Layout from '../components/Layout'
import { getRecipeBySlug } from '../data-access/gated/recipes'
import { useAuth } from '../hooks/useAuth'
import { useHeaderRef } from '../hooks/useHeaderRef'
import {
  GENRE_SHORT_LABEL,
  RecipeDetail,
  RecipeIngredient,
  RecipeSection,
  RecipeStep,
} from '../types/recipe'
import { resolveImageUrl } from '../utils/imageUrl'

type LoadState =
  | { kind: 'loading' }
  | { kind: 'ready'; recipe: RecipeDetail }
  | { kind: 'notFound' }
  | { kind: 'error' }

// Same shape and reasoning as TextPage's TextHeader: useHeaderRef() has
// to be called from inside Layout's children, so it can't be inlined
// into the page component, which is Layout's parent.
//
// print:hidden -- dropping the photograph is the single biggest space
// win on a printed recipe, and nobody needs a half-page of blueberries
// on a kitchen counter.
function RecipeHeader({ imageUrl }: { imageUrl: string }) {
  const headerRef = useHeaderRef()
  return (
    <div
      ref={headerRef}
      className="max-w-4xl h-48 sm:h-64 bg-fe-brown/20 overflow-hidden print:hidden"
    >
      <img src={imageUrl} alt="" className="w-full h-full object-cover" />
    </div>
  )
}

// Group by sort_order, which is how the schema pairs a bilingual line:
// the German and English halves of one paragraph share a sort_order and
// differ only by lang. Monolingual recipes fall through this unchanged,
// one item per group.
function byPair<T extends { sort_order: number }>(items: T[]): T[][] {
  const groups = new Map<number, T[]>()
  for (const item of items) {
    groups.set(item.sort_order, [...(groups.get(item.sort_order) ?? []), item])
  }
  return [...groups.entries()].sort((a, b) => a[0] - b[0]).map(([, group]) => group)
}

function IngredientColumns({
  ingredients,
  bilingual,
}: {
  ingredients: RecipeIngredient[]
  bilingual: boolean
}) {
  if (ingredients.length === 0) return null

  if (bilingual) {
    return (
      <div className="mb-4 space-y-1">
        {byPair(ingredients).map((pair, index) => (
          <div key={index} className="grid gap-x-6 sm:grid-cols-2 text-[12px]">
            {pair.map((ingredient) => (
              <p key={ingredient.lang} className="print-tight">
                <InlineMarkdown>{ingredient.text}</InlineMarkdown>
              </p>
            ))}
          </div>
        ))}
      </div>
    )
  }

  // column_no is content, not layout -- the split is frequently wet/dry
  // -- so the recorded columns are rendered as two real tracks rather
  // than reflowed with CSS `columns`, which would scramble the grouping.
  // They stack on a phone, which preserves the order within each column.
  const columns = [1, 2]
    .map((n) => ingredients.filter((i) => i.column_no === n))
    .filter((column) => column.length > 0)

  return (
    <div
      className={`mb-4 grid gap-x-8 gap-y-1 text-[12px] ${
        columns.length > 1 ? 'sm:grid-cols-2' : ''
      }`}
    >
      {columns.map((column, index) => (
        <ul key={index} className="space-y-0.5">
          {column.map((ingredient, i) => (
            <li key={i} className="print-tight">
              <InlineMarkdown>{ingredient.text}</InlineMarkdown>
            </li>
          ))}
        </ul>
      ))}
    </div>
  )
}

function Steps({ steps, bilingual }: { steps: RecipeStep[]; bilingual: boolean }) {
  if (steps.length === 0) return null

  if (bilingual) {
    return (
      <div className="space-y-3">
        {byPair(steps).map((pair, index) => (
          <div key={index} className="grid gap-x-6 gap-y-2 sm:grid-cols-2 text-[12px]">
            {pair.map((step) => (
              <p key={step.lang}>
                <InlineMarkdown>{step.body}</InlineMarkdown>
              </p>
            ))}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-3 text-[12px]">
      {steps.map((step, index) => (
        <p key={index}>
          <InlineMarkdown>{step.body}</InlineMarkdown>
        </p>
      ))}
    </div>
  )
}

function Section({ section, bilingual }: { section: RecipeSection; bilingual: boolean }) {
  return (
    // print-section keeps a label with its own ingredients across a page
    // break -- "For the streusel:" alone at the foot of a page is the
    // moment a printed recipe stops being usable.
    <div className="print-section mb-6">
      {section.label && (
        <p className="mb-2 text-sm font-bold text-fe-brown">
          <InlineMarkdown>{section.label}</InlineMarkdown>
        </p>
      )}
      <IngredientColumns ingredients={section.ingredients} bilingual={bilingual} />
      <Steps steps={section.steps} bilingual={bilingual} />
    </div>
  )
}

export default function RecipePage() {
  const { slug } = useParams<{ slug: string }>()
  const { status } = useAuth()
  const [state, setState] = useState<LoadState>({ kind: 'loading' })

  useEffect(() => {
    if (status !== 'signedIn' || !slug) return
    let cancelled = false
    getRecipeBySlug(slug)
      .then((recipe) => {
        if (!cancelled) setState({ kind: 'ready', recipe })
      })
      .catch((error: unknown) => {
        if (cancelled) return
        // A 404 here is the ordinary "no such recipe" answer -- including
        // for the four that import unpublished -- and deserves its own
        // message rather than "something went wrong".
        const notFound = error instanceof Error && /\b404\b/.test(error.message)
        setState({ kind: notFound ? 'notFound' : 'error' })
      })
    return () => {
      cancelled = true
    }
  }, [slug, status])

  if (state.kind !== 'ready') {
    return (
      <Layout accent="keepers">
        <div className="p-6 max-w-4xl">
          <p className="text-fe-ink/60 text-sm">
            {state.kind === 'loading' && 'Loading...'}
            {state.kind === 'notFound' && "That recipe isn't in the cookbook."}
            {state.kind === 'error' && 'Something went wrong loading this recipe.'}
          </p>
          {state.kind !== 'loading' && (
            <p className="mt-2 text-sm">
              <Link
                to="/keepers"
                className="text-fe-keeper-link hover:text-fe-keeper-link-dark"
              >
                Back to Keepers
              </Link>
            </p>
          )}
        </div>
      </Layout>
    )
  }

  const { recipe } = state

  return (
    <Layout accent="keepers">
      {recipe.header_image_url && (
        <RecipeHeader imageUrl={resolveImageUrl(recipe.header_image_url)} />
      )}
      <div className="p-6 max-w-4xl">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold">
              <InlineMarkdown>{recipe.title}</InlineMarkdown>
            </h1>
            {recipe.genre && (
              <p className="mt-1 text-sm text-fe-ink/70">
                {GENRE_SHORT_LABEL[recipe.genre] ?? recipe.genre}
              </p>
            )}
          </div>
          {/* window.print() against the print stylesheet, not a separate
              route or a generated PDF -- one source of truth for the
              content, no dependency, and it prints correctly from any
              browser. */}
          <div className="shrink-0 print:hidden">
            <IconAction
              label="Print this recipe"
              variant="keeper"
              onClick={() => window.print()}
            >
              <PrinterIcon />
            </IconAction>
          </div>
        </div>

        {recipe.summary && (
          <p className="mt-4 text-[14px] text-fe-ink">
            <InlineMarkdown>{recipe.summary}</InlineMarkdown>
          </p>
        )}

        <hr className="my-5 border-t-[1.5px] border-fe-keeper" />

        {recipe.sections.map((section) => (
          <Section
            key={section.sort_order}
            section={section}
            bilingual={recipe.bilingual}
          />
        ))}

        {recipe.source_note && (
          <p className="mt-6 text-[11px] text-fe-ink/60 italic">{recipe.source_note}</p>
        )}

        <p className="mt-8 text-sm print:hidden">
          <Link
            to="/keepers"
            className="text-fe-keeper-link hover:text-fe-keeper-link-dark"
          >
            Back to Keepers
          </Link>
        </p>

        {/* Print only. A recipe found in a drawer in twenty years should
            still say where it came from. */}
        <p className="mt-8 hidden border-t border-black pt-2 text-[9pt] print:block">
          frauerica.org &middot; Keepers
        </p>
      </div>
    </Layout>
  )
}
