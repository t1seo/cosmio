// ── Contribution Data ──────────────────────────────────────────

/** A single day's contribution data */
export interface ContributionDay {
  /** ISO date string (YYYY-MM-DD) */
  date: string;
  /** Raw contribution count */
  count: number;
  /** GitHub's intensity level (0 = none, 4 = max) */
  level: 0 | 1 | 2 | 3 | 4;
}

/** A week of contribution data (7 days, Sunday–Saturday) */
export interface ContributionWeek {
  /** 7 days of contribution data */
  days: ContributionDay[];
  /** ISO date of the first day (Sunday) */
  firstDay: string;
}

/** Computed statistics from contribution data */
export interface ContributionStats {
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
export interface ContributionData {
  /** 52 (or 53) weeks of contribution data */
  weeks: ContributionWeek[];
  /** Computed statistics */
  stats: ContributionStats;
  /** The year this data represents */
  year: number;
  /** GitHub username */
  username: string;
}

// ── Theme System ───────────────────────────────────────────────

/** Options passed to theme renderers */
export interface ThemeOptions {
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
export interface ThemeOutput {
  /** SVG string for dark mode (GitHub dark: #0d1117) */
  dark: string;
  /** SVG string for light mode (GitHub light: #ffffff) */
  light: string;
}

/** Theme renderer interface — each theme must implement this */
export interface Theme {
  /** Unique theme identifier (e.g., "terrain") */
  name: string;
  /** Human-readable display name */
  displayName: string;
  /** Brief description */
  description: string;
  /** Render contribution data into dark and light SVGs */
  render(data: ContributionData, options: ThemeOptions): ThemeOutput;
}

// ── Color Mode ─────────────────────────────────────────────────

/** GitHub color mode */
export type ColorMode = 'dark' | 'light';

/** Color palette entry */
export interface PaletteColor {
  /** HEX color value (e.g., "#7C3AED") */
  hex: string;
  /** Default opacity (0–1) */
  opacity: number;
}

/** Contribution level color mapping */
export interface LevelColors {
  /** Colors for levels 0 through 4 */
  levels: [PaletteColor, PaletteColor, PaletteColor, PaletteColor, PaletteColor];
}

/** Complete color palette for a theme (one mode) */
export interface ThemePalette {
  /** Contribution level colors */
  contribution: LevelColors;
  /** Text colors */
  text: {
    primary: string;
    secondary: string;
    accent: string;
  };
  /** Background and structural colors */
  background: {
    /** Stars or grid elements */
    subtle: string;
  };
}

// ── CLI & Configuration ────────────────────────────────────────

/** CLI options parsed from command line arguments */
export interface CliOptions {
  /** GitHub username to visualize */
  user: string;
  /** Theme name (default: "terrain") */
  theme: string;
  /** Custom title text (default: "@<username>") */
  title: string;
  /** Output directory (default: "./") */
  output: string;
  /** Year to visualize (omit for rolling 52 weeks) */
  year?: number;
  /** GitHub personal access token */
  token?: string;
  /** Hemisphere for seasonal terrain (default: 'north') */
  hemisphere?: 'north' | 'south';
  /** Building density 1-10 (default: 5, higher = buildings at lower activity) */
  density?: number;
}

// ── SVG Builder ────────────────────────────────────────────────

/** SVG element attributes */
export type SvgAttributes = Record<string, string | number>;

/** SVG filter definition */
export interface SvgFilter {
  /** Filter ID (referenced via url(#id)) */
  id: string;
  /** Filter XML content */
  content: string;
}

// ── Animation ──────────────────────────────────────────────────

/** SMIL animation configuration */
export interface SmilAnimation {
  /** Target attribute to animate */
  attributeName: string;
  /** Animation values (semicolon-separated in output) */
  values: string[];
  /** Duration (e.g., "2s", "500ms") */
  dur: string;
  /** Repeat behavior */
  repeatCount: string | number;
  /** Optional begin delay */
  begin?: string;
  /** Fill behavior (default: "freeze") */
  fill?: 'freeze' | 'remove';
}

/** SMIL transform animation configuration */
export interface SmilTransformAnimation {
  /** Transform type */
  type: 'rotate' | 'scale' | 'translate';
  /** Animation values */
  values: string[];
  /** Duration */
  dur: string;
  /** Repeat behavior */
  repeatCount: string | number;
  /** Optional begin delay */
  begin?: string;
}

/** CSS keyframe animation (for properties SMIL can't handle) */
export interface CssAnimation {
  /** Animation name */
  name: string;
  /** Keyframe stops */
  keyframes: Record<string, Record<string, string>>;
  /** Duration */
  duration: string;
  /** Timing function */
  easing: string;
  /** Iteration count */
  iterationCount: string | number;
  /** Fill mode */
  fillMode?: string;
  /** Delay */
  delay?: string;
}
