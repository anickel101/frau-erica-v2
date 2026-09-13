import { describe, expect, it } from 'vitest'
import { htmlToMarkdown, parseIndex, parseRecipe, slugify } from './keepersParser.ts'

// Every fixture below is the real shape of a real source page, reduced
// to the smallest markup that still exercises the rule. The cases exist
// because each one actually broke a first draft of the parser -- they
// are regressions, not hypotheticals.

function page(body: string, columnset = 4): string {
  return `<?php
  $headerFN = "hdr.Test.jpg";
  $columnset = ${columnset};
  print ("<tr><td>");
  ?>
  <p class="head24">Test Recipe</p>
  <p class="summary">A summary.</p>
  ${body}
  <?php require ("../Format/KeepersEnd.php"); ?>`
}

const FENCE_OPEN = '<!--  ======  BEGIN INGREDIENTS  ======  -->'
const FENCE_CLOSE = '<!--  ======  END INGREDIENTS  ======  -->'

describe('htmlToMarkdown', () => {
  it('keeps emphasis as markdown and drops layout tags', () => {
    expect(htmlToMarkdown('<p class="x"><em>Eierschwer</em>: a cake</p>')).toBe(
      '*Eierschwer*: a cake',
    )
  })

  it('decodes the entities these pages actually use', () => {
    expect(htmlToMarkdown('1&#189; cups&nbsp;scotch &mdash; 300&deg;')).toBe(
      '1½ cups scotch — 300°',
    )
  })

  it('leaves an unknown entity visible rather than mangling it', () => {
    expect(htmlToMarkdown('a &weird; b')).toBe('a &weird; b')
  })
})

describe('slugify', () => {
  it('strips apostrophes rather than turning them into separators', () => {
    expect(slugify('Anson’s Beef Method')).toBe('ansons-beef-method')
  })

  it('handles emphasis and punctuation in a title', () => {
    expect(slugify('<em>Heppen:</em> A German Soul Food')).toBe(
      'heppen-a-german-soul-food',
    )
  })
})

describe('parseIndex', () => {
  it('reads the five fields of each record off one long line', () => {
    const php = `<?php$arrayKeepers = array (array (  'genre' => "Soups",     'tag' => "Tomato",     'title' => "Cream of Tomato Soup",     'summary' => "A commonplace among soups.",     'URL' => "TomatoSoup.php",     ),);?>`
    expect(parseIndex(php)).toEqual([
      {
        genre: 'Soups',
        tag: 'Tomato',
        title: 'Cream of Tomato Soup',
        summary: 'A commonplace among soups.',
        url: 'TomatoSoup.php',
      },
    ])
  })
})

describe('the fenced Keepers dialect', () => {
  it('splits interleaved ingredient/step runs into ordered sections', () => {
    const recipe = parseRecipe(
      page(`
        ${FENCE_OPEN}
        <p class="text14"><strong>For the streusel:</strong></p>
        <p class="text12" style="text-align:center;">1/2 cup flour<br>pinch of salt<br></p>
        ${FENCE_CLOSE}
        <p class="text12">Combine the flour and salt.</p>
        ${FENCE_OPEN}
        <p class="text14"><strong>For the buckle:</strong></p>
        <p class="text12" style="text-align:center;">2 eggs<br>4 cups blueberries<br></p>
        ${FENCE_CLOSE}
        <p class="text12">Fold in the blueberries.</p>
      `),
    )

    expect(recipe.sections.map((s) => s.label)).toEqual([
      'For the streusel',
      'For the buckle',
    ])
    // Prose between two fences belongs to the section it follows, not
    // the one it precedes.
    expect(recipe.sections[0].steps.map((s) => s.body)).toEqual([
      'Combine the flour and salt.',
    ])
    expect(recipe.sections[1].steps.map((s) => s.body)).toEqual([
      'Fold in the blueberries.',
    ])
  })

  it('preserves the two ingredient columns, which are semantic', () => {
    // Carrot Muffins puts wet in column 1 and dry in column 2. Flattening
    // them, or letting CSS reflow them, loses a grouping the cook uses.
    const recipe = parseRecipe(
      page(`
        ${FENCE_OPEN}
        <p class="text14"><strong>Have ready:</strong></p>
        <p class="text12" style="text-align:center;">2 large eggs<br>1/4 cup milk<br></p>
        <p class="text12" style="text-align:center;">1 1/2 cups flour<br>1/2 tsp. salt<br></p>
        ${FENCE_CLOSE}
      `),
    )
    const ingredients = recipe.sections[0].ingredients
    expect(ingredients.filter((i) => i.columnNo === 1).map((i) => i.text)).toEqual([
      '2 large eggs',
      '1/4 cup milk',
    ])
    expect(ingredients.filter((i) => i.columnNo === 2).map((i) => i.text)).toEqual([
      '1 1/2 cups flour',
      '1/2 tsp. salt',
    ])
  })

  it('takes anything inside a fence as ingredients, however short', () => {
    // Sauerkraut's entire list is cabbage and salt, and it is not
    // centred. A shape-based guess dropped it; the fence is the marker.
    const recipe = parseRecipe(
      page(`
        ${FENCE_OPEN}
        <p class="text12">5 lbs. green cabbage<br>3 tbs. kosher salt<br></p>
        ${FENCE_CLOSE}
      `),
    )
    expect(recipe.sections[0].ingredients.map((i) => i.text)).toEqual([
      '5 lbs. green cabbage',
      '3 tbs. kosher salt',
    ])
  })

  it('reads a colon-terminated line as the label when there is no bold', () => {
    // Anson's Beef uses text14 for its whole body and marks the label
    // with a trailing colon instead of <strong>.
    const recipe = parseRecipe(
      page(`
        ${FENCE_OPEN}
        <p class="text14" style="margin-top:8px;">Have ready:</p>
        <p class="text14" style="text-align:center;">Prime beef steaks<br>Salt and pepper<br>Paper towels<br></p>
        ${FENCE_CLOSE}
        <p class="text14">Lay out the beef for up to an hour.</p>
      `),
    )
    expect(recipe.sections[0].label).toBe('Have ready')
    expect(recipe.sections[0].ingredients).toHaveLength(3)
    expect(recipe.sections[0].steps).toHaveLength(1)
  })
})

