import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { XMarkIcon } from '@heroicons/react/24/outline'
import InlineMarkdown from '../components/InlineMarkdown'
import Layout from '../components/Layout'
import Modal from '../components/Modal'
import TextBody from '../components/TextBody'
import {
  getTextForEditing,
  saveTextEdits,
  type EditStatus,
  type EditableTextDetail,
  type TextEdit,
  type TextEditChanges,
} from '../data-access/gated/textEdits'
import {
  listDocumentImages,
  resolveImagePlaceholders,
} from '../data-access/public/documentImages'
import { buttonClassName, inputClassName } from '../utils/formStyles'
import { resolveImageUrl } from '../utils/imageUrl'
import {
  archiveValues,
  changedFields,
  discardChanges,
  hasChanges,
  insertBlock,
  insertLink,
  openingValues,
  pendingEditorEdits,
  searchImages,
  submitChanges,
  wrapSelection,
  type Edited,
  type EditorValues,
} from '../utils/textEditorState'

// The admin text editor: a text's title, summary and body, written in the
// archive's own markdown beside a preview drawn by the text page's own
// renderer (TextBody), so what the editor shows is what readers will get.
//
// Nothing here writes to the archive. Every change is staged in the API's
// edits queue -- autosaved as a draft while typing, shared between
// admins, and marked submitted when the editor says it's ready -- and
// reaches the archive in a batch someone reads first (scripts/
// reviewEdits.ts). See api/CLAUDE.md's "Staged edits".
//
// Byline, author record, genre and linked people stay on the Tag texts
// page, linked from here.

// Long enough to finish a word, short enough that closing the tab loses
// a sentence at most -- and the page warns before it closes anyway.
const AUTOSAVE_MS = 2000

type SaveState =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'saved'; at: Date }
  | { kind: 'error'; message: string }

export default function TextEditorPage() {
  const { documentId } = useParams<{ documentId: string }>()
  const id = Number(documentId)
  const [loaded, setLoaded] = useState<{
    text: EditableTextDetail
    edits: TextEdit[]
  } | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    let current = true
    getTextForEditing(id)
      .then((result) => current && setLoaded(result))
      .catch((error: Error) => current && setLoadError(error.message))
    return () => {
      current = false
    }
  }, [id])

  return (
    <Layout>
      <div className="p-6">
        <p className="text-sm text-fe-brown mb-1">
          <Link to="/admin/tag-texts" className="text-fe-link hover:text-fe-link-dark">
            Tag texts
          </Link>{' '}
          › Edit text
        </p>
        {loadError ? (
          <p className="text-sm text-red-700">
            Couldn&rsquo;t open this text: {loadError}
          </p>
        ) : !loaded ? (
          <p className="text-sm text-fe-ink/60">Loading...</p>
        ) : (
          <TextEditor key={id} text={loaded.text} initialEdits={loaded.edits} />
        )}
      </div>
    </Layout>
  )
}

