import { apiFetch } from './apiClient'
import { RecipeDetail, RecipeListItem } from '../../types/recipe'

export function listRecipes(): Promise<{ recipes: RecipeListItem[] }> {
  return apiFetch<{ recipes: RecipeListItem[] }>('/recipes')
}

export function getRecipeBySlug(slug: string): Promise<RecipeDetail> {
  return apiFetch<RecipeDetail>(`/recipes/${encodeURIComponent(slug)}`)
}
