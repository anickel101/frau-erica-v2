export default function SearchInput({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (value: string) => void
  placeholder: string
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full max-w-sm px-3 py-2 border border-fe-brown/40 rounded-sm bg-white text-sm focus:outline-none focus:border-fe-accent"
    />
  )
}
