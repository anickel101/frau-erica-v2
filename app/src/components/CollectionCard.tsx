import { Link } from 'react-router-dom'
import { Collection } from '../data-access/public/collections'

// What a collection's kind is called on the card. The kind itself is
// structural -- how the texts relate to each other -- so the label says
// what the reader is about to get rather than naming the enum: a run of
// letters, a work in chapters, or a gathering about one person.
function kindLabel(collection: Collection): string {
  const n = collection.chapterCount
  switch (collection.kind) {
    case 'annual':
      return `${n} letters`
    case 'work':
      return `${n} chapters`
    case 'person':
      // "6 texts about him" would need a pronoun the archive doesn't
      // record, so the neutral form is the honest one.
      return `${n} texts`
  }
}

export default function CollectionCard({ collection }: { collection: Collection }) {
  return (
    <article className="border border-fe-brown/30 bg-white/40">
      <Link
        to={`/collections/${collection.slug}`}
        className="group block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fe-accent"
      >
        {collection.cover_image_url && (
          // aspect-[3/2] with object-cover, so nineteen covers of wildly
          // different shapes -- portraits, a title page, a harbour
          // panorama -- make one even shelf rather than a ragged grid.
          <img
            src={collection.cover_image_url}
            alt=""
            loading="lazy"
            className="aspect-[3/2] w-full object-cover"
          />
        )}
        <div className="p-3">
          <h3 className="text-sm font-bold leading-snug text-fe-ink group-hover:text-fe-link-dark">
            {collection.name}
          </h3>
          <p className="mt-1 text-[11px] uppercase tracking-wide text-fe-brown">
            {kindLabel(collection)}
          </p>
          {collection.blurb && (
            <p className="mt-1.5 text-xs text-fe-ink/80 line-clamp-3">
              {collection.blurb}
            </p>
          )}
        </div>
      </Link>
    </article>
  )
}
