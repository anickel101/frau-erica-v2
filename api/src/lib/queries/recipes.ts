import type { Database } from 'sql.js'
import { queryAll, queryOne } from '../sqlHelpers'
import type {
  RecipeDetail,
  RecipeIngredient,
  RecipeListItem,
  RecipeSection,
  RecipeStep,
} from '../types'

// is_published = 1 is applied in the query, not filtered afterwards.
// Four recipes were never reachable on the old site and import hidden
// until the Archivist decides on them, so an unpublished recipe must not
// be listable OR fetchable by guessing its slug.
const PUBLISHED = 'r.is_published = 1'

const LIST_COLUMNS = `
  r.recipe_id,
  r.slug,
  r.title,
  r.genre,
  r.summary,
  i.url AS header_image_url`

// LEFT JOIN, not JOIN: header_image_id is nullable and an image row
// could in principle be unpublished. A recipe with no resolvable photo
// should still appear rather than vanishing from the index.
const FROM_RECIPES = `
  FROM Recipes r
  LEFT JOIN Images i ON i.image_id = r.header_image_id`

// Ordered by title rather than by recipe_id: recipe_id reflects the
// order the importer happened to walk the source directory, which is
// meaningless to a reader. The frontend groups by genre and filters
// client-side, so one stable alphabetical list is all this needs to be.
//
// Sorted on the title with its markdown stripped, not the raw title.
// Several titles are italicised in the source -- "*Eierschwer:
// Biskuit oder Schwammkuchen*", "*Heppen:* A German Soul Food",
// "*Johann im Sack...*" -- and '*' sorts before 'A', so ordering on the
// raw value floated all three German heirlooms to the top of the index
// ahead of Anson's Beef. Caught by running this against the real 54.
const SORT_KEY = "REPLACE(r.title, '*', '')"

export function listRecipes(db: Database): RecipeListItem[] {
  return queryAll<RecipeListItem>(
    db,
    `SELECT ${LIST_COLUMNS} ${FROM_RECIPES} WHERE ${PUBLISHED} ORDER BY ${SORT_KEY}`,
  )
}

export function getRecipeBySlug(db: Database, slug: string): RecipeDetail | undefined {
  const recipe = queryOne<RecipeListItem & { source_note: string | null }>(
    db,
    `SELECT ${LIST_COLUMNS}, r.source_note ${FROM_RECIPES}
      WHERE r.slug = :slug AND ${PUBLISHED}`,
    { ':slug': slug },
  )
  if (!recipe) return undefined

  const sections = getSections(db, recipe.recipe_id)
  const bilingual = sections.some(
    (section) =>
      section.ingredients.some((i) => i.lang !== null) ||
      section.steps.some((s) => s.lang !== null),
  )

  return { ...recipe, bilingual, sections }
}

// Three queries rather than one joined query per section: a recipe has
// at most four sections, so this is a fixed handful of statements
// against an in-memory database, and it avoids the row multiplication a
// sections-x-ingredients-x-steps join would produce.
function getSections(db: Database, recipeId: number): RecipeSection[] {
  const sections = queryAll<{
    section_id: number
    label: string | null
    sort_order: number
  }>(
    db,
    `SELECT section_id, label, sort_order FROM RecipeSections
      WHERE recipe_id = :id ORDER BY sort_order`,
    { ':id': recipeId },
  )

  return sections.map((section) => ({
    label: section.label,
    sort_order: section.sort_order,
    // ORDER BY sort_order, lang -- the secondary key matters for the
    // bilingual recipes, where the 'de' and 'en' halves of one line
    // share a sort_order. Without it the pairing would come back in
    // whatever order SQLite happened to produce, and 'de' before 'en'
    // is what puts the original on the left.
    ingredients: queryAll<RecipeIngredient>(
      db,
      `SELECT text, column_no, lang, sort_order FROM RecipeIngredients
        WHERE section_id = :id ORDER BY column_no, sort_order, lang`,
      { ':id': section.section_id },
    ),
    steps: queryAll<RecipeStep>(
      db,
      `SELECT body, lang, sort_order FROM RecipeSteps
        WHERE section_id = :id ORDER BY sort_order, lang`,
      { ':id': section.section_id },
    ),
  }))
}
