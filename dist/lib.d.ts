/** A single day's contribution data */
interface ContributionDay {
  /** ISO date string (YYYY-MM-DD) */
  date: string;
  /** Raw contribution count */
  count: number;
  /** GitHub's intensity level (0 = none, 4 = max) */
  level: 0 | 1 | 2 | 3 | 4;
}
/** A week of contribution data (7 days, Sunday–Saturday) */
interface ContributionWeek {
  /** 7 days of contribution data */
  days: ContributionDay[];
  /** ISO date of the first day (Sunday) */
  firstDay: string;
}
/** Computed statistics from contribution data */
interface ContributionStats {
  /** Total contributions in the year */
  total: number;
  /** Longest consecutive contribution streak (days) */
  longestStreak: number;
  /** Current active streak (days, 0 if broken) */
  currentStreak: number;
  /** Most active day of the week (e.g., "Wednesday") */
  mostActiveDay: string;
}
/** Complete contribution data for one year */
interface ContributionData {
  /** 52 (or 53) weeks of contribution data */
  weeks: ContributionWeek[];
  /** Computed statistics */
  stats: ContributionStats;
  /** The year this data represents */
  year: number;
  /** GitHub username */
  username: string;
}
/** Options passed to theme renderers */
interface ThemeOptions {
  /** Title text displayed in the SVG */
  title: string;
  /** SVG viewBox width (default: 840) */
  width: number;
  /** SVG viewBox height (default: 240) */
  height: number;
  /** Hemisphere for seasonal terrain (default: 'north') */
  hemisphere?: 'north' | 'south';
  /** Building density 1-10 (default: 5, higher = buildings at lower activity) */
  density?: number;
}
/** Rendered SVG output for both color modes */
interface ThemeOutput {
  /** SVG string for dark mode (GitHub dark: #0d1117) */
  dark: string;
  /** SVG string for light mode (GitHub light: #ffffff) */
  light: string;
}
/** Theme renderer interface — each theme must implement this */
interface Theme {
  /** Unique theme identifier (e.g., "terrain") */
  name: string;
  /** Human-readable display name */
  displayName: string;
  /** Brief description */
  description: string;
  /** Render contribution data into dark and light SVGs */
  render(data: ContributionData, options: ThemeOptions): ThemeOutput;
}

/**
 * GitHub GraphQL API client for fetching contribution data
 */

/**
 * Fetch GitHub contribution data for a specific user.
 *
 * When `year` is provided, fetches the full calendar year (Jan 1 – Dec 31).
 * When `year` is omitted, fetches a rolling 52-week window ending today,
 * matching GitHub's own profile contribution graph.
 *
 * @param username - GitHub username
 * @param year - Optional year to fetch. Omit for rolling 52 weeks.
 * @param token - Optional GitHub personal access token (required for private profiles)
 * @returns Promise resolving to ContributionData
 * @throws Error if user not found, rate limited, or network failure
 */
declare function fetchContributions(
  username: string,
  year?: number,
  token?: string,
): Promise<ContributionData>;

/**
 * Computes contribution statistics from weekly contribution data.
 *
 * @param weeks - Array of contribution weeks (each week has 7 days, Sunday-Saturday)
 * @returns Computed statistics including total, streaks, and most active day
 */
declare function computeStats(weeks: ContributionWeek[]): ContributionStats;

/**
 * Register a theme in the global registry
 * @param theme - Theme to register
 */
declare function registerTheme(theme: Theme): void;
/**
 * Retrieve a theme by its unique name
 * @param name - Theme identifier
 * @returns The theme, or undefined if not found
 */
declare function getTheme(name: string): Theme | undefined;
/**
 * List all registered theme names
 * @returns Array of theme identifiers
 */
declare function listThemes(): string[];

export {
  type ContributionData,
  type Theme,
  type ThemeOptions,
  type ThemeOutput,
  computeStats,
  fetchContributions,
  getTheme,
  listThemes,
  registerTheme,
};
