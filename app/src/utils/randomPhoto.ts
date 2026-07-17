import { GalleryPhoto, listGalleries } from '../data-access/public/galleries'

// Flattened list of every photo across every gallery -- shared by every
// page that picks a decorative random photo (Home, Contact, User's
// Guide), previously three independent copies of the same flatMap.
export function getAllGalleryPhotos(): GalleryPhoto[] {
  return listGalleries().flatMap((gallery) => gallery.photos)
}

export function pickRandomPhoto(photos: GalleryPhoto[]): GalleryPhoto | undefined {
  return photos.length > 0 ? photos[Math.floor(Math.random() * photos.length)] : undefined
}
