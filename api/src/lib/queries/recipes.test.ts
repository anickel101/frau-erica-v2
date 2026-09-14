import type { Database } from 'sql.js'
import { beforeAll, describe, expect, test } from 'vitest'
import { createTestDb } from '../testFixtures'
import { getRecipeBySlug, listRecipes } from './recipes'

// A real schema-built database, same as the other query tests -- these
// assertions are meant to prove the SQL, not a mock.
//
// Three recipes, each standing for a real shape in the archive:
//
//   blueberry-buckle  two sections, interleaved ingredients and steps,
//                     and a two-column ingredient list whose split is
//                     semantic (wet in column 1, dry in column 2)
//   sauerbraten       bilingual: 'de' and 'en' halves of one paragraph
//                     sharing a sort_order
//   cold-oats         unpublished, standing for the four recipes that
//                     were never reachable on the old site
let db: Database

beforeAll(async () => {
  db = await createTestDb()
  db.exec(`
    INSERT INTO Images (image_id, url, caption, is_published)
      VALUES (500, 'hdr.Blueberries.jpg', 'Blueberries', 1);

    INSERT INTO Recipes (recipe_id, slug, title, genre, summary, header_image_id,
                         source_note, is_published)
      VALUES (1, 'blueberry-buckle', 'Blueberry Buckle', 'Bakery / Desserts',
              'A very dense coffee cake.', 500, NULL, 1),
             (2, 'sauerbraten', 'Sauerbraten', 'Main Dishes', NULL, NULL,
              'From the 1903 Kochbuch', 1),
             (3, 'cold-oats', 'Cold Breakfast Oats', NULL, NULL, NULL, NULL, 0),
             (4, 'heppen', '*Heppen:* A German Soul Food', 'Little Plates',
              NULL, NULL, NULL, 1);

    INSERT INTO RecipeSections (section_id, recipe_id, label, sort_order)
      VALUES (10, 1, 'For the streusel', 1),
             (11, 1, 'For the buckle', 2),
             (20, 2, NULL, 1),
             (30, 3, NULL, 1);

    INSERT INTO RecipeIngredients (section_id, text, column_no, lang, sort_order)
      VALUES (10, '1/2 cup flour', 1, NULL, 1),
             (10, 'pinch of salt', 1, NULL, 2),
             (11, '2 large eggs', 1, NULL, 1),
             (11, '1 1/2 cups flour', 2, NULL, 2),
             (20, '10 Eier schwer Zucker', 1, 'de', 1),
             (20, 'Sugar, the weight of 10 eggs', 1, 'en', 1),
             (30, '1 cup rolled oats', 1, NULL, 1);

    INSERT INTO RecipeSteps (section_id, body, lang, sort_order)
      VALUES (10, 'Combine the flour and salt.', NULL, 1),
             (11, 'Fold in the blueberries.', NULL, 1),
             (20, 'Das Rindfleisch muss liegen.', 'de', 10),
             (20, 'The beef must marinate.', 'en', 10),
             (30, 'Soak overnight.', NULL, 1);
  `)
})

describe('listRecipes', () => {
  test('returns only published recipes, alphabetically', () => {
    const recipes = listRecipes(db)
    expect(recipes.map((r) => r.slug)).toEqual([
      'blueberry-buckle',
      'heppen',
      'sauerbraten',
    ])
  })

  test('sorts on the title with markdown stripped, not the raw value', () => {
    // Several titles are italicised in the source and '*' sorts before
    // 'A', which floated all three German heirlooms above Anson's Beef
    // when this ordered on the raw title.
    const titles = listRecipes(db).map((r) => r.title)
    expect(titles.indexOf('*Heppen:* A German Soul Food')).toBeGreaterThan(
      titles.indexOf('Blueberry Buckle'),
    )
  })

  test('resolves the header image to a bare filename for the frontend to prefix', () => {
    const buckle = listRecipes(db).find((r) => r.slug === 'blueberry-buckle')
    expect(buckle?.header_image_url).toBe('hdr.Blueberries.jpg')
  })

  test('keeps a recipe whose header image is missing rather than dropping it', () => {
    // LEFT JOIN, not JOIN -- Sauerbraten has no header_image_id.
    const sauerbraten = listRecipes(db).find((r) => r.slug === 'sauerbraten')
    expect(sauerbraten).toBeDefined()
    expect(sauerbraten?.header_image_url).toBeNull()
  })

  test('does not carry ingredients or steps', () => {
    expect(listRecipes(db)[0]).not.toHaveProperty('sections')
  })
})

describe('getRecipeBySlug', () => {
  test('nests sections in order, each with its own ingredients and steps', () => {
    const recipe = getRecipeBySlug(db, 'blueberry-buckle')
    expect(recipe?.sections.map((s) => s.label)).toEqual([
      'For the streusel',
      'For the buckle',
    ])
    expect(recipe?.sections[0].steps.map((s) => s.body)).toEqual([
      'Combine the flour and salt.',
    ])
  })

  test('preserves the semantic two-column ingredient split', () => {
    const section = getRecipeBySlug(db, 'blueberry-buckle')?.sections[1]
    expect(section?.ingredients.map((i) => [i.column_no, i.text])).toEqual([
      [1, '2 large eggs'],
      [2, '1 1/2 cups flour'],
    ])
  })

  test('marks a monolingual recipe as not bilingual', () => {
    expect(getRecipeBySlug(db, 'blueberry-buckle')?.bilingual).toBe(false)
  })

  test('pairs the two halves of a bilingual line on one sort_order, German first', () => {
    const recipe = getRecipeBySlug(db, 'sauerbraten')
    expect(recipe?.bilingual).toBe(true)

    const [germanIngredient, englishIngredient] = recipe!.sections[0].ingredients
    expect([germanIngredient.lang, englishIngredient.lang]).toEqual(['de', 'en'])
    expect(germanIngredient.sort_order).toBe(englishIngredient.sort_order)

    const [germanStep, englishStep] = recipe!.sections[0].steps
    expect([germanStep.lang, englishStep.lang]).toEqual(['de', 'en'])
    expect(germanStep.sort_order).toBe(englishStep.sort_order)
  })

  test('returns undefined for an unpublished recipe, not its contents', () => {
    // The four unindexed recipes import hidden. Knowing the slug must
    // not be enough to read one.
    expect(getRecipeBySlug(db, 'cold-oats')).toBeUndefined()
  })

  test('returns undefined for a slug that does not exist', () => {
    expect(getRecipeBySlug(db, 'no-such-recipe')).toBeUndefined()
  })
})
