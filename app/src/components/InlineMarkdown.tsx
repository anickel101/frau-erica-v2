import ReactMarkdown from 'react-markdown'

// Renders markdown inline (as a span, not a paragraph) so it can sit inside
// text the caller is already laying out line-by-line.
export default function InlineMarkdown({ children }: { children: string }) {
  return (
    <ReactMarkdown
      components={{
        p: 'span',
        a: (props) => (
          <a {...props} className="text-fe-accent hover:text-fe-accent-dark" />
        ),
      }}
    >
      {children}
    </ReactMarkdown>
  )
}
