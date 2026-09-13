// Mirrors api/src/lib/types.ts's Recipe* shapes. app/ and api/ are
// separate dependency trees with no shared package, so these are
// redeclared rather than imported -- the same convention the Person and
// Family types here already follow.

export interface RecipeListItem {
  recipe_id: number
  slug: string
  title: string
  genre: string | null
  summary: string | null
  // Bare Images.url filename -- pass through resolveImageUrl().
  header_image_url: string | null
}

export interface RecipeIngredient {
  text: string
  // Which of the source's two ingredient columns this line belongs to.
  // Content, not layout: the split is frequently semantic (wet in 1, dry
  // in 2), so render it as recorded rather than reflowing with CSS.
  column_no: number
  // null for the monolingual majority; 'de'/'en' for the three recipes
  // from Frau Erica's 1903 cookbook, whose halves share a sort_order.
  lang: string | null
  sort_order: number
}

export interface RecipeStep {
  body: string
  lang: string | null
  sort_order: number
}

export interface RecipeSection {
  label: string | null
  sort_order: number
  ingredients: RecipeIngredient[]
  steps: RecipeStep[]
}

export interface RecipeDetail extends RecipeListItem {
  source_note: string | null
  bilingual: boolean
  sections: RecipeSection[]
}

// The closed set from the original cookbook's own index page. Drives the
// filter row on /keepers, in the order the old site listed them.
export const RECIPE_GENRES = [
  'Jams / Canning',
  'Bakery / Desserts',
  'Little Plates',
  'Soups',
  'Main Dishes',
  'Vegetables / Sides',
] as const

// The old index page showed shorter labels than it stored. Keeping the
// stored values as the source of truth and shortening only for display
// means the filter row fits on a phone without a second column in the
// database to keep in sync.
export const GENRE_SHORT_LABEL: Record<string, string> = {
  'Jams / Canning': 'Canning',
  'Bakery / Desserts': 'Baking',
  'Little Plates': 'Little Plates',
  Soups: 'Soups',
  'Main Dishes': 'Main Dishes',
  'Vegetables / Sides': 'Sides',
}
