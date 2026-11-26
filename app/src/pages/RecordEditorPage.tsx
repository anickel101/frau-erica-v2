import { useCallback, useEffect, useMemo, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { Link, useParams } from 'react-router-dom'
import EditStatusLine, { type SaveState } from '../components/EditStatusLine'
import InlineMarkdown from '../components/InlineMarkdown'
import Layout from '../components/Layout'
import {
  getRecordForEditing,
  saveRecordEdits,
  type EditableRecord,
  type RecordType,
} from '../data-access/gated/recordEdits'
import { buttonClassName, inputClassName } from '../utils/formStyles'
import { resolveImageUrl } from '../utils/imageUrl'
import { markdownLink } from '../utils/markdownLink'
import {
  archiveValues,
  changedFields,
  discardChanges,
  openingValues,
  submitChanges,
  type FormValues,
  type PendingEdit,
} from '../utils/recordEditorState'

// The admin editor for a photograph's caption and details, a gallery's
// name and summary, or a collection's name and blurb -- records whose
// fields are plain values. Same workings as the text editor: autosaved
// drafts shared between admins, Submit when ready, Discard to withdraw,
// and nothing reaches the archive until scripts/reviewEdits.ts applies it.

const AUTOSAVE_MS = 2000

interface FieldConfig {
  key: string
  label: string
  // A line is one line; text is markdown that may run on; a year is a
  // number box.
  kind: 'line' | 'text' | 'year'
  hint?: string
}

interface Kind {
  noun: string
  fields: FieldConfig[]
  heading: (record: EditableRecord, values: FormValues) => string
  viewHref?: (record: EditableRecord, id: string) => string
}

const KINDS: Record<RecordType, Kind> = {
  image: {
    noun: 'photograph',
    fields: [
      { key: 'title', label: 'Title', kind: 'line' },
      {
        key: 'caption',
        label: 'Caption',
        kind: 'text',
        hint: '*One star* for italic, **two** for bold.',
      },
      { key: 'credit', label: 'Photo credit', kind: 'line' },
      { key: 'year_taken', label: 'Year taken', kind: 'year' },
      { key: 'location', label: 'Where it was taken', kind: 'line' },
    ],
    heading: (record, values) => values.title || String(record.url),
  },
  gallery: {
    noun: 'gallery',
    fields: [
      { key: 'name', label: 'Name', kind: 'line' },
      {
        key: 'summary',
        label: 'Summary',
        kind: 'text',
        hint: 'A blank line starts a new paragraph.',
      },
    ],
    heading: (_record, values) => values.name,
    viewHref: (_record, id) => `/galleries/${id}`,
  },
  series: {
    noun: 'collection',
    fields: [
      { key: 'name', label: 'Name', kind: 'line' },
      {
        key: 'blurb',
        label: 'Introduction',
        kind: 'text',
        hint: 'A blank line starts a new paragraph.',
      },
    ],
    heading: (_record, values) => values.name,
    viewHref: (record) => `/collections/${String(record.slug)}`,
  },
}

function isRecordType(value: string | undefined): value is RecordType {
  return value === 'image' || value === 'gallery' || value === 'series'
}

export default function RecordEditorPage() {
  const { type, id } = useParams<{ type: string; id: string }>()
  const [loaded, setLoaded] = useState<{
    record: EditableRecord
    edits: PendingEdit[]
  } | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const valid = isRecordType(type) && !!id

  useEffect(() => {
    if (!isRecordType(type) || !id) return
    let current = true
    getRecordForEditing(type, id)
      .then((result) => current && setLoaded(result))
      .catch((error: Error) => current && setLoadError(error.message))
    return () => {
      current = false
    }
  }, [type, id])

  return (
    <Layout>
      <div className="p-6">
        <p className="text-sm text-fe-brown mb-1">
          Edit {valid ? KINDS[type].noun : 'record'}
        </p>
        {!valid ? (
          <p className="text-sm text-red-700">There is no editor for that.</p>
        ) : loadError ? (
          <p className="text-sm text-red-700">
            Couldn&rsquo;t open this {KINDS[type].noun}: {loadError}
          </p>
        ) : !loaded ? (
          <p className="text-sm text-fe-ink/60">Loading...</p>
        ) : (
          <RecordEditor
            key={`${type}:${id}`}
            type={type}
            id={id}
            record={loaded.record}
            initialEdits={loaded.edits}
          />
        )}
      </div>
    </Layout>
  )
}

function RecordEditor({
  type,
  id,
  record,
  initialEdits,
}: {
  type: RecordType
  id: string
  record: EditableRecord
  initialEdits: PendingEdit[]
}) {
  const kind = KINDS[type]
  const fieldKeys = useMemo(() => kind.fields.map((f) => f.key), [kind])
  const archive = useMemo(() => archiveValues(record, fieldKeys), [record, fieldKeys])
  const [edits, setEdits] = useState(() =>
    initialEdits.filter((e) => fieldKeys.includes(e.field)),
  )
  const [values, setValues] = useState(() =>
    openingValues(record, fieldKeys, initialEdits),
  )
  const [saved, setSaved] = useState(values)
  const [saveState, setSaveState] = useState<SaveState>({ kind: 'idle' })
  const saving = saveState.kind === 'saving'

  const save = useCallback(
    async (changes: FormValues, status: 'draft' | 'submitted', after: FormValues) => {
      setSaveState({ kind: 'saving' })
      try {
        const stored = await saveRecordEdits(type, id, changes, status)
        setEdits(stored.filter((e) => fieldKeys.includes(e.field)))
        setSaved(after)
        setSaveState({ kind: 'saved', at: new Date() })
        return true
      } catch (error) {
        setSaveState({ kind: 'error', message: (error as Error).message })
        return false
      }
    },
    [type, id, fieldKeys],
  )

  const changed = changedFields(saved, values)
  const unsaved = Object.keys(changed).length > 0

  useEffect(() => {
    if (saving || !unsaved) return
    const timer = setTimeout(() => void save(changed, 'draft', values), AUTOSAVE_MS)
    return () => clearTimeout(timer)
  }, [changed, values, saving, unsaved, save])

  useEffect(() => {
    if (!unsaved && !saving) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [unsaved, saving])

  async function submit() {
    const changes = submitChanges(archive, values, edits)
    if (Object.keys(changes).length === 0) {
      setSaveState({ kind: 'error', message: 'Nothing has changed from the archive.' })
      return
    }
    await save(changes, 'submitted', values)
  }

  async function discard() {
    const changes = discardChanges(archive, edits)
    if (Object.keys(changes).length === 0) {
      setValues(archive)
      return
    }
    if (
      !window.confirm(
        `Throw away every change waiting on this ${kind.noun} – drafts and submitted ones, by anyone – and go back to the archive’s version?`,
      )
    ) {
      return
    }
    if (await save(changes, 'submitted', archive)) setValues(archive)
  }

  const set = (key: string, value: string) => setValues((v) => ({ ...v, [key]: value }))

  return (
    <>
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 mb-4">
        <h1 className="text-xl font-bold">
          <InlineMarkdown>{kind.heading(record, values)}</InlineMarkdown>
        </h1>
        {kind.viewHref && (
          <Link
            to={kind.viewHref(record, id)}
            className="text-sm text-fe-link hover:text-fe-link-dark"
          >
            View the published {kind.noun}
          </Link>
        )}
      </div>

      <EditStatusLine
        pending={edits}
        saveState={saveState}
        unsaved={unsaved}
        className="mb-4"
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          {kind.fields.map((field) => (
            <div key={field.key} className="mb-4">
              <label
                className="block text-sm font-bold text-fe-brown mb-1"
                htmlFor={`edit-${field.key}`}
              >
                {field.label}
              </label>
              {field.kind === 'text' ? (
                <textarea
                  id={`edit-${field.key}`}
                  rows={6}
                  spellCheck
                  className={`${inputClassName} resize-y`}
                  value={values[field.key]}
                  onChange={(e) => set(field.key, e.target.value)}
                />
              ) : (
                <input
                  id={`edit-${field.key}`}
                  inputMode={field.kind === 'year' ? 'numeric' : undefined}
                  className={`${inputClassName} ${field.kind === 'year' ? 'max-w-32' : ''}`}
                  value={values[field.key]}
                  onChange={(e) => set(field.key, e.target.value)}
                />
              )}
              {field.hint && <p className="mt-1 text-xs text-fe-ink/60">{field.hint}</p>}
            </div>
          ))}

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              className={buttonClassName}
              disabled={saving}
              onClick={() => void submit()}
            >
              {saving ? 'Saving…' : 'Submit for publishing'}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => void discard()}
              className="text-sm text-fe-link hover:text-fe-link-dark disabled:opacity-50"
            >
              Discard changes
            </button>
          </div>
          <EditStatusLine
            pending={edits}
            saveState={saveState}
            unsaved={unsaved}
            live
            className="mt-2"
          />
        </section>

        <section
          aria-label="Preview"
          className="border border-fe-brown/20 rounded-sm bg-fe-bg p-4"
        >
          <p className="text-xs uppercase tracking-wide text-fe-ink/50 mb-2">Preview</p>
          <Preview type={type} record={record} values={values} />
        </section>
      </div>
    </>
  )
}

// Each record as its own page sets it: a photograph with the caption line
// the gallery gives it, a gallery's name over its summary, a collection's
// name over its introduction.
function Preview({
  type,
  record,
  values,
}: {
  type: RecordType
  record: EditableRecord
  values: FormValues
}) {
  if (type === 'image') {
    const details = [values.location, values.year_taken].filter(Boolean).join(', ')
    return (
      <figure>
        <img
          src={resolveImageUrl(String(record.url))}
          alt=""
          className="max-h-[50vh] w-auto max-w-full"
        />
        <figcaption className="mt-2 text-[12px] text-fe-ink/80">
          <strong className="text-fe-ink">
            <InlineMarkdown>{values.title}</InlineMarkdown>
          </strong>{' '}
          {values.title && values.caption && '– '}
          <InlineMarkdown>{values.caption}</InlineMarkdown>
          {(details || values.credit) && (
            <span className="text-fe-ink/50">
              {' '}
              ({details}
              {values.credit ? ` · Photo: ${values.credit}` : ''})
            </span>
          )}
        </figcaption>
      </figure>
    )
  }
  const body = type === 'gallery' ? values.summary : values.blurb
  return (
    <>
      <h2 className="text-xl sm:text-2xl font-bold mb-3">
        <InlineMarkdown>{values.name}</InlineMarkdown>
      </h2>
      <div className="text-[12px] text-fe-ink [&_p]:mb-3">
        <ReactMarkdown components={markdownLink}>{body}</ReactMarkdown>
      </div>
    </>
  )
}
