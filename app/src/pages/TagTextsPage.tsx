import { useEffect, useMemo, useState, type MouseEvent } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { XMarkIcon } from '@heroicons/react/24/outline'
import IconAction from '../components/IconAction'
import InlineMarkdown from '../components/InlineMarkdown'
import Layout from '../components/Layout'
import PersonSearch from '../components/PersonSearch'
import { getCollectionByKey } from '../data-access/public/collections'
import { GENRES } from '../types/document'
import {
  listTextEdits,
  saveTextEdits,
  type EditableText,
  type TextEdit,
} from '../data-access/gated/textEdits'
import { mockPersons } from '../data/mockPersons'
import { getFullName } from '../utils/personDisplay'
import { personLabel } from '../utils/tagSuggestions'
import {
  FILTERS,
  changesBetween,
  groupTexts,
  isTextFilter,
  legacyTagSearches,
  matchesFilter,
  withPending,
  type TextFilter,
  type TextValues,
} from '../utils/textEditState'

// Cataloguing texts: who wrote each one, what kind of text it is, its
// summary, and which people it concerns.
//
// The text-shaped sibling of TagPhotosPage, and built on the same
// promise: nothing here can damage the archive. Edits are saved to their
// own store and reach the archive later, in a batch someone reads first
// (scripts/reviewTextEdits.ts).
//
// Unlike photo tags, these save with a button. A summary is typed, not
// tapped, and saving every keystroke as a proposal would bury the one
// that was meant.
//
// The people linked to a text are not listed on the text's own page.
// They are what puts the text in that person's pop-up on their Family
// page, and what any later linking of names in the text will draw on.

const personById = new Map(mockPersons.map((p) => [p.person_id, p]))

function personName(id: number): string {
  const person = personById.get(id)
  return person ? personLabel(person) : `Person ${id}`
}

function collectionName(seriesKey: string): string | undefined {
  return getCollectionByKey(seriesKey)?.name
}

