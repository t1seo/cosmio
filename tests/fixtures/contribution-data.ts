import type { ContributionData, ContributionWeek, ContributionDay } from '../../src/core/types.js';

// ── Seeded PRNG (Mulberry32) ────────────────────────────────────
// Deterministic pseudo-random number generator so every call
// with the same seed produces identical contribution grids.

function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Helpers ─────────────────────────────────────────────────────

const DAY_MS = 86_400_000;

/** Format a Date as YYYY-MM-DD */
function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Pick a contribution level using weighted distribution + RNG value */
function pickLevel(rand: number): 0 | 1 | 2 | 3 | 4 {
  // ~60% L0, ~20% L1, ~10% L2, ~7% L3, ~3% L4
  if (rand < 0.6) return 0;
  if (rand < 0.8) return 1;
  if (rand < 0.9) return 2;
  if (rand < 0.97) return 3;
  return 4;
}

/** Generate a count value consistent with the level */
function countForLevel(level: 0 | 1 | 2 | 3 | 4, rand: number): number {
  switch (level) {
    case 0:
      return 0;
    case 1:
      return 1 + Math.floor(rand * 3); // 1-3
    case 2:
      return 4 + Math.floor(rand * 4); // 4-7
    case 3:
      return 8 + Math.floor(rand * 5); // 8-12
    case 4:
      return 13 + Math.floor(rand * 8); // 13-20
  }
}

/** Build a 52-week grid starting from the first Sunday of the given year */
function buildWeeks(
  year: number,
  dayFn: (dayIndex: number, date: Date) => { count: number; level: 0 | 1 | 2 | 3 | 4 },
  weekCount = 52,
): ContributionWeek[] {
  // Find the first Sunday on or before Jan 1
  const jan1 = new Date(Date.UTC(year, 0, 1));
  const dayOfWeek = jan1.getUTCDay(); // 0 = Sunday
  const startDate = new Date(jan1.getTime() - dayOfWeek * DAY_MS);

  const weeks: ContributionWeek[] = [];
  let globalDay = 0;

  for (let w = 0; w < weekCount; w++) {
    const days: ContributionDay[] = [];
    const weekStart = new Date(startDate.getTime() + w * 7 * DAY_MS);

    for (let d = 0; d < 7; d++) {
      const date = new Date(weekStart.getTime() + d * DAY_MS);
      const { count, level } = dayFn(globalDay, date);
      days.push({ date: formatDate(date), count, level });
      globalDay++;
    }

    weeks.push({ firstDay: formatDate(weekStart), days });
  }

  return weeks;
}

// ── Mock GitHub GraphQL Response ────────────────────────────────

type GitHubContributionLevel =
  | 'NONE'
  | 'FIRST_QUARTILE'
  | 'SECOND_QUARTILE'
  | 'THIRD_QUARTILE'
  | 'FOURTH_QUARTILE';

interface MockApiResponse {
  data: {
    user: {
      contributionsCollection: {
        contributionCalendar: {
          totalContributions: number;
          weeks: Array<{
            contributionDays: Array<{
              date: string;
              contributionCount: number;
              contributionLevel: GitHubContributionLevel;
            }>;
          }>;
        };
      };
    };
  };
}

function levelToGitHubLevel(level: 0 | 1 | 2 | 3 | 4): GitHubContributionLevel {
  const map: Record<number, GitHubContributionLevel> = {
    0: 'NONE',
    1: 'FIRST_QUARTILE',
    2: 'SECOND_QUARTILE',
    3: 'THIRD_QUARTILE',
    4: 'FOURTH_QUARTILE',
  };
  return map[level];
}

// ── Factory Functions ───────────────────────────────────────────

/**
 * Create realistic mock contribution data with seeded randomness.
 *
 * Level distribution: ~60% L0, ~20% L1, ~10% L2, ~7% L3, ~3% L4
 *
 * @param overrides - Partial overrides for the returned data
 */
export function createMockContributionData(
  overrides?: Partial<ContributionData>,
): ContributionData {
  const rng = mulberry32(42);

  const weeks = buildWeeks(2025, () => {
    const r1 = rng();
    const level = pickLevel(r1);
    const r2 = rng();
    const count = countForLevel(level, r2);
    return { count, level };
  });

  return {
    weeks,
    stats: { total: 0, longestStreak: 0, currentStreak: 0, mostActiveDay: '' },
    year: 2025,
    username: 'testuser',
    ...overrides,
  };
}

/**
 * Create a mock GitHub GraphQL API response.
 *
 * Converts a ContributionData-style week grid into the shape returned by
 * the GitHub GraphQL API so that `fetchContributions` can be tested
 * against it.
 *
 * @param total - Override for totalContributions (default: sum from weeks)
 */
export function createMockApiResponse(total?: number): MockApiResponse {
  const data = createMockContributionData();

  const computedTotal = data.weeks.reduce(
    (sum, w) => sum + w.days.reduce((s, d) => s + d.count, 0),
    0,
  );

  return {
    data: {
      user: {
        contributionsCollection: {
          contributionCalendar: {
            totalContributions: total ?? computedTotal,
            weeks: data.weeks.map((week) => ({
              contributionDays: week.days.map((day) => ({
                date: day.date,
                contributionCount: day.count,
                contributionLevel: levelToGitHubLevel(day.level),
              })),
            })),
          },
        },
      },
    },
  };
}

/**
 * Create contribution data where every day has zero contributions (all L0).
 */
export function createEmptyContributionData(): ContributionData {
  const weeks = buildWeeks(2025, () => ({ count: 0, level: 0 as const }));

  return {
    weeks,
    stats: { total: 0, longestStreak: 0, currentStreak: 0, mostActiveDay: '' },
    year: 2025,
    username: 'emptyuser',
  };
}

/**
 * Create contribution data where every day is at max level (L4).
 */
export function createFullContributionData(): ContributionData {
  const weeks = buildWeeks(2025, () => ({ count: 20, level: 4 as const }));

  return {
    weeks,
    stats: { total: 0, longestStreak: 0, currentStreak: 0, mostActiveDay: '' },
    year: 2025,
    username: 'fulluser',
  };
}

/**
 * Create contribution data with a known streak pattern.
 *
 * The last `streakDays` days will have contributions (L2, count=5).
 * All earlier days will be zero. This makes streak assertions trivial.
 *
 * @param streakDays - Number of consecutive contribution days at the end
 */
export function createStreakTestData(streakDays: number): ContributionData {
  const totalDays = 52 * 7; // 364 days

  const weeks = buildWeeks(2025, (dayIndex) => {
    const isInStreak = dayIndex >= totalDays - streakDays;
    return isInStreak ? { count: 5, level: 2 as const } : { count: 0, level: 0 as const };
  });

  return {
    weeks,
    stats: { total: 0, longestStreak: 0, currentStreak: 0, mostActiveDay: '' },
    year: 2025,
    username: 'streakuser',
  };
}
