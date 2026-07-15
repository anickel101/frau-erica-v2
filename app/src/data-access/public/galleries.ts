import galleriesRaw from '../../data/generated/galleries.json'

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
  summary: string
  lead_image_id: number
  photos: GalleryPhoto[] // already in sort_order
  linkedPersonIds: number[] // person_ids that exist in mockPersons
}

const galleries: GalleryData[] = (galleriesRaw as GalleryData[])
  .slice()
  .sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()))

export function listGalleries(): GalleryData[] {
  return galleries
}

export function getGalleryById(id: number): GalleryData | undefined {
  return galleries.find((g) => g.gallery_id === id)
}
