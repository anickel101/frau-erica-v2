import { Link } from 'react-router-dom'
import { TextData } from '../data/mockTexts'
import { getAuthorPerson } from '../utils/textDisplay'
import TextByline from './TextByline'

export default function TextStandaloneRow({ document }: { document: TextData }) {
  const authorPerson = getAuthorPerson(document)

  return (
    <article className="py-3 border-b border-fe-brown/20">
      <Link
        to={`/documents/${document.document_id}`}
        className="text-base font-bold text-fe-ink hover:text-fe-accent-dark"
      >
        {document.title}
      </Link>
      <p className="text-xs text-fe-ink/70 mt-0.5">
        <TextByline
          author={document.author}
          authorPerson={authorPerson}
          genre={document.genre}
        />
      </p>
      {document.summary && (
        <p className="text-xs text-fe-ink/80 mt-1">{document.summary}</p>
      )}
    </article>
  )
}
