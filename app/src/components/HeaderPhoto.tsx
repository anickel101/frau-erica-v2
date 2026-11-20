import { useHeaderRef } from '../hooks/useHeaderRef'

// The photograph across the top of a page, shown whole, at its own
// proportions. Shared by every page that has one of the hdr.* header
// photographs (texts, collections, Family pages, recipes, the Lexicon),
// and it registers itself with useHeaderRef so the sidebar's divider lands
// on its bottom edge whatever height that turns out to be.
//
// These used to be six copies of a box with a fixed height (h-64 sm:h-80)
// and object-cover. A fixed height only fits a photograph of one
// particular shape at one particular width (2.8:1 at full width), and
// trimmed everything else: the top and bottom of most photographs in a
// wide window -- the heads off the back row and the skates off the front
// of a team photo -- and the sides in a narrow one. The archivist's own site solved it the same
// way this does: let the picture set the height, and measure where the
// rule goes. The hdr.* photographs were made as wide rectangles (1.75:1
// to 3.5:1) for exactly that reason.
//
// Not used by RandomHeaderImage (Home, Contact, User's Guide): that draws
// any gallery photograph, portraits included, and one shown whole at full
// width stood 1,100px tall. Those keep the fixed, cropped band.
//
// width/height are a placeholder shape, not the photograph's real size:
// with `h-auto` the browser treats them as `aspect-ratio: auto 896/390`,
// which holds that space until the image arrives and then gives way to
// the image's own proportions. 133 of the 174 header images have no
// recorded dimensions, so there's nothing better to pass; 2.3:1 is near
// the middle of the ones that do, so the jump on load is small.
const PLACEHOLDER_WIDTH = 896
const PLACEHOLDER_HEIGHT = 390

export default function HeaderPhoto({
  src,
  alt = '',
  className = '',
}: {
  src: string
  alt?: string
  className?: string
}) {
  const headerRef = useHeaderRef()
  return (
    <div ref={headerRef} className={`max-w-4xl bg-fe-brown/20 ${className}`}>
      <img
        src={src}
        alt={alt}
        width={PLACEHOLDER_WIDTH}
        height={PLACEHOLDER_HEIGHT}
        className="block w-full h-auto"
      />
    </div>
  )
}
