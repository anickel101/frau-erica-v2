export interface TextData {
  document_id: number
  series_key: string | null
  series_title: string | null
  series_order: number | null
  title: string
  author: string | null
  authorPersonId: number | null // person_id in mockPersons, or null if author isn't a known Person
  summary: string | null
  content: string // markdown
  genre:
    'Biography' | 'Memoir' | 'History' | 'Literary' | 'Letter' | 'Recipe' | 'Other' | null
  tags: string | null
  notes: string | null
}

function text(
  data: Omit<TextData, 'series_key' | 'series_title' | 'series_order'>,
): TextData {
  return { series_key: null, series_title: null, series_order: null, ...data }
}

const standaloneTexts: TextData[] = [
  text({
    document_id: 1,
    title: 'The Mueller Family Bible: A Transcription',
    author: 'Ernst Mueller',
    authorPersonId: 14,
    genre: 'History',
    tags: 'bible,transcription,genealogy',
    notes: null,
    summary:
      'A page-by-page transcription of the births, marriages, and deaths recorded in the front matter of the family bible, cross-referenced against known dates where they diverge.',
    content:
      'The family bible has traveled with the Muellers since the crossing, and its front matter carries handwritten entries in at least three different hands across four generations...',
  }),
  text({
    document_id: 2,
    title: "Grandma's Speculaas",
    author: 'Erna Mueller',
    authorPersonId: 62,
    genre: 'Recipe',
    tags: 'recipe,christmas,baking',
    notes: null,
    summary:
      'The spiced Dutch-style cookie recipe that appeared every December, written down at last after years of being passed along by memory alone.',
    content:
      'Cream the butter and brown sugar, then work in the spices -- cinnamon, cloves, nutmeg, and a little white pepper, which is the part everyone forgets...',
  }),
  text({
    document_id: 3,
    title: 'A Letter Home, 1918',
    author: 'Kurt Mueller',
    authorPersonId: 66,
    genre: 'Letter',
    tags: 'letter,wwi',
    notes: null,
    summary:
      'A short letter describing camp life, written to be read aloud to the family back home.',
    content:
      'Dear all, I am well and the food here is better than the stories would have you believe...',
  }),
  text({
    document_id: 4,
    title: 'Notes on the Rösing Emigration',
    author: 'The Archivist',
    authorPersonId: null,
    genre: 'History',
    tags: 'emigration,rösing',
    notes: null,
    summary:
      "A working reconstruction of the Rösing family's journey from the old country, assembled from ship manifests and parish records.",
    content:
      'Passenger records place the family aboard a steamer departing in early spring, though the exact port of origin remains disputed between two branches of the family...',
  }),
  text({
    document_id: 5,
    title: 'Growing Up on Ridgeland Avenue',
    author: 'John Arthur Schreiber',
    authorPersonId: 453,
    genre: 'Memoir',
    tags: 'memoir,oak-park',
    notes: null,
    summary:
      'Recollections of a childhood spent on Ridgeland Avenue, from the corner store that no longer exists to the annual block party.',
    content:
      'The house on Ridgeland had a porch deep enough to sleep on in summer, which more than one of us did more than once...',
  }),
  text({
    document_id: 6,
    title: 'A Fictional Account of the Crossing',
    author: 'Unknown',
    authorPersonId: null,
    genre: 'Literary',
    tags: 'fiction,crossing',
    notes: null,
    summary:
      "An unsigned short story, likely written decades after the fact, imagining the ocean crossing from a child's point of view.",
    content:
      'The ship groaned like an old man turning over in bed, and Mathilde decided this was as good a sound as any to fall asleep to...',
  }),
  text({
    document_id: 7,
    title: 'In Memory of Walter Dahl',
    author: 'The Family',
    authorPersonId: null,
    genre: 'Biography',
    tags: 'obituary,dahl',
    notes: null,
    summary:
      'A remembrance written for the memorial service, covering the full span of a long life.',
    content:
      "Walter was, above all else, a patient man -- patient with engines, patient with grandchildren, patient with the lake when the fish weren't biting...",
  }),
  text({
    document_id: 8,
    title: 'Family Reunion Program, 1962',
    author: 'Reunion Committee',
    authorPersonId: null,
    genre: 'Other',
    tags: 'reunion,program',
    notes: null,
    summary:
      'The printed program handed out at the 1962 reunion, schedule of events and all.',
    content:
      '9:00 -- Coffee and rolls. 10:30 -- Group photograph, weather permitting. Noon -- Potluck lunch, please label your dishes...',
  }),
  text({
    document_id: 9,
    title: 'A Wedding at the Gahl Farm',
    author: 'William Gahl',
    authorPersonId: 320,
    genre: 'Memoir',
    tags: 'wedding,gahl',
    notes: null,
    summary:
      'An account of a farmhouse wedding, written many years after the fact from memory.',
    content:
      'We strung the lights between the barn and the oak tree ourselves, and I am fairly sure at least one strand is still up there...',
  }),
  text({
    document_id: 10,
    title: 'Cousins at the Lake, Remembered',
    author: 'George Watson Knowles',
    authorPersonId: 801,
    genre: 'Memoir',
    tags: 'lake,cousins',
    notes: null,
    summary:
      'Summers at Height of Land, Minnesota, as remembered by one of the regular cousins.',
    content:
      'There was an unofficial rule that nobody left the dock before the last cousin arrived, which some summers meant a very long wait...',
  }),
  text({
    document_id: 11,
    title: 'The Watson Recipe Box',
    author: 'Gail Watson',
    authorPersonId: 802,
    genre: 'Recipe',
    tags: 'recipe,watson',
    notes: null,
    summary:
      'A selection of recipe cards from the Watson family box, transcribed with their original notes intact.',
    content:
      'Half the cards are stained past reading, but the ones that survive show a real fondness for anything involving buttermilk...',
  }),
]

