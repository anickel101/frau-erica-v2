const IMAGE_BASE_URL = 'https://d28yzpcwy2p42m.cloudfront.net'

// Images.url in the database is stored as a bare filename (e.g.
// "Addie1.jpg"), deliberately -- see the Images table's comment in
// schema.sql -- so the hosting location can change without touching data.
// This is the one place that knowledge lives.
export function resolveImageUrl(filename: string): string {
  return `${IMAGE_BASE_URL}/${encodeURIComponent(filename)}`
}
