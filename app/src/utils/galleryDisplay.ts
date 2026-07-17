import { GalleryData } from '../data-access/public/galleries'
import { mockPersons } from '../data/mockPersons'
import { Person } from '../types/person'

export function getLinkedPersons(gallery: GalleryData): Person[] {
  return gallery.linkedPersonIds
    .map((id) => mockPersons.find((p) => p.person_id === id))
    .filter((p): p is Person => p !== undefined)
}