const muellerHomesteadSeries: TextData[] = [
  {
    document_id: 12,
    series_key: 'mueller-homestead',
    series_title: 'The Mueller Homestead Years',
    series_order: 1,
    title: 'Arrival in Illinois',
    author: 'Kurt Mueller',
    authorPersonId: 66,
    genre: 'Memoir',
    tags: 'homestead,illinois',
    notes: null,
    summary:
      "The first chapter of a longer memoir, covering the family's arrival and first months settling into Illinois.",
    content:
      'We arrived in late autumn, which in hindsight was not the ideal season to start breaking ground, but there was no waiting for spring...',
  },
  {
    document_id: 13,
    series_key: 'mueller-homestead',
    series_title: 'The Mueller Homestead Years',
    series_order: 2,
    title: 'The Winter of the Flood',
    author: 'Kurt Mueller',
    authorPersonId: 66,
    genre: 'Memoir',
    tags: 'homestead,flood',
    notes: null,
    summary:
      'A hard winter, a spring thaw, and the flood that nearly took the barn with it.',
    content:
      'The creek had never come up that high in living memory, and by the time we noticed, the lower field was already gone...',
  },
  {
    document_id: 14,
    series_key: 'mueller-homestead',
    series_title: 'The Mueller Homestead Years',
    series_order: 3,
    title: 'Letters from the Front',
    author: 'Kurt Mueller',
    authorPersonId: 66,
    genre: 'Memoir',
    tags: 'homestead,wwi,letters',
    notes: null,
    summary:
      'The homestead years interrupted by war -- what it was like to keep the farm running while waiting on letters from the front.',
    content:
      'Mail call became the shape of the week. Everything else -- planting, mending fence, the milking -- happened around it...',
  },
]

const germanChristmasSeries: TextData[] = [
  {
    document_id: 15,
    series_key: 'german-christmas',
    series_title: 'Recollections of a German Christmas',
    series_order: 1,
    title: 'Advent in the Old Country',
    author: 'Erna Mueller',
    authorPersonId: 62,
    genre: 'Memoir',
    tags: 'christmas,advent',
    notes: null,
    summary:
      'The Advent traditions carried over from the old country, before they began to change here.',
    content:
      'Each Sunday of Advent had its own small ceremony, and woe to the household that let a candle burn unevenly...',
  },
  {
    document_id: 16,
    series_key: 'german-christmas',
    series_title: 'Recollections of a German Christmas',
    series_order: 2,
    title: 'Christmas Eve at the Farmhouse',
    author: 'Erna Mueller',
    authorPersonId: 62,
    genre: 'Memoir',
    tags: 'christmas,farmhouse',
    notes: null,
    summary:
      'How Christmas Eve was celebrated at the farmhouse, from the tree to the midnight service.',
    content:
      'The tree went up on the 24th and not a day before, decorated with real candles that someone had to watch the entire evening...',
  },
]

const deHaasCorrespondenceSeries: TextData[] = [
  {
    document_id: 17,
    series_key: 'dehaas-correspondence',
    series_title: 'The de Haas Correspondence',
    series_order: 1,
    title: 'Letters, 1932-1935',
    author: null,
    authorPersonId: null,
    genre: 'Letter',
    tags: 'dehaas,correspondence',
    notes: null,
    summary:
      'The earliest surviving letters in the de Haas correspondence, mostly concerning family business.',
    content:
      'The tone in these early letters is formal, almost stiff, compared to what the correspondence would later become...',
  },
  {
    document_id: 18,
    series_key: 'dehaas-correspondence',
    series_title: 'The de Haas Correspondence',
    series_order: 2,
    title: 'Letters, 1936-1939',
    author: null,
    authorPersonId: null,
    genre: 'Letter',
    tags: 'dehaas,correspondence',
    notes: null,
    summary:
      'Letters from the years leading up to the war, increasingly concerned with news from abroad.',
    content:
      'By 1938 nearly every letter opens with a question about the news, before moving on to anything else...',
  },
  {
    document_id: 19,
    series_key: 'dehaas-correspondence',
    series_title: 'The de Haas Correspondence',
    series_order: 3,
    title: 'Letters, 1940-1945',
    author: null,
    authorPersonId: null,
    genre: 'Letter',
    tags: 'dehaas,correspondence,wwii',
    notes: null,
    summary:
      'Wartime letters, sparser and more carefully worded than those that came before.',
    content:
      "Several letters from this period are missing entire paragraphs, blacked out by the censor's hand...",
  },
  {
    document_id: 20,
    series_key: 'dehaas-correspondence',
    series_title: 'The de Haas Correspondence',
    series_order: 4,
    title: 'A Final Postcard',
    author: null,
    authorPersonId: null,
    genre: 'Letter',
    tags: 'dehaas,correspondence',
    notes: null,
    summary:
      'The last item in the collection -- a single postcard, undated, that closes out the correspondence.',
    content:
      'No postmark survives, and the handwriting is unsteady enough that some in the family doubt it was written by the same hand as the rest...',
  },
]

export const mockTexts: TextData[] = [
  ...standaloneTexts,
  ...muellerHomesteadSeries,
  ...germanChristmasSeries,
  ...deHaasCorrespondenceSeries,
]
