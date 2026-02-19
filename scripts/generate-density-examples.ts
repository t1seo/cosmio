/**
 * Generate density comparison SVGs (density 1-10, same contribution data).
 * Usage: npx tsx scripts/generate-density-examples.ts
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { computeStats } from '../src/core/stats.js';
import { getTheme } from '../src/themes/registry.js';
import type { ContributionDay, ContributionWeek } from '../src/core/types.js';

import '../src/themes/terrain/index.js';

function makeWeeks(
  genSeed: number,
  gen: (w: number, d: number, rng: () => number) => number,
): ContributionWeek[] {
  let seed = genSeed;
  function rng() {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  }

  const weeks: ContributionWeek[] = [];
  const baseDate = new Date(2025, 0, 5);

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

// Moderate activity pattern — weekday committer with some variation
// Most days 1-5 commits, occasional burst of 10+, weekends sparse
const weeks = makeWeeks(77, (w, d, rng) => {
  const isWeekday = d >= 1 && d <= 5;
  const r = rng();
  if (isWeekday) {
    if (r > 0.25) return Math.floor(rng() * 8) + 1;
  } else {
    if (r > 0.7) return Math.floor(rng() * 3) + 1;
  }
  return 0;
});

const data = { weeks, stats: computeStats(weeks), year: 2025, username: 'density-demo' };
const theme = getTheme('terrain')!;
const outDir = join(import.meta.dirname, '..', 'examples', 'density');
mkdirSync(outDir, { recursive: true });

const htmlParts: string[] = [];

for (let density = 1; density <= 10; density++) {
  const output = theme.render(data, {
    title: `density=${density}`,
    width: 840,
    height: 240,
    density,
  });

  const darkPath = join(outDir, `density-${density}-dark.svg`);
  writeFileSync(darkPath, output.dark, 'utf-8');

  const darkSize = (Buffer.byteLength(output.dark) / 1024).toFixed(1);
  console.log(`density=${density}: ${darkSize}KB`);

  htmlParts.push(`
    <div class="case">
      <h2>density=${density}${density === 5 ? ' (default)' : ''}</h2>
      <div class="preview">
        <img src="density-${density}-dark.svg" width="840" height="240" />
      </div>
    </div>`);
}

const html = `<!DOCTYPE html>
<html>
<head>
  <title>Maeul in the Sky — Density Comparison</title>
  <style>
    body { margin: 20px 40px; font-family: system-ui; background: #0d1117; color: #e0e0e0; }
    h1 { color: #fff; margin-bottom: 4px; }
    .subtitle { color: #888; font-size: 14px; margin: 0 0 20px; }
    h2 { margin: 16px 0 4px; color: #aaccff; font-size: 16px; }
    .preview { border: 1px solid #333; border-radius: 8px; overflow: hidden; background: #0d1117; padding: 8px; }
    img { width: 100%; height: auto; }
  </style>
</head>
<body>
  <h1>Density Comparison (1-10)</h1>
  <p class="subtitle">Same contribution data (${data.stats.total} contributions), only density changes. Buildings appear at level 79+.</p>
  ${htmlParts.join('\n')}
</body>
</html>`;

writeFileSync(join(outDir, 'density.html'), html, 'utf-8');
console.log(`\nDone — preview: ${join(outDir, 'density.html')}`);
