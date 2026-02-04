/**
 * Generate case-study SVGs with different contribution patterns.
 * Usage: npx tsx scripts/generate-cases.ts
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { computeStats } from '../src/core/stats.js';
import { getTheme } from '../src/themes/registry.js';
import type { ContributionData, ContributionDay, ContributionWeek } from '../src/core/types.js';

import '../src/themes/terrain/index.js';

// ── Data Generators ──────────────────────────────────────────

function makeWeeks(
  gen: (w: number, d: number, rng: () => number) => number,
): ContributionWeek[] {
  const weeks: ContributionWeek[] = [];
  const baseDate = new Date(2025, 0, 5);
  let seed = 42;
  function rng() {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  }

  for (let w = 0; w < 52; w++) {
    const days: ContributionDay[] = [];
    const weekStart = new Date(baseDate);
    weekStart.setDate(weekStart.getDate() + w * 7);

    for (let d = 0; d < 7; d++) {
      const date = new Date(weekStart);
      date.setDate(date.getDate() + d);
      const dateStr = date.toISOString().split('T')[0];
      const count = Math.max(0, Math.round(gen(w, d, rng)));
      const level = count === 0 ? 0 : count <= 2 ? 1 : count <= 5 ? 2 : count <= 10 ? 3 : 4;
      days.push({ date: dateStr, count, level: level as 0 | 1 | 2 | 3 | 4 });
    }
    weeks.push({ firstDay: days[0].date, days });
  }
  return weeks;
}

function makeData(name: string, weeks: ContributionWeek[]): ContributionData {
  return { weeks, stats: computeStats(weeks), year: 2025, username: name };
}

// Case 1: Sparse — mostly empty, few scattered contributions (archipelago)
const sparseData = makeData('sparse-user', makeWeeks((w, d, rng) => {
  const r = rng();
  if (r > 0.88) return Math.floor(rng() * 3) + 1;
  return 0;
}));

// Case 2: Weekday warrior — active on weekdays, idle weekends
const weekdayData = makeData('weekday-user', makeWeeks((w, d, rng) => {
  const isWeekday = d >= 1 && d <= 5;
  const r = rng();
  if (!isWeekday) return r > 0.85 ? 1 : 0;
  if (r > 0.25) return Math.floor(rng() * 10) + 1;
  return 0;
}));

// Case 3: Burst mode — intense sprints with gaps
const burstData = makeData('burst-user', makeWeeks((w, d, rng) => {
  const inSprint = (w % 12 < 4);
  const r = rng();
  if (inSprint) {
    if (d >= 1 && d <= 5) return Math.floor(rng() * 18) + 3;
    return Math.floor(rng() * 8) + 1;
  }
  return r > 0.92 ? 1 : 0;
}));

// Case 4: Consistent — steady daily contributions
const consistentData = makeData('consistent-user', makeWeeks((w, d, rng) => {
  const r = rng();
  const base = 3 + Math.floor(rng() * 5);
  if (d >= 1 && d <= 5) return base + Math.floor(rng() * 3);
  return Math.floor(base * 0.5);
}));

// Case 5: Gradual growth — year starts empty, builds up
const growthData = makeData('growth-user', makeWeeks((w, d, rng) => {
  const progress = w / 51;
  const r = rng();
  const threshold = 1 - progress * 0.8;
  if (r < threshold) return 0;
  return Math.floor(rng() * (progress * 15)) + 1;
}));

// Case 6: Maximum — every cell near max (dense civilization)
const maxData = makeData('max-user', makeWeeks((w, d, rng) => {
  return Math.floor(rng() * 8) + 10;
}));

// Case 7: Early year — only first ~5 weeks have contributions
const earlyYearData = makeData('early-year-user', makeWeeks((w, d, rng) => {
  if (w >= 5) return 0; // rest of year is empty
  const r = rng();
  if (d >= 1 && d <= 5) {
    // Weekdays: moderate activity
    return r > 0.3 ? Math.floor(rng() * 8) + 1 : 0;
  }
  // Weekends: sparse
  return r > 0.75 ? Math.floor(rng() * 3) + 1 : 0;
}));

// ── Generate ─────────────────────────────────────────────────

const cases = [
  { name: 'sparse', label: 'Sparse (Archipelago)', data: sparseData },
  { name: 'weekday', label: 'Weekday Warrior', data: weekdayData },
  { name: 'burst', label: 'Sprint & Rest', data: burstData },
  { name: 'consistent', label: 'Consistent Contributor', data: consistentData },
  { name: 'growth', label: 'Gradual Growth', data: growthData },
  { name: 'max', label: 'Maximum Density (Civilization)', data: maxData },
  { name: 'early-year', label: 'Early Year (New Year Start)', data: earlyYearData },
];

const outDir = join(import.meta.dirname, '..', 'examples', 'cases');
mkdirSync(outDir, { recursive: true });

const theme = getTheme('terrain')!;
const htmlParts: string[] = [];

for (const c of cases) {
  const output = theme.render(c.data, {
    title: `@${c.data.username}`,
    width: 840,
    height: 240,
  });

  const darkPath = join(outDir, `${c.name}-dark.svg`);
  const lightPath = join(outDir, `${c.name}-light.svg`);
  writeFileSync(darkPath, output.dark, 'utf-8');
  writeFileSync(lightPath, output.light, 'utf-8');

  const darkSize = (Buffer.byteLength(output.dark) / 1024).toFixed(1);
  const lightSize = (Buffer.byteLength(output.light) / 1024).toFixed(1);
  console.log(`${c.label}: dark=${darkSize}KB, light=${lightSize}KB, ${c.data.stats.total} contributions`);

  htmlParts.push(`
    <div class="case">
      <h2>${c.label}</h2>
      <p>${c.data.stats.total} contributions, ${c.data.stats.longestStreak}d longest streak</p>
      <div class="row">
        <div class="preview dark-bg">
          <img src="${c.name}-dark.svg" width="840" height="240" />
        </div>
        <div class="preview light-bg">
          <img src="${c.name}-light.svg" width="840" height="240" />
        </div>
      </div>
    </div>`);
}

const html = `<!DOCTYPE html>
<html>
<head>
  <title>Terraviz — Case Studies</title>
  <style>
    body { margin: 20px 40px; font-family: system-ui; background: #1a1a2e; color: #e0e0e0; }
    h1 { color: #fff; margin-bottom: 8px; }
    h2 { margin: 24px 0 4px; color: #aaccff; }
    p { margin: 0 0 8px; color: #888; font-size: 13px; }
    .row { display: flex; gap: 12px; flex-wrap: wrap; }
    .preview { border: 1px solid #333; border-radius: 8px; overflow: hidden; flex: 1; min-width: 400px; }
    .dark-bg { background: #0d1117; padding: 12px; }
    .light-bg { background: #ffffff; padding: 12px; }
    img { width: 100%; height: auto; }
  </style>
</head>
<body>
  <h1>Terraviz — Terrain Theme Case Studies</h1>
  <p>7 different contribution patterns showing how the terrain adapts</p>
  ${htmlParts.join('\n')}
</body>
</html>`;

writeFileSync(join(outDir, 'cases.html'), html, 'utf-8');
console.log(`\nPreview: ${join(outDir, 'cases.html')}`);
