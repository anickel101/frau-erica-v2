import { Link } from 'react-router-dom'
import Layout from '../components/Layout'
import RandomHeaderImage from '../components/RandomHeaderImage'
import { ADELHEID_PARAGRAPHS } from '../content/adelheid'
import { getAllGalleryPhotos, pickRandomPhoto } from '../utils/randomPhoto'

// Picked once at module load (not during render, which must stay pure) --
// purely decorative, same approach as ContactPage.tsx.
const HEADER_PHOTO = pickRandomPhoto(getAllGalleryPhotos())

export default function UsersGuidePage() {
  return (
    <Layout>
      <div className="p-6">
        <RandomHeaderImage photo={HEADER_PHOTO} />

        <div className="max-w-4xl mt-8">
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
                  className="text-fe-accent hover:text-fe-accent-dark"
                >
                  request access
                </Link>{' '}
                and let us know how you connect to it -- your full name, and whatever you
                know about your Mueller forebears, is a good place to start. The more
                detail you can give us, the faster we can place you on the tree.
              </p>
              <p>
                Have questions before you request access, or need help with anything else?{' '}
                <Link to="/contact" className="text-fe-accent hover:text-fe-accent-dark">
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
