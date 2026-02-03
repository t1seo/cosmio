import type { Theme } from '../core/types.js';

/** Internal theme storage */
const themes: Map<string, Theme> = new Map();

/**
 * Register a theme in the global registry
 * @param theme - Theme to register
 */
export function registerTheme(theme: Theme): void {
  themes.set(theme.name, theme);
}

/**
 * Retrieve a theme by its unique name
 * @param name - Theme identifier
 * @returns The theme, or undefined if not found
 */
export function getTheme(name: string): Theme | undefined {
  return themes.get(name);
}

/**
 * List all registered theme names
 * @returns Array of theme identifiers
 */
export function listThemes(): string[] {
  return [...themes.keys()];
}

/**
 * Get the default theme name
 * @returns The default theme identifier
 */
export function getDefaultTheme(): string {
  return 'nebula';
}
