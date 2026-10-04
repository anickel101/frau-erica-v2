import { GalleryData } from '../data-access/public/galleries'
import { mockPersons } from '../data/mockPersons'
import { Person } from '../types/person'

// The people tagged in one photograph, resolved to real Person records.
// Same shape as getLinkedPersons below, which does it for a whole
// gallery -- an id with no matching person is dropped rather than
// rendered as a number.
export function getPhotoPersons(photo: { personIds: number[] }): Person[] {
  return photo.personIds
    .map((id) => mockPersons.find((p) => p.person_id === id))
    .filter((p): p is Person => p !== undefined)
}

export function getLinkedPersons(gallery: GalleryData): Person[] {
  return gallery.linkedPersonIds
    .map((id) => mockPersons.find((p) => p.person_id === id))
    .filter((p): p is Person => p !== undefined)
}
