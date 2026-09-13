import { Link } from 'react-router-dom'
import InlineMarkdown from './InlineMarkdown'
import { GENRE_SHORT_LABEL, RecipeListItem } from '../types/recipe'
import { resolveImageUrl } from '../utils/imageUrl'

// One recipe on the Keepers index.
//
// Deliberately small -- around 200px wide in the grid, so four or five
// sit in a row on a laptop and 54 recipes land in about ten rows. That
// is browsable in one scroll, which is what lets the page drop the
// "Show more" pagination the other indexes need.
//
// The summary is NOT on the card. It is the one field long enough to
// wreck a small card's rhythm (some run to three sentences), and it is
// the first thing on the recipe page anyway.
export default function RecipeCard({ recipe }: { recipe: RecipeListItem }) {
  return (
    // flex column with the chip pushed down by mt-auto: card titles wrap
    // to one, two or three lines, and without this the genre chips sit at
    // a different height on every card in a row. Grid items stretch to
    // the tallest in their row, so mt-auto lands them all on one line.
    <Link to={`/keepers/${recipe.slug}`} className="group flex h-full flex-col">
      <div className="aspect-[16/9] overflow-hidden bg-fe-brown/20">
        {recipe.header_image_url && (
          <img
            src={resolveImageUrl(recipe.header_image_url)}
            alt=""
            // Every Keepers header is a wide landscape banner (aspect
            // 1.8-2.6), so a 16:9 crop takes the middle and loses almost
            // nothing. width/height are the real recorded dimensions'
            // ratio rather than the rendered size -- they exist to give
            // the browser an aspect ratio to reserve, so the grid does
            // not reflow as photos load.
            width={1000}
            height={563}
            loading="lazy"
            className="h-full w-full object-cover transition group-hover:opacity-90"
          />
        )}
      </div>
      <p className="mt-2 text-xs font-bold text-fe-keeper-link group-hover:text-fe-keeper-link-dark leading-snug">
        <InlineMarkdown>{recipe.title}</InlineMarkdown>
      </p>
      {recipe.genre && (
        <p className="mt-auto pt-1.5">
          <span className="inline-block border border-fe-keeper px-1.5 py-px text-[9px] uppercase tracking-wide text-fe-keeper-link">
            {GENRE_SHORT_LABEL[recipe.genre] ?? recipe.genre}
          </span>
        </p>
      )}
    </Link>
  )
}
