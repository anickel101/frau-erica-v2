import type { Components } from 'react-markdown'

// Link styling for markdown rendered anywhere on the site.
//
// Tailwind's preflight strips the browser's default anchor styling, and
// nothing puts it back for markdown content -- so a link written as
// [text](url) inside a document, a summary or a photo caption rendered
// as plain black body text, indistinguishable from the prose around it
// and with no hint it could be clicked.
//
// That went unnoticed because the places links were MOST expected -- the
// index rows, the chapter lists -- are hand-built <Link> elements
// carrying their own classes. Only markdown-sourced links were affected:
// 52 published documents, 8 summaries, 27 photo captions, and one
// family description.
//
// Spread into a components object rather than wrapped in a component, so
// a caller that already overrides img or p keeps those and gains this:
//
//   <ReactMarkdown components={{ ...markdownLink, img: ... }}>
//
// Same colours as InlineMarkdown's own anchor override, which had this
// right all along -- that file is where the pattern comes from.
export const markdownLink: Partial<Components> = {
  a: (props) => <a {...props} className="text-fe-link hover:text-fe-link-dark" />,
}
