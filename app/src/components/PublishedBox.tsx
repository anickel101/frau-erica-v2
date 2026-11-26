// Whether visitors can see a text or photograph. Unchecking it hides the
// item -- it stays in the archive, and the Hidden page can bring it back;
// checking it on a hidden one brings it back. Like every other field it
// is a staged edit, and nothing changes on the site until it is applied.
export default function PublishedBox({
  noun,
  checked,
  wasPublished,
  onChange,
}: {
  noun: string
  checked: boolean
  // What the archive says now, so the note can say what will change.
  wasPublished: boolean
  onChange: (published: boolean) => void
}) {
  let note: string
  if (checked && wasPublished) note = `Visitors can see this ${noun}.`
  else if (!checked && !wasPublished)
    note = `This ${noun} is hidden from visitors. Check the box to bring it back.`
  else if (!checked)
    note = `Once published, this change hides the ${noun} from visitors. It stays in the archive and can be brought back from the Hidden page.`
  else note = `Once published, this change brings the ${noun} back for visitors.`

  return (
    <div
      className={`mt-4 rounded-sm border p-3 text-sm ${
        checked === wasPublished ? 'border-fe-brown/20' : 'border-fe-accent bg-white/60'
      }`}
    >
      <label className="flex items-center gap-2 font-bold text-fe-brown">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
        Published on the site
      </label>
      <p className="mt-1 text-fe-ink/70">{note}</p>
    </div>
  )
}
