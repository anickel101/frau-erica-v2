import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { XMarkIcon } from '@heroicons/react/24/outline'
import EditStatusLine, { type SaveState } from '../components/EditStatusLine'
import PublishedBox from '../components/PublishedBox'
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
  fromPairs,
  openingValues,
  pairProblems,
  pendingEditorEdits,
  toPairs,
  type ParagraphPair,
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
  // Phones, and every bilingual text, get one pane at a time.
  const [view, setView] = useState<'write' | 'preview'>('write')
  const [pickerOpen, setPickerOpen] = useState(false)
  const body = useRef<HTMLTextAreaElement>(null)
  // Where the cursor was when the picker opened: the textarea loses its
  // selection to the picker's search box.
  const insertAt = useRef(0)

  // A bilingual text is edited as rows of paragraph pairs, German beside
  // English, the way the page sets them. The rows are the source of truth
  // while editing: re-deriving them from the joined text on every
  // keystroke would split a row the moment a blank line was typed into
  // it, and move every row below under the cursor.
  const [pairs, setPairs] = useState<ParagraphPair[]>(() =>
    text.bilingual ? toPairs(values.content, values.content_de) : [],
  )
  const problems = text.bilingual ? pairProblems(pairs) : []
  // The paragraph the toolbar acts on: the one last typed in.
  const focusedCell = useRef<{
    row: number
    side: 'de' | 'en'
    area: HTMLTextAreaElement
  } | null>(null)
  const [hint, setHint] = useState<string | null>(null)

  function changePairs(next: ParagraphPair[]) {
    setPairs(next)
    setValues((v) => ({ ...v, ...fromPairs(next) }))
  }

  function resetTo(next: EditorValues) {
    setValues(next)
    if (text.bilingual) setPairs(toPairs(next.content, next.content_de))
  }

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
    // The API would refuse an unpaired bilingual text; saying which
    // paragraph, here, is more use than its count of each.
    if (problems.length > 0) {
      setSaveState({
        kind: 'error',
        message: `Paragraph ${problems[0].row + 1}: ${problems[0].message}`,
      })
      return
    }
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
      resetTo(archiveValues(text))
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
    if (await save(changes, 'submitted', archive)) resetTo(archive)
  }

  // Toolbar edits go through the textarea's own value and selection, then
  // put the selection back where the edit says it belongs.
  function applyToBody(edit: (value: string, start: number, end: number) => Edited) {
    if (text.bilingual) {
      const cell = focusedCell.current
      if (!cell) {
        setHint('Click into a paragraph first.')
        return
      }
      setHint(null)
      const result = edit(
        pairs[cell.row][cell.side],
        cell.area.selectionStart,
        cell.area.selectionEnd,
      )
      changePairs(
        pairs.map((p, i) => (i === cell.row ? { ...p, [cell.side]: result.value } : p)),
      )
      requestAnimationFrame(() => {
        cell.area.focus()
        cell.area.setSelectionRange(result.selectionStart, result.selectionEnd)
      })
      return
    }
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
    const code = `{{image:${imageId}}}`
    // In a bilingual text a photograph can't be a paragraph of its own --
    // it would need a partner in the other language -- so it goes at the
    // head of the current paragraph, floating within its column, which is
    // how the archive's bilingual texts already carry theirs.
    if (text.bilingual) {
      applyToBody((value) => ({
        value: `${code}\n${value}`,
        selectionStart: code.length + 1,
        selectionEnd: code.length + 1,
      }))
      return
    }
    applyToBody((value) => insertBlock(value, insertAt.current, code))
  }

  function openPicker() {
    if (text.bilingual && !focusedCell.current) {
      setHint('Click into the paragraph the photo belongs with first.')
      return
    }
    setHint(null)
    insertAt.current = body.current?.selectionStart ?? values.content.length
    setPickerOpen(true)
  }

  const pending = pendingEditorEdits(edits)
  const previewContent = useMemo(
    () => resolveImagePlaceholders(values.content),
    [values.content],
  )
  const previewGerman = useMemo(
    () => resolveImagePlaceholders(values.content_de),
    [values.content_de],
  )
  const oneAtATime = text.bilingual

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

      <EditStatusLine
        pending={pending}
        saveState={saveState}
        unsaved={unsaved}
        className="mb-4"
      />

      {/* Phones get one pane at a time; from lg the two sit side by side --
          except a bilingual text, whose German-beside-English rows need
          the whole width. */}
      <div
        className={`${oneAtATime ? '' : 'lg:hidden'} mb-3 flex gap-2 text-sm`}
        role="tablist"
      >
        {(['write', 'preview'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={view === tab}
            onClick={() => setView(tab)}
            className={`px-3 py-1 rounded-sm border ${
              view === tab
                ? 'bg-fe-brown text-white border-fe-brown'
                : 'border-fe-brown/40 text-fe-ink'
            }`}
          >
            {tab === 'write' ? 'Write' : 'Preview'}
          </button>
        ))}
      </div>

      <div className={`grid gap-6 ${oneAtATime ? '' : 'lg:grid-cols-2'}`}>
        <section
          className={view === 'write' ? '' : oneAtATime ? 'hidden' : 'hidden lg:block'}
        >
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
            <ToolButton label="Insert photo" onClick={openPicker}>
              Insert photo
            </ToolButton>
          </div>
          {hint && <p className="mb-1 text-xs text-red-700">{hint}</p>}
          {text.bilingual ? (
            <>
              <PairEditor
                pairs={pairs}
                problems={problems}
                onChange={changePairs}
                onFocusCell={(row, side, area) => {
                  focusedCell.current = { row, side, area }
                  setHint(null)
                }}
              />
              <p className="mt-1 text-xs text-fe-ink/60">
                Each row is one paragraph, German beside its English, as the page sets
                them. Add or remove a paragraph with the buttons, so both languages keep
                the same number. **Two stars** for bold, *one* for italic.
              </p>
            </>
          ) : (
            <>
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

          <PublishedBox
            noun="text"
            checked={values.is_published}
            wasPublished={text.is_published}
            onChange={(is_published) => setValues((v) => ({ ...v, is_published }))}
          />

          <div className="mt-4 flex flex-wrap items-center gap-3">
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
          {/* The same line again, under the buttons: at the top alone it
              was off-screen when Submit was pressed at the foot of a long
              text, so nothing seemed to happen and it got pressed three
              times (the archivist's first real edit, 2026-11-26). This
              copy is the live region; the top one is silent so a screen
              reader doesn't announce every save twice. */}
          <EditStatusLine
            pending={pending}
            saveState={saveState}
            unsaved={unsaved}
            live
            className="mt-2"
          />
        </section>

        <section
          aria-label="Preview"
          className={`${view === 'preview' ? '' : oneAtATime ? 'hidden' : 'hidden lg:block'} border border-fe-brown/20 rounded-sm bg-fe-bg p-4 lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto lg:sticky lg:top-4`}
        >
          <p className="text-xs uppercase tracking-wide text-fe-ink/50 mb-2">Preview</p>
          <h2 className="text-xl sm:text-2xl font-bold mb-4">
            <InlineMarkdown>{values.title}</InlineMarkdown>
          </h2>
          <TextBody
            summary={values.summary || null}
            content={previewContent}
            parallel={
              text.bilingual ? { german: previewGerman, english: previewContent } : null
            }
          />
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

// A bilingual text's body as rows: each a German paragraph beside its
// English one. Paragraphs are added and removed a pair at a time, so the
// two languages can't drift out of step -- the one thing the page's
// side-by-side layout can't survive.
function PairEditor({
  pairs,
  problems,
  onChange,
  onFocusCell,
}: {
  pairs: ParagraphPair[]
  problems: { row: number; message: string }[]
  onChange: (next: ParagraphPair[]) => void
  onFocusCell: (row: number, side: 'de' | 'en', area: HTMLTextAreaElement) => void
}) {
  // Tall enough to show a paragraph whole, without a scroll bar per cell.
  const rowsFor = (value: string) =>
    Math.min(
      16,
      Math.max(3, Math.ceil(value.length / 48) + (value.match(/\n/g)?.length ?? 0)),
    )

  function remove(row: number) {
    const pair = pairs[row]
    if (
      (pair.de.trim() || pair.en.trim()) &&
      !window.confirm(`Remove paragraph ${row + 1}, in both languages?`)
    ) {
      return
    }
    const next = pairs.filter((_, i) => i !== row)
    onChange(next.length > 0 ? next : [{ de: '', en: '' }])
  }

  return (
    <div>
      <div className="hidden sm:grid grid-cols-2 gap-3 mb-1 text-xs font-bold uppercase tracking-wide text-fe-brown">
        <p>German</p>
        <p>English</p>
      </div>
      <ol className="space-y-3">
        {pairs.map((pair, row) => {
          const rowProblems = problems.filter((p) => p.row === row)
          return (
            <li
              key={row}
              className={`rounded-sm border p-2 ${rowProblems.length ? 'border-red-300 bg-red-50/40' : 'border-fe-brown/20'}`}
            >
              <div className="flex items-center justify-between mb-1 text-xs text-fe-ink/60">
                <span>Paragraph {row + 1}</span>
                <span className="space-x-3">
                  <button
                    type="button"
                    className="text-fe-link hover:text-fe-link-dark"
                    onClick={() =>
                      onChange([
                        ...pairs.slice(0, row + 1),
                        { de: '', en: '' },
                        ...pairs.slice(row + 1),
                      ])
                    }
                  >
                    Add a paragraph below
                  </button>
                  <button
                    type="button"
                    className="text-fe-link hover:text-fe-link-dark"
                    onClick={() => remove(row)}
                  >
                    Remove
                  </button>
                </span>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {(['de', 'en'] as const).map((side) => (
                  <textarea
                    key={side}
                    lang={side}
                    spellCheck
                    aria-label={`Paragraph ${row + 1}, ${side === 'de' ? 'German' : 'English'}`}
                    rows={rowsFor(pair[side])}
                    className={`${inputClassName} resize-y font-mono text-[13px] leading-relaxed`}
                    value={pair[side]}
                    onFocus={(e) => onFocusCell(row, side, e.currentTarget)}
                    onChange={(e) =>
                      onChange(
                        pairs.map((p, i) =>
                          i === row ? { ...p, [side]: e.target.value } : p,
                        ),
                      )
                    }
                  />
                ))}
              </div>
              {rowProblems.map((p) => (
                <p key={p.message} className="mt-1 text-xs text-red-700">
                  {p.message}
                </p>
              ))}
            </li>
          )
        })}
      </ol>
      <button
        type="button"
        className="mt-2 text-sm text-fe-link hover:text-fe-link-dark"
        onClick={() => onChange([...pairs, { de: '', en: '' }])}
      >
        Add a paragraph at the end
      </button>
    </div>
  )
}
