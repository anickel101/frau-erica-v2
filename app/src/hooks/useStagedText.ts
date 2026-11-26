import { useEffect, useState } from 'react'
import type { TextEdit } from '../data-access/gated/textEdits'

// For an admin reading a text: the changes waiting on it in the staged-
// edits queue (title, summary, body), so the page can show the text as it
// will read once they're published. Everyone else gets null and pays
// nothing -- the gated client is loaded only when enabled.

export interface StagedText {
  title?: string
  summary?: string | null
  content?: string
  // A bilingual text's German half.
  content_de?: string
  // false: the text is set to be hidden from visitors.
  is_published?: boolean
  edits: TextEdit[]
}

const FIELDS = ['title', 'summary', 'content', 'content_de', 'is_published'] as const

export function useStagedText(
  documentId: number | null,
  enabled: boolean,
): StagedText | null {
  const [staged, setStaged] = useState<{ id: number; value: StagedText | null } | null>(
    null,
  )

  useEffect(() => {
    if (!enabled || documentId === null) return
    let current = true
    import('../data-access/gated/textEdits')
      .then(({ getTextForEditing }) => getTextForEditing(documentId))
      .then(({ edits }) => {
        const pending = edits.filter((e) =>
          (FIELDS as readonly string[]).includes(e.field),
        )
        const value: StagedText | null = pending.length > 0 ? { edits: pending } : null
        for (const edit of pending) {
          if (value) Object.assign(value, { [edit.field]: edit.value })
        }
        if (current) setStaged({ id: documentId, value })
      })
      // A failure here only means the admin sees the published version,
      // which is what everyone else sees; not worth an error on a public
      // page.
      .catch(() => current && setStaged({ id: documentId, value: null }))
    return () => {
      current = false
    }
  }, [documentId, enabled])

  // Ignore a result left over from the previous text while the next loads.
  return enabled && staged?.id === documentId ? staged.value : null
}
