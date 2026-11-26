// Where an admin's staged edits to one record stand: unsaved, saving,
// a draft (by whom, when), submitted and waiting, or none at all. Shared
// by the text editor and the photograph/gallery/collection editor.
//
// Shown twice on a long page -- at the top, and under the Submit button,
// where the eye is when it's pressed. Only one copy is `live`, so a
// screen reader announces each save once.

export type SaveState =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'saved'; at: Date }
  | { kind: 'error'; message: string }

export default function EditStatusLine({
  pending,
  saveState,
  unsaved,
  live = false,
  className = '',
}: {
  pending: { status: 'draft' | 'submitted'; edited_by: string; edited_at: string }[]
  saveState: SaveState
  unsaved: boolean
  live?: boolean
  className?: string
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
      role={live ? 'status' : undefined}
      className={`${className} text-sm ${saveState.kind === 'error' ? 'text-red-700' : 'text-fe-ink/70'}`}
    >
      {state}
    </p>
  )
}