describe('the unfenced dialect', () => {
  it('starts a new section on a short colon-terminated line', () => {
    // Molly's Fruitcake gave only its first batch scale a real heading;
    // the others are announced in ordinary body copy.
    const recipe = parseRecipe(
      page(`
        <p class="text18" style="text-align:center;">The basic recipe</p>
        <p class="text12" style="text-align:center;">2 cups raisins<br>2 cups dates<br>2 cups sugar<br>2 cups water<br></p>
        <p class="text12">Cook for 20 minutes.</p>
        <p class="text12">To triple the recipe (ca. 13 small loaves):</p>
        <p class="text12" style="text-align:center;">6 cups raisins<br>1 lb. dates<br>2 lbs. sugar<br>4 cups water<br></p>
      `),
      { dialect: 'text' },
    )
    expect(recipe.sections.map((s) => s.label)).toEqual([
      'The basic recipe',
      'To triple the recipe (ca. 13 small loaves)',
    ])
    expect(recipe.sections[1].ingredients).toHaveLength(4)
  })
})

describe('bilingual recipes', () => {
  const bilingual = (body: string) => parseRecipe(page(body, 2))

  it('pairs the two halves of a row on one sort order', () => {
    const recipe = bilingual(`
      <tr><td><p class="text12">Das Rindfleisch muss 8 Tage liegen.</p></td>
      <td><p class="text12">The beef must marinate for 8 days.</p></td></tr>
    `)
    expect(recipe.bilingual).toBe(true)
    const [german, english] = recipe.sections[0].steps
    expect([german.lang, english.lang]).toEqual(['de', 'en'])
    expect(german.sortOrder).toBe(english.sortOrder)
  })

  it('keeps a footnote in the language of the cell it sits in', () => {
    // Sauerbraten's German footnote carries no style attribute at all. A
    // per-paragraph margin rule dropped it silently; splitting on cells
    // keeps it.
    const recipe = bilingual(`
      <tr><td><p class="text14"><strong>Sauerbraten</strong><br>Im Winter 8-14 Tage.</p>
      <p class="text12">* Possible typo: 3-8 would make more sense.</p></td>
      <td><p class="text14" style="margin-left:18px;"><strong>Sauerbraten</strong><br>8-14 days in winter.</p></td></tr>
    `)
    const german = recipe.sections[0].steps.filter((s) => s.lang === 'de')
    expect(german).toHaveLength(2)
    expect(german[1].body).toContain('Possible typo')
  })

  it('puts a single-cell row in its own monolingual section', () => {
    // Eierschwer carries a modern adaptation after the 1903 original,
    // inside the same table but in a colspan row. Treating everything
    // after the last </tr> as trailing duplicated the whole recipe.
    const recipe = bilingual(`
      <tr><td><p class="text12">Original, auf Deutsch.</p></td>
      <td><p class="text12">The original, in English.</p></td></tr>
      <tr><td valign="top" colspan="2"><p class="text12">Modern bakers want more detail.</p></td></tr>
    `)
    expect(recipe.sections).toHaveLength(2)
    expect(recipe.sections[0].steps.map((s) => s.lang)).toEqual(['de', 'en'])
    expect(recipe.sections[1].steps).toEqual([
      { body: 'Modern bakers want more detail.', lang: null, sortOrder: 1 },
    ])
  })
})

describe('recipe-level fields', () => {
  it('prefers the index summary and says so, since the two disagree often', () => {
    const recipe = parseRecipe(page('<p class="text12">A step.</p>'), {
      indexEntry: {
        genre: 'Soups',
        tag: 'Test',
        title: 'Indexed Title',
        summary: 'The edited summary.',
        url: 'Test.php',
      },
    })
    expect(recipe.title).toBe('Indexed Title')
    expect(recipe.summary).toBe('The edited summary.')
    expect(recipe.warnings).toContain(
      'index summary differs from the page summary; using the index copy',
    )
  })

  it('lets an explicit title override a page whose headline is wrong', () => {
    // PestoPasta.php was cloned from another recipe and kept its
    // headline, so the page title cannot be trusted there.
    const recipe = parseRecipe(page('<p class="text12">A step.</p>'), {
      titleOverride: 'Presto Pasta',
    })
    expect(recipe.title).toBe('Presto Pasta')
    expect(recipe.slug).toBe('presto-pasta')
  })

  it('flags an unindexed recipe and leaves it unpublished', () => {
    const recipe = parseRecipe(page('<p class="text12">A step.</p>'))
    expect(recipe.isPublished).toBe(false)
    expect(recipe.warnings).toContain('no genre; recipe was not in the index')
  })
})
