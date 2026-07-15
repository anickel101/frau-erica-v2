export interface GalleryPhoto {
  image_id: number
  title: string
  caption: string
  credit: string
  year_taken: number | null
  location: string
  width: number
  height: number
  url: string
}

export interface GalleryData {
  gallery_id: number
  name: string
  summary: string // markdown
  lead_image_id: number
  photos: GalleryPhoto[] // already in sort_order
  linkedPersonIds: number[] // person_ids that exist in mockPersons
}

// Stand-in for real photo files -- a plain SVG rectangle at the photo's
// actual dimensions, so <img> elements behave exactly as they will once
// real (and inconsistently-sized) photos are wired in.
function placeholderImageUrl(width: number, height: number): string {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${width}' height='${height}'><rect width='100%' height='100%' fill='%236B3A1B' fill-opacity='0.2'/></svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

function photo(data: Omit<GalleryPhoto, 'url'>): GalleryPhoto {
  return { ...data, url: placeholderImageUrl(data.width, data.height) }
}

// Cycled across the smaller mock galleries below, so photos aren't all
// identically shaped -- same reason the featured gallery mixes portrait,
// landscape, square, and panorama dimensions.
const DIMENSION_VARIANTS: [number, number][] = [
  [1600, 1067], // landscape 3:2
  [1200, 1600], // portrait
  [1400, 1400], // square
  [2000, 900], // panorama
]

function makeGalleryPhotos(idBase: number, count: number, name: string): GalleryPhoto[] {
  return Array.from({ length: count }, (_, i) => {
    const [width, height] = DIMENSION_VARIANTS[i % DIMENSION_VARIANTS.length]
    return photo({
      image_id: idBase + i,
      title: `${name} #${i + 1}`,
      caption: 'Placeholder caption -- real captions pending archive scan.',
      credit: '',
      year_taken: null,
      location: '',
      width,
      height,
    })
  })
}

const featuredGallery: GalleryData = {
  gallery_id: 1,
  name: 'Thomas Crawley Knowles: Year One',
  summary:
    "A year's worth of snapshots from Thomas's first twelve months -- hospital visit, first Christmas, first steps in the backyard on Ridgeland Avenue, and the cousins' reunion that August. Scanned from the Nickel family photo albums.",
  lead_image_id: 104,
  linkedPersonIds: [1016, 801, 802],
  photos: [
    photo({
      image_id: 101,
      title: 'Hospital day',
      caption: 'Just a few hours old.',
      credit: 'M. Nickel',
      year_taken: 2016,
      location: 'Chicago, IL',
      width: 1200,
      height: 1600, // portrait
    }),
    photo({
      image_id: 102,
      title: 'First car ride home',
      caption: 'Buckled in for the trip back to Oak Park.',
      credit: 'M. Nickel',
      year_taken: 2016,
      location: 'Chicago, IL',
      width: 1600,
      height: 1200, // landscape
    }),
    photo({
      image_id: 103,
      title: 'Sleeping through the noise',
      caption: 'The cousins visiting did not wake him up.',
      credit: 'A. Nickel',
      year_taken: 2016,
      location: 'Oak Park, IL',
      width: 1400,
      height: 1400, // square
    }),
    photo({
      image_id: 104,
      title: 'First Christmas',
      caption: 'Under the tree on Ridgeland Avenue.',
      credit: 'A. Nickel',
      year_taken: 2016,
      location: 'Oak Park, IL',
      width: 1600,
      height: 1067, // landscape 3:2
    }),
    photo({
      image_id: 105,
      title: 'Bath time',
      caption: 'Not a fan, apparently.',
      credit: 'R. Gaur',
      year_taken: 2017,
      location: 'Oak Park, IL',
      width: 1067,
      height: 1600, // portrait 2:3
    }),
    photo({
      image_id: 106,
      title: 'First steps',
      caption: 'In the backyard, chasing the dog.',
      credit: 'R. Gaur',
      year_taken: 2017,
      location: 'Oak Park, IL',
      width: 2000,
      height: 900, // panorama
    }),
    photo({
      image_id: 107,
      title: 'Cousins reunion',
      caption: 'Four generations in one backyard.',
      credit: 'M. Nickel',
      year_taken: 2017,
      location: 'Height of Land, MN',
      width: 1600,
      height: 1200,
    }),
    photo({
      image_id: 108,
      title: 'Birthday cake',
      caption: 'More cake on the face than in the mouth.',
      credit: 'A. Nickel',
      year_taken: 2017,
      location: 'Oak Park, IL',
      width: 1200,
      height: 1600,
    }),
    photo({
      image_id: 109,
      title: 'Grandparents visit',
      caption: 'Mark and Mary Allison came for the weekend.',
      credit: 'R. Gaur',
      year_taken: 2017,
      location: 'Oak Park, IL',
      width: 1400,
      height: 1400,
    }),
    photo({
      image_id: 110,
      title: 'End of year one',
      caption: 'A whole year, somehow.',
      credit: 'A. Nickel',
      year_taken: 2017,
      location: 'Oak Park, IL',
      width: 1600,
      height: 1067,
    }),
  ],
}

// Additional mock galleries -- enough to exceed the Index of Galleries
// page's 16-per-page threshold. Linked person ids are drawn from real
// entries already in mockPersons.json rather than invented names.
type GalleryStub = Omit<GalleryData, 'lead_image_id' | 'photos'>

const otherGalleries: GalleryData[] = (
  [
    {
      gallery_id: 2,
      name: 'Mueller Family Reunion, 1962',
      summary: 'Three generations of Muellers gathered for a summer reunion.',
      linkedPersonIds: [66, 62, 449, 14],
    },
    {
      gallery_id: 3,
      name: 'The Gahl Wedding',
      summary: 'William and Carol Ann Gahl, wedding day snapshots.',
      linkedPersonIds: [320, 328],
    },
    {
      gallery_id: 4,
      name: 'Bigelow Cousins at the Lake',
      summary: 'A week at the lake house with the Bigelow cousins.',
      linkedPersonIds: [869, 870, 1039],
    },
    {
      gallery_id: 5,
      name: 'de Haas Christmas, Oak Park',
      summary: 'Christmas morning at the de Haas household.',
      linkedPersonIds: [1223, 1220, 740],
    },
    {
      gallery_id: 6,
      name: 'Rickmeyer Homestead',
      summary: 'The old Rickmeyer homestead, still standing.',
      linkedPersonIds: [701],
    },
    {
      gallery_id: 7,
      name: 'Rösing Family Portraits',
      summary: 'Studio portraits of the Rösing family.',
      linkedPersonIds: [924],
    },
    {
      gallery_id: 8,
      name: 'Schreiber Sunday Dinner',
      summary: 'A regular Sunday dinner at the Schreiber house.',
      linkedPersonIds: [453],
    },
    {
      gallery_id: 9,
      name: 'Norton-Bigelow Anniversary',
      summary: "Laura and the Bigelows' anniversary celebration.",
      linkedPersonIds: [211, 1039],
    },
    {
      gallery_id: 10,
      name: 'King Family Album',
      summary: 'Selected pages from the King family photo album.',
      linkedPersonIds: [1250],
    },
    {
      gallery_id: 11,
      name: 'Robbins Farmhouse, Summer',
      summary: 'Summer at the Robbins farmhouse.',
      linkedPersonIds: [1246],
    },
    {
      gallery_id: 12,
      name: 'Grams Family Picnic',
      summary: 'An annual Grams family picnic tradition.',
      linkedPersonIds: [573],
    },
    {
      gallery_id: 13,
      name: 'Dahl Family, Height of Land',
      summary: 'The Dahl family at Height of Land, Minnesota.',
      linkedPersonIds: [694],
    },
    {
      gallery_id: 14,
      name: 'Maschhoff Confirmation Day',
      summary: 'Confirmation day photos for the Maschhoff family.',
      linkedPersonIds: [783],
    },
    {
      gallery_id: 15,
      name: 'The Priehs Homestead',
      summary: 'The Priehs family homestead, exterior and interior views.',
      linkedPersonIds: [180],
    },
    {
      gallery_id: 16,
      name: 'Beyer Family, Old Country',
      summary: 'Photos from the Beyer family before emigration.',
      linkedPersonIds: [1328],
    },
    {
      gallery_id: 17,
      name: 'Matthews Family Gathering',
      summary: 'A Matthews family gathering, generation spanning.',
      linkedPersonIds: [864],
    },
    {
      gallery_id: 18,
      name: 'Luecke Family Farm',
      summary: 'Life on the Luecke family farm.',
      linkedPersonIds: [709],
    },
    {
      gallery_id: 19,
      name: 'Werner Family Portraits',
      summary: 'Formal portraits of the Werner family.',
      linkedPersonIds: [409],
    },
    {
      gallery_id: 20,
      name: 'Pell Family, Newport',
      summary: 'The Pell family summering in Newport.',
      linkedPersonIds: [1126],
    },
  ] as GalleryStub[]
).map((g, i) => ({
  ...g,
  lead_image_id: 200 + i * 10,
  photos: makeGalleryPhotos(200 + i * 10, i % 2 === 0 ? 3 : 2, g.name),
}))

export const mockGalleries: GalleryData[] = [featuredGallery, ...otherGalleries].sort(
  (a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()),
)
