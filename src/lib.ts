// Public API for programmatic usage
export { fetchContributions } from './api/client.js';
export { computeStats } from './core/stats.js';
export { getTheme, listThemes, registerTheme } from './themes/registry.js';
export type { ContributionData, Theme, ThemeOutput, ThemeOptions } from './core/types.js';

// Register built-in themes
import './themes/nebula/index.js';
