import { GalleryData } from '../data/mockGallery'
import { Person, mockPersons } from '../data/mockPersons'

export function getLinkedPersons(gallery: GalleryData): Person[] {
  return gallery.linkedPersonIds
    .map((id) => mockPersons.find((p) => p.person_id === id))
    .filter((p): p is Person => p !== undefined)
}