function TextEditor({
  text,
  initialEdits,
}: {
  text: EditableTextDetail
  initialEdits: TextEdit[]
}) {
  const [edits, setEdits] = useState(initialEdits)
  const [values, setValues] = useState<EditorValues>(() =>
    openingValues(text, initialEdits),
  )
  // What the queue holds for each field, as far as this page knows: the
  // last values it saved, or what it opened with. Autosave sends the
  // difference from here, nothing more.
  const [saved, setSaved] = useState<EditorValues>(values)
  const [saveState, setSaveState] = useState<SaveState>({ kind: 'idle' })
  const saving = saveState.kind === 'saving'
  const [phoneView, setPhoneView] = useState<'write' | 'preview'>('write')
  const [pickerOpen, setPickerOpen] = useState(false)
  const body = useRef<HTMLTextAreaElement>(null)
  // Where the cursor was when the picker opened: the textarea loses its
  // selection to the picker's search box.
  const insertAt = useRef(0)

  const save = useCallback(
    async (changes: TextEditChanges, status: EditStatus, after: EditorValues) => {
      setSaveState({ kind: 'saving' })
      try {
        setEdits(await saveTextEdits(text.document_id, changes, status))
        setSaved(after)
        setSaveState({ kind: 'saved', at: new Date() })
        return true
      } catch (error) {
        setSaveState({ kind: 'error', message: (error as Error).message })
        return false
      }
    },
    [text.document_id],
  )

  const unsaved = hasChanges(changedFields(saved, values, text.bilingual))

  // Autosave as a draft, a moment after the typing stops.
  useEffect(() => {
    if (saving || !unsaved) return
    const timer = setTimeout(() => {
      void save(changedFields(saved, values, text.bilingual), 'draft', values)
    }, AUTOSAVE_MS)
    return () => clearTimeout(timer)
  }, [values, saved, saving, unsaved, save, text.bilingual])

  // The browser's own "leave this page?" while anything is unsaved.
  useEffect(() => {
    if (!unsaved && !saving) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [unsaved, saving])

  async function submit() {
    const changes = submitChanges(text, values, edits)
    if (!hasChanges(changes)) {
      setSaveState({ kind: 'error', message: 'Nothing has changed from the archive.' })
      return
    }
    await save(changes, 'submitted', values)
  }

  async function discard() {
    const changes = discardChanges(text, edits)
    if (!hasChanges(changes)) {
      setValues(archiveValues(text))
      return
    }
    if (
      !window.confirm(
        'Throw away every change waiting on this text – drafts and submitted ones, by anyone – and go back to the archive’s version?',
      )
    ) {
      return
    }
    const archive = archiveValues(text)
    if (await save(changes, 'submitted', archive)) setValues(archive)
  }

  // Toolbar edits go through the textarea's own value and selection, then
  // put the selection back where the edit says it belongs.
  function applyToBody(edit: (value: string, start: number, end: number) => Edited) {
    const area = body.current
    if (!area) return
    const result = edit(values.content, area.selectionStart, area.selectionEnd)
    setValues((v) => ({ ...v, content: result.value }))
    requestAnimationFrame(() => {
      area.focus()
      area.setSelectionRange(result.selectionStart, result.selectionEnd)
    })
  }

  function insertPhoto(imageId: number) {
    setPickerOpen(false)
    applyToBody((value) => insertBlock(value, insertAt.current, `{{image:${imageId}}}`))
  }

  const pending = pendingEditorEdits(edits)
  const previewContent = useMemo(
    () => resolveImagePlaceholders(values.content),
    [values.content],
  )

  return (
    <>
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 mb-4">
        <h1 className="text-xl font-bold">
          <InlineMarkdown>{values.title || text.title}</InlineMarkdown>
        </h1>
        <p className="text-sm space-x-4">
          <Link
            to={`/documents/${text.document_id}`}
            className="text-fe-link hover:text-fe-link-dark"
          >
            View the published text
          </Link>
          <Link
            to={`/admin/tag-texts/${text.document_id}`}
            className="text-fe-link hover:text-fe-link-dark"
          >
            Byline, genre and people
          </Link>
        </p>
      </div>

      <StatusLine pending={pending} saveState={saveState} unsaved={unsaved} />

      {/* Phones get one pane at a time; from lg the two sit side by side. */}
      <div className="lg:hidden mb-3 flex gap-2 text-sm" role="tablist">
        {(['write', 'preview'] as const).map((view) => (
          <button
            key={view}
            type="button"
            role="tab"
            aria-selected={phoneView === view}
            onClick={() => setPhoneView(view)}
            className={`px-3 py-1 rounded-sm border ${
              phoneView === view
                ? 'bg-fe-brown text-white border-fe-brown'
                : 'border-fe-brown/40 text-fe-ink'
            }`}
          >
            {view === 'write' ? 'Write' : 'Preview'}
          </button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className={phoneView === 'write' ? '' : 'hidden lg:block'}>
          <label
            className="block text-sm font-bold text-fe-brown mb-1"
            htmlFor="edit-title"
          >
            Title
          </label>
          <input
            id="edit-title"
            className={`${inputClassName} mb-4`}
            value={values.title}
            onChange={(e) => setValues((v) => ({ ...v, title: e.target.value }))}
          />

          <label
            className="block text-sm font-bold text-fe-brown mb-1"
            htmlFor="edit-summary"
          >
            Summary
          </label>
          <textarea
            id="edit-summary"
            rows={4}
            className={`${inputClassName} mb-4 resize-y`}
            value={values.summary}
            onChange={(e) => setValues((v) => ({ ...v, summary: e.target.value }))}
          />

          <label
            className="block text-sm font-bold text-fe-brown mb-1"
            htmlFor="edit-body"
          >
            Text
          </label>
          {text.bilingual ? (
            <p className="text-sm text-fe-ink/70 border border-fe-brown/30 rounded-sm p-3">
              This text is bilingual. Editing its English and German side by side is
              coming next; for now its title and summary can be changed here.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap gap-1 mb-1" aria-label="Formatting">
                <ToolButton
                  label="Bold"
                  onClick={() =>
                    applyToBody((v, s, e) => wrapSelection(v, s, e, '**', 'bold text'))
                  }
                >
                  <b>B</b>
                </ToolButton>
                <ToolButton
                  label="Italic"
                  onClick={() =>
                    applyToBody((v, s, e) => wrapSelection(v, s, e, '*', 'italic text'))
                  }
                >
                  <i>I</i>
                </ToolButton>
                <ToolButton label="Link" onClick={() => applyToBody(insertLink)}>
                  Link
                </ToolButton>
                <ToolButton
                  label="Insert photo"
                  onClick={() => {
                    insertAt.current =
                      body.current?.selectionStart ?? values.content.length
                    setPickerOpen(true)
                  }}
                >
                  Insert photo
                </ToolButton>
              </div>
              <textarea
                id="edit-body"
                ref={body}
                spellCheck
                className={`${inputClassName} h-[60vh] resize-y font-mono text-[13px] leading-relaxed`}
                value={values.content}
                onChange={(e) => setValues((v) => ({ ...v, content: e.target.value }))}
              />
              <p className="mt-1 text-xs text-fe-ink/60">
                A blank line starts a new paragraph. **Two stars** for bold, *one* for
                italic. A photo is a line of its own, like {'{{image:246}}'}.
              </p>
            </>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              className={buttonClassName}
              disabled={saving}
              onClick={() => void submit()}
            >
              Submit for publishing
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
        </section>

        <section
          aria-label="Preview"
          className={`${phoneView === 'preview' ? '' : 'hidden lg:block'} border border-fe-brown/20 rounded-sm bg-fe-bg p-4 lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto lg:sticky lg:top-4`}
        >
          <p className="text-xs uppercase tracking-wide text-fe-ink/50 mb-2">Preview</p>
          <h2 className="text-xl sm:text-2xl font-bold mb-4">
            <InlineMarkdown>{values.title}</InlineMarkdown>
          </h2>
          {text.bilingual ? (
            <>
              <TextBody summary={values.summary || null} content="" parallel={null} />
              <p className="text-xs text-fe-ink/60">
                The bilingual text itself is shown on the published page.
              </p>
            </>
          ) : (
            <TextBody
              summary={values.summary || null}
              content={previewContent}
              parallel={null}
            />
          )}
        </section>
      </div>

      <PhotoPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={insertPhoto}
      />
    </>
  )
}

function StatusLine({
  pending,
  saveState,
  unsaved,
}: {
  pending: TextEdit[]
  saveState: SaveState
  unsaved: boolean
}) {
  const latest = [...pending].sort((a, b) => b.edited_at.localeCompare(a.edited_at))[0]
  const drafts = pending.some((e) => e.status === 'draft')
  const when = (iso: string) =>
    new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })

  let state: string
  if (saveState.kind === 'saving') state = 'Saving…'
  else if (saveState.kind === 'error') state = `Not saved: ${saveState.message}`
  else if (unsaved) state = 'Unsaved changes…'
  else if (!latest) state = 'No changes waiting. This is the archive’s version.'
  else if (drafts)
    state = `Draft, saved ${when(latest.edited_at)} by ${latest.edited_by}. Submit it when it’s ready.`
  else
    state = `Submitted ${when(latest.edited_at)} by ${latest.edited_by}, waiting to be published.`

  return (
    <p
      role="status"
      className={`mb-4 text-sm ${saveState.kind === 'error' ? 'text-red-700' : 'text-fe-ink/70'}`}
    >
      {state}
    </p>
  )
}

function ToolButton({
  label,
  onClick,
  children,
}: {
  label: string
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      // Keep the textarea's selection: a mousedown on a button would
      // otherwise move focus, and the selection with it, before onClick.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className="min-w-8 px-2 py-1 text-sm border border-fe-brown/40 rounded-sm bg-white hover:border-fe-accent"
    >
      {children}
    </button>
  )
}

function PhotoPicker({
  open,
  onClose,
  onPick,
}: {
  open: boolean
  onClose: () => void
  onPick: (imageId: number) => void
}) {
  const [query, setQuery] = useState('')
  const images = useMemo(() => listDocumentImages(), [])
  const found = useMemo(() => searchImages(images, query), [images, query])

  return (
    <Modal open={open} onClose={onClose} label="Insert a photograph">
      {/* stopPropagation, as in PersonInfoDialog: Modal closes on any
          click, and a click in the search box must not. */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative max-h-[90vh] w-[min(48rem,calc(100vw-2rem))] overflow-y-auto rounded-sm bg-fe-bg p-6 pt-5 shadow-lg"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full text-fe-ink/60 hover:bg-black/10 hover:text-fe-ink"
        >
          <XMarkIcon className="h-5 w-5" />
        </button>
        <h2 className="pr-8 text-lg font-bold mb-3">Insert a photograph</h2>
        <input
          type="search"
          autoFocus
          placeholder="Search captions, titles and file names, or type a photo number"
          className={`${inputClassName} mb-3`}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {found.length === 0 ? (
          <p className="text-sm text-fe-ink/60">No photograph matches that.</p>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {found.map((image) => (
              <li key={image.image_id}>
                <button
                  type="button"
                  onClick={() => onPick(image.image_id)}
                  className="block w-full text-left group"
                >
                  <span className="block aspect-square overflow-hidden bg-fe-brown/20 border-2 border-transparent group-hover:border-fe-accent">
                    <img
                      src={resolveImageUrl(image.url)}
                      alt=""
                      loading="lazy"
                      className="h-full w-full object-cover object-top"
                    />
                  </span>
                  <span className="mt-1 block text-[11px] leading-tight text-fe-ink/70 line-clamp-2">
                    #{image.image_id} · {image.title || image.caption || image.url}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  )
}