export default function TagTextsPage() {
  const { documentId } = useParams<{ documentId: string }>()
  const [searchParams] = useSearchParams()
  const show = searchParams.get('show')
  const filter: TextFilter = isTextFilter(show) ? show : 'all'

  const [data, setData] = useState<{ texts: EditableText[]; edits: TextEdit[] } | null>(
    null,
  )
  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    let cancelled = false
    listTextEdits()
      .then((loaded) => {
        if (!cancelled) setData(loaded)
      })
      .catch(() => {
        if (!cancelled) setLoadError(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const groups = useMemo(
    () => (data ? groupTexts(data.texts, collectionName) : []),
    [data],
  )

  let body
  if (loadError) {
    body = (
      <p role="alert" className="text-sm text-red-700">
        Couldn&rsquo;t load the texts. Check your connection and reload the page.
      </p>
    )
  } else if (!data) {
    body = <p className="text-sm text-fe-ink/60">Loading&hellip;</p>
  } else if (documentId) {
    body = (
      <EditText
        documentId={Number(documentId)}
        groups={groups}
        edits={data.edits}
        filter={filter}
        onSaved={(id, saved) =>
          setData(
            (current) =>
              current && {
                ...current,
                edits: [...current.edits.filter((e) => e.document_id !== id), ...saved],
              },
          )
        }
      />
    )
  } else {
    body = <ChooseText groups={groups} edits={data.edits} filter={filter} />
  }

  return (
    <Layout>
      <div className="p-6 max-w-4xl">{body}</div>
    </Layout>
  )
}

function listHref(filter: TextFilter): string {
  return filter === 'all' ? '/admin/tag-texts' : `/admin/tag-texts?show=${filter}`
}

function textHref(documentId: number, filter: TextFilter): string {
  return filter === 'all'
    ? `/admin/tag-texts/${documentId}`
    : `/admin/tag-texts/${documentId}?show=${filter}`
}

// ---------------------------------------------------------------- picker

function ChooseText({
  groups,
  edits,
  filter,
}: {
  groups: ReturnType<typeof groupTexts>
  edits: TextEdit[]
  filter: TextFilter
}) {
  const pendingDocs = new Set(edits.map((e) => e.document_id))
  const total = groups.reduce((n, g) => n + g.texts.length, 0)

  const shown = groups
    .map((group) => ({
      ...group,
      texts: group.texts.filter((text) =>
        matchesFilter(
          withPending(text, edits),
          pendingDocs.has(text.document_id),
          filter,
        ),
      ),
    }))
    .filter((group) => group.texts.length > 0)
  const shownCount = shown.reduce((n, g) => n + g.texts.length, 0)

  return (
    <>
      <h1 className="text-2xl font-bold mb-1">Tag texts</h1>
      <p className="text-sm text-fe-ink/70 mb-4 max-w-prose">
        Pick a text, then say who wrote it, what kind of text it is, and who it is about.
        Nothing you save changes the site straight away &mdash; Anson adds saved edits to
        the archive in batches.
      </p>

      {/* The answer to "is anything waiting?" -- the same gap between
          saving and appearing that the photo-tagging page reports. */}
      {edits.length > 0 && (
        <p className="mb-4 border-l-2 border-fe-accent bg-fe-brown/5 py-2 pl-3 text-sm text-fe-ink/80">
          <strong>{pendingDocs.size}</strong>{' '}
          {pendingDocs.size === 1 ? 'text has' : 'texts have'} edits saved but not yet
          added to the archive.
        </p>
      )}

      <p className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {FILTERS.map(({ key, label }) =>
          key === filter ? (
            <span key={key} className="font-bold text-fe-ink">
              {label}
            </span>
          ) : (
            <Link
              key={key}
              to={listHref(key)}
              className="text-fe-link hover:text-fe-link-dark"
            >
              {label}
            </Link>
          ),
        )}
      </p>
      <p className="mb-4 text-xs text-fe-ink/60">
        {filter === 'all' ? `${total} texts` : `${shownCount} of ${total} texts`}
      </p>

      {shown.length === 0 && (
        <p className="text-sm text-fe-ink/60">Nothing left here. Well done.</p>
      )}

      {shown.map((group) => (
        <section key={group.key} className="mb-6">
          <h2 className="mb-1 text-sm font-bold text-fe-brown">{group.name}</h2>
          <ul>
            {group.texts.map((text) => {
              const values = withPending(text, edits)
              return (
                <li key={text.document_id}>
                  <Link
                    to={textHref(text.document_id, filter)}
                    className="flex items-baseline justify-between gap-4 border-b border-fe-brown/20 py-2 hover:bg-black/5"
                  >
                    <span className="text-sm font-bold text-fe-ink">
                      <InlineMarkdown>{text.title}</InlineMarkdown>
                    </span>
                    <span className="shrink-0 text-right text-xs text-fe-ink/60">
                      {values.author ?? 'no author'} &middot; {values.genre ?? 'no genre'}{' '}
                      &middot; {values.person_ids.length} linked
                      {pendingDocs.has(text.document_id) && (
                        <span className="block text-fe-accent-dark">
                          edits awaiting the archive
                        </span>
                      )}
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </>
  )
}

// ---------------------------------------------------------------- editor

function EditText({
  documentId,
  groups,
  edits,
  filter,
  onSaved,
}: {
  documentId: number
  groups: ReturnType<typeof groupTexts>
  edits: TextEdit[]
  filter: TextFilter
  onSaved: (documentId: number, edits: TextEdit[]) => void
}) {
  const order = groups.flatMap((g) => g.texts)
  const position = order.findIndex((t) => t.document_id === documentId)
  const text = order[position]

  // Previous and Next walk the list the editor came from, filter and
  // all, so "No author" can be worked through one text after another.
  // Judged on the current state, so a text fixed a moment ago drops out
  // of the walk -- but always relative to this text's place in the
  // whole list, which it never leaves.
  const pendingDocs = new Set(edits.map((e) => e.document_id))
  const matches = (t: EditableText) =>
    matchesFilter(withPending(t, edits), pendingDocs.has(t.document_id), filter)
  const previous = order.slice(0, Math.max(position, 0)).reverse().find(matches)
  const next = order.slice(position + 1).find(matches)

  // A save hands back new pending edits, which changes what the form
  // opens with -- so the form is rebuilt from them rather than patched.
  const [saves, setSaves] = useState(0)

  if (!text) {
    return (
      <p className="text-sm text-fe-ink/60">
        That isn&rsquo;t a published text.{' '}
        <Link to={listHref(filter)} className="text-fe-link hover:text-fe-link-dark">
          Back to the list
        </Link>
      </p>
    )
  }

  const pending = edits.filter((e) => e.document_id === documentId)
  const collection = text.series_key ? collectionName(text.series_key) : undefined

  return (
    <>
      <p className="text-sm text-fe-brown mb-1">
        <Link to={listHref(filter)} className="hover:text-fe-link-dark">
          Tag texts
        </Link>
      </p>
      <h1 className="text-xl sm:text-2xl font-bold mb-1">
        <InlineMarkdown>{text.title}</InlineMarkdown>
      </h1>
      <p className="text-sm text-fe-ink/70 mb-4">
        {collection && <>{collection} &middot; </>}
        <a
          href={`/documents/${text.document_id}`}
          target="_blank"
          rel="noreferrer"
          className="text-fe-link hover:text-fe-link-dark"
        >
          Read the text &#8599;
        </a>
      </p>

      <TextForm
        key={`${documentId}:${saves}`}
        text={text}
        pending={pending}
        previousHref={previous && textHref(previous.document_id, filter)}
        nextHref={next && textHref(next.document_id, filter)}
        onSaved={(saved) => {
          onSaved(documentId, saved)
          setSaves((n) => n + 1)
        }}
      />
    </>
  )
}

const LABEL_CLASS = 'mb-1 block text-sm font-bold text-fe-brown'
const HINT_CLASS = 'mb-2 text-xs text-fe-ink/60 max-w-prose'
const INPUT_CLASS =
  'w-full max-w-sm rounded-sm border border-fe-brown/40 bg-white px-3 py-2 text-sm focus:border-fe-accent focus:outline-none'

function TextForm({
  text,
  pending,
  previousHref,
  nextHref,
  onSaved,
}: {
  text: EditableText
  pending: TextEdit[]
  previousHref: string | undefined
  nextHref: string | undefined
  onSaved: (edits: TextEdit[]) => void
}) {
  const initial = useMemo(() => withPending(text, pending), [text, pending])
  const [values, setValues] = useState<TextValues>(initial)
  const [authorQuery, setAuthorQuery] = useState('')
  const [peopleQuery, setPeopleQuery] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const changes = changesBetween(initial, values)
  const dirty = Object.keys(changes).length > 0
  const set = (patch: Partial<TextValues>) => setValues((v) => ({ ...v, ...patch }))

  // Which fields carry an edit not yet in the archive, so each can say
  // so beside itself rather than in a list the editor has to match up.
  const pendingField = new Set(pending.map((e) => e.field))
  const archive = withPending(text, [])

  // Links the archive has that the form is about to drop -- shown, so a
  // removal is visible and can be taken back before it is applied.
  const unlinking = archive.person_ids.filter((id) => !values.person_ids.includes(id))

  async function save() {
    setSaving(true)
    setSaveError(null)
    try {
      onSaved(await saveTextEdits(text.document_id, changes))
    } catch (error) {
      setSaveError(
        error instanceof Error && error.message
          ? `That didn’t save: ${error.message}`
          : 'That didn’t save. Check your connection and try again.',
      )
      setSaving(false)
    }
  }

  // Moving on with unsaved changes asks first. Losing a typed summary to
  // a stray click on Next is exactly the kind of thing that makes a tool
  // feel untrustworthy.
  const guard = (event: MouseEvent) => {
    if (dirty && !window.confirm('Leave without saving your changes?')) {
      event.preventDefault()
    }
  }

  const pendingMark = (field: string, restore: () => void) =>
    pendingField.has(field) && (
      <span className="ml-2 text-xs font-normal text-fe-accent-dark">
        saved, not yet in the archive &middot;{' '}
        <button
          type="button"
          onClick={restore}
          className="cursor-pointer text-fe-link underline hover:text-fe-link-dark"
        >
          undo
        </button>
      </span>
    )

  return (
    <>
      <div className="mb-5 flex items-center justify-between gap-4 border-b border-fe-brown/20 pb-3 text-sm">
        {previousHref ? (
          <Link
            to={previousHref}
            onClick={guard}
            className="text-fe-link hover:text-fe-link-dark"
          >
            &larr; Previous
          </Link>
        ) : (
          <span className="text-fe-ink/30">&larr; Previous</span>
        )}
        {nextHref ? (
          <Link
            to={nextHref}
            onClick={guard}
            className="font-bold text-fe-link hover:text-fe-link-dark"
          >
            Skip / Next &rarr;
          </Link>
        ) : (
          <span className="text-fe-ink/30">Next &rarr;</span>
        )}
      </div>

      <div className="space-y-6">
        <div>
          <label htmlFor="byline" className={LABEL_CLASS}>
            Byline
            {pendingMark('author', () => set({ author: archive.author }))}
          </label>
          <p className={HINT_CLASS}>
            The author&rsquo;s name as it should be printed &mdash; how they signed it, so
            &ldquo;Opa&rdquo; or &ldquo;Joel Nickel&rdquo; rather than a full name from
            the family tree. Leave it empty if nobody knows.
          </p>
          <input
            id="byline"
            type="text"
            value={values.author ?? ''}
            onChange={(e) => set({ author: e.target.value })}
            className={INPUT_CLASS}
          />
        </div>

        <div>
          <h2 className={LABEL_CLASS}>
            Author in the family tree
            {pendingMark('author_person_id', () =>
              set({ author_person_id: archive.author_person_id }),
            )}
          </h2>
          <p className={HINT_CLASS}>
            Makes the byline a link to their family page. Leave it empty for an author who
            isn&rsquo;t in the tree.
          </p>
          {values.author_person_id !== null ? (
            <p className="flex max-w-sm items-center justify-between gap-2 text-sm">
              <span>{personName(values.author_person_id)}</span>
              <IconAction
                variant="danger"
                label="Remove"
                onClick={() => set({ author_person_id: null })}
              >
                <XMarkIcon />
              </IconAction>
            </p>
          ) : (
            <div className="max-w-sm">
              <PersonSearch
                query={authorQuery}
                onQueryChange={setAuthorQuery}
                onPick={(person) => {
                  // An empty byline takes the record's name as a
                  // starting point, to be shortened to how they signed.
                  set({
                    author_person_id: person.person_id,
                    ...(values.author?.trim() ? {} : { author: getFullName(person) }),
                  })
                  setAuthorQuery('')
                }}
              />
            </div>
          )}
        </div>

        <div>
          <label htmlFor="genre" className={LABEL_CLASS}>
            Genre
            {pendingMark('genre', () => set({ genre: archive.genre }))}
          </label>
          <select
            id="genre"
            value={values.genre ?? ''}
            onChange={(e) => set({ genre: e.target.value })}
            className={INPUT_CLASS}
          >
            {values.genre === null && <option value="">Choose&hellip;</option>}
            {GENRES.map((genre) => (
              <option key={genre} value={genre}>
                {genre}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="summary" className={LABEL_CLASS}>
            Summary
            {pendingMark('summary', () => set({ summary: archive.summary }))}
          </label>
          <p className={HINT_CLASS}>
            Shown under the title, and beside it in the Index of Texts. A few sentences on
            what the text is and why it matters.
          </p>
          <textarea
            id="summary"
            rows={6}
            value={values.summary ?? ''}
            onChange={(e) => set({ summary: e.target.value })}
            className={`${INPUT_CLASS} max-w-none`}
          />
        </div>

        <div>
          <h2 className={LABEL_CLASS}>People in this text</h2>
          <p className={HINT_CLASS}>
            Anyone the text is about or mentions. They aren&rsquo;t listed on the
            text&rsquo;s page: linking someone puts the text in their pop-up on their
            family page.
          </p>
          {values.person_ids.length === 0 ? (
            <p className="mb-3 text-xs text-fe-ink/60">Nobody linked yet.</p>
          ) : (
            <ul className="mb-3 max-w-sm space-y-1">
              {values.person_ids.map((id) => (
                <li key={id} className="flex items-center justify-between gap-2 text-sm">
                  <span>
                    {personName(id)}
                    {pendingField.has(`person#${id}`) && (
                      <span className="ml-2 text-xs text-fe-accent-dark">
                        not yet in the archive
                      </span>
                    )}
                  </span>
                  <IconAction
                    variant="danger"
                    label="Remove"
                    onClick={() =>
                      set({ person_ids: values.person_ids.filter((p) => p !== id) })
                    }
                  >
                    <XMarkIcon />
                  </IconAction>
                </li>
              ))}
            </ul>
          )}

          {unlinking.length > 0 && (
            <ul className="mb-3 max-w-sm space-y-1">
              {unlinking.map((id) => (
                <li
                  key={id}
                  className="flex items-center justify-between gap-2 text-sm text-fe-ink/50"
                >
                  <span className="line-through">{personName(id)}</span>
                  <button
                    type="button"
                    onClick={() => set({ person_ids: [...values.person_ids, id] })}
                    className="cursor-pointer text-xs text-fe-link underline hover:text-fe-link-dark"
                  >
                    keep
                  </button>
                </li>
              ))}
            </ul>
          )}

          {/* The old site's subject tags, as one-tap searches. Never
              resolved automatically -- which Paul Mueller is a question
              only the editor can answer. */}
          {legacyTagSearches(text.tags).length > 0 && (
            <p className="mb-3 text-xs text-fe-ink/70">
              The old site tagged this text with{' '}
              {legacyTagSearches(text.tags).map(({ label, query }, i) => (
                <span key={label}>
                  {i > 0 && '; '}
                  <button
                    type="button"
                    onClick={() => setPeopleQuery(query)}
                    className="cursor-pointer text-fe-link underline hover:text-fe-link-dark"
                  >
                    {label}
                  </button>
                </span>
              ))}
              .
            </p>
          )}

          <div className="max-w-sm">
            <PersonSearch
              query={peopleQuery}
              onQueryChange={setPeopleQuery}
              exclude={values.person_ids}
              placeholder="Add someone by name..."
              onPick={(person) => {
                set({ person_ids: [...values.person_ids, person.person_id] })
                setPeopleQuery('')
              }}
            />
          </div>
        </div>
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-4 border-t border-fe-brown/20 pt-4">
        <button
          type="button"
          onClick={save}
          disabled={!dirty || saving}
          className="cursor-pointer rounded-sm bg-fe-brown px-4 py-2 text-sm font-bold text-white hover:bg-fe-accent-dark disabled:cursor-default disabled:bg-fe-brown/30"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        {dirty ? (
          <span className="text-xs text-fe-ink/70">Unsaved changes</span>
        ) : pending.length > 0 ? (
          <span className="text-xs text-fe-ink/70">
            Saved. These reach the site once Anson adds them to the archive.
          </span>
        ) : null}
        {saveError && (
          <p role="alert" className="w-full text-sm text-red-700">
            {saveError}
          </p>
        )}
      </div>
    </>
  )
}
