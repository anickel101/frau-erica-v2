import { Link } from 'react-router-dom'
import Layout from '../components/Layout'
import RandomHeaderImage from '../components/RandomHeaderImage'
import { ADELHEID_PARAGRAPHS } from '../content/adelheid'
import { DiamondGlyph, GlyphSlot, SidewaysGlyph } from '../components/NavigationGlyph'
import { getAllGalleryPhotos, pickRandomPhoto } from '../utils/randomPhoto'

// The same three tokens PersonCard gives its boxes, so these swatches
// are the colours themselves rather than an approximation of them.
const GENERATION_LEGEND = [
  {
    label: 'Grandparents',
    className: 'bg-fe-gen-grandparent',
    description:
      'The parents of the couple below, two boxes per side. Blood relations only -- a step-parent or adoptive parent appears on their own family page instead.',
  },
  {
    label: 'The couple',
    className: 'bg-fe-gen-couple',
    // "has ended" is the Archivist's own wording. Worth knowing that the
    // dashes are driven by Relationships.status === 'divorced'
    // specifically (see FamilyPage's isDivorced), not by any ended
    // marriage -- the schema also allows 'widowed' and 'separated', and
    // neither would draw them. No such rows exist today, so the sentence
    // is accurate as things stand; if one is ever recorded, this is the
    // line to revisit.
    description:
      'The two people the page is about. Three dashes mean the marriage has ended.',
  },
  {
    label: 'Children',
    className: 'bg-fe-gen-child',
    description:
      'Their children, oldest first. Adopted children appear here alongside biological ones.',
  },
]

const GLYPH_LEGEND = [
  { glyph: '\u25B2', description: 'Up, to that person\u2019s own parents.' },
  { glyph: '\u25BC', description: 'Down, to that child\u2019s own family page.' },
  {
    glyph: <SidewaysGlyph />,
    description: 'Sideways moves to a previous or subsequent marriage.',
  },
  {
    glyph: <DiamondGlyph />,
    description: 'This person is one of your own direct ancestors.',
  },
]

// Picked once at module load (not during render, which must stay pure) --
// purely decorative, same approach as ContactPage.tsx.
const HEADER_PHOTO = pickRandomPhoto(getAllGalleryPhotos())

export default function UsersGuidePage() {
  return (
    <Layout>
      <div className="p-6">
        <RandomHeaderImage photo={HEADER_PHOTO} />

        {/* text-[14px] to match the summary paragraph on Family and
              Document pages. This page had been running at the browser
              default of 16px, so it read a step larger than everything
              it describes. */}
        <div className="max-w-4xl mt-8 text-[14px]">
          <h1 className="text-2xl sm:text-3xl font-bold mb-8">
            A Guide to FrauErica.org
          </h1>

          <section className="mb-8">
            <h2 className="text-xl font-bold text-fe-brown mb-2">
              Meet Adelheid Rickmeyer
            </h2>
            <div className="space-y-3">
              {ADELHEID_PARAGRAPHS.map((paragraph, i) => (
                <p key={i}>{paragraph}</p>
              ))}
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-bold text-fe-brown mb-2">About these archives</h2>
            <div className="space-y-3">
              <p>
                FrauErica.org is built around the Mueller family tree, beginning with
                Georg and Gertrude Mueller in the Napoleonic era and continuing down
                through the generations to the present day. The photographs, documents,
                and stories collected here come from various family archives, gathered and
                organized over many years.
              </p>
              <p>
                Beyond the family tree itself, you'll find an index of the family's
                letters, memoirs, and other writings; galleries of photographs from
                reunions, weddings, and everyday life; and the Mueller Lexicon, a running
                glossary of the German words and phrases that have persisted in the
                family's daily speech across generations.
              </p>
            </div>
          </section>

          {/* Built from the same colour tokens and the same glyph
              components the Family pages themselves use (see
              components/NavigationGlyph.tsx), not a hand-drawn copy -- a
              legend that quietly stops matching what it describes is
              worse than no legend. */}
          <section className="mb-8">
            <h2 className="text-xl font-bold text-fe-brown mb-2">
              Reading a family page
            </h2>
            <div className="space-y-3">
              <p>
                Every family page is laid out the same way, three generations from top to
                bottom, and the colour of a box tells you which generation you are looking
                at.
              </p>
              <ul className="space-y-2 my-4">
                {GENERATION_LEGEND.map((row) => (
                  <li key={row.label} className="flex items-start gap-3">
                    <span
                      className={`${row.className} w-28 shrink-0 rounded-sm border border-black/10 px-3 py-2 text-xs font-bold`}
                    >
                      {row.label}
                    </span>
                    <span>{row.description}</span>
                  </li>
                ))}
              </ul>
              <p>
                The orange marks to the left of a name are how you move around the tree.
                Each points in the direction it will take you:
              </p>
              <ul className="space-y-2 my-4">
                {GLYPH_LEGEND.map((row) => (
                  <li key={row.description} className="flex items-center gap-3">
                    <GlyphSlot>{row.glyph}</GlyphSlot>
                    <span>{row.description}</span>
                  </li>
                ))}
              </ul>
              <p>
                The diamond is special. Once you are signed in, the site works out your
                own direct line of descent and marks everyone on it. It follows blood
                relations only, so an adoptive parent will not carry a diamond even though
                they appear on the page.
              </p>
              <p>
                Diamonds lead <em>down</em> the tree, not up. They sit on the children,
                and the boxes above them never carry one -- so you cannot follow them
                backwards in time. Instead, jump straight to the far end of a line: the{' '}
                <strong>Ancestry</strong> links in the sidebar take you to your most
                distant known ancestor on each side. From there, follow the diamonds down,
                a generation at a time, and they will lead you back to yourself.
              </p>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-bold text-fe-brown mb-2">Who has access?</h2>
            <div className="space-y-3">
              <p>
                We're sorry, but many of these pages aren't open to the general public --
                the family tree itself, and the pages for individual family members, are
                visible only to people we can confirm belong to the family. Some things
                are best kept within the family circle, and we hope you understand.
              </p>
              <p>
                The photographs, writings, and lexicon gathered here, on the other hand,
                are open for anyone to browse.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-bold text-fe-brown mb-2">
              If you believe you're on the family tree
            </h2>
            <div className="space-y-3">
              <p>
                If you believe you're on a branch of the Mueller family tree,{' '}
                <Link
                  to="/request-access"
                  className="text-fe-link hover:text-fe-link-dark"
                >
                  request access
                </Link>{' '}
                and let us know how you connect to it -- your full name, and whatever you
                know about your Mueller forebears, is a good place to start. The more
                detail you can give us, the faster we can place you on the tree.
              </p>
              <p>
                Have questions before you request access, or need help with anything else?{' '}
                <Link to="/contact" className="text-fe-link hover:text-fe-link-dark">
                  Contact the Archivist
                </Link>{' '}
                directly -- we're happy to help.
              </p>
            </div>
          </section>
        </div>
      </div>
    </Layout>
  )
}
