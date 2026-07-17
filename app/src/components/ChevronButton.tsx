import { MouseEvent } from 'react'

export default function ChevronButton({
  direction,
  onClick,
  className = '',
  label,
}: {
  direction: 'left' | 'right'
  onClick: (e: MouseEvent<HTMLButtonElement>) => void
  className?: string
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`flex items-center justify-center rounded-full bg-fe-ink/50 text-white hover:bg-fe-ink/70 transition ${className}`}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.5}
        className="w-1/2 h-1/2"
      >
        {direction === 'left' ? (
          <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        ) : (
          <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
        )}
      </svg>
    </button>
  )
}
