#!/usr/bin/env node
#!/usr/bin/env node

// src/index.ts
import { Command } from "commander";
import { writeFile } from "fs/promises";
import { join } from "path";

// src/api/queries.ts
var CONTRIBUTIONS_QUERY = `
  query ContributionsCalendar($username: String!, $from: DateTime!, $to: DateTime!) {
    user(login: $username) {
      contributionsCollection(from: $from, to: $to) {
        contributionCalendar {
          totalContributions
          weeks {
            contributionDays {
              date
              contributionCount
              contributionLevel
            }
          }
        }
      }
    }
  }
`;

// src/api/client.ts
var GITHUB_API_ENDPOINT = "https://api.github.com/graphql";
function mapContributionLevel(level) {
  switch (level) {
    case "NONE":
      return 0;
    case "FIRST_QUARTILE":
      return 1;
    case "SECOND_QUARTILE":
      return 2;
    case "THIRD_QUARTILE":
      return 3;
    case "FOURTH_QUARTILE":
      return 4;
    default:
      return 0;
  }
}
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
async function makeGraphQLRequest(query, variables, token) {
  const headers = {
    "Content-Type": "application/json",
    "User-Agent": "maeul-in-the-sky"
  };
  if (token) {
    headers["Authorization"] = `bearer ${token}`;
  }
  const body = JSON.stringify({ query, variables });
  const delays = [1e3, 2e3, 4e3];
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(GITHUB_API_ENDPOINT, {
        method: "POST",
        headers,
        body
      });
      const data = await response.json();
      if (data.errors && data.errors.length > 0) {
        const error = data.errors[0];
        if (error.type === "NOT_FOUND" || error.message.includes("Could not resolve to a User")) {
          throw new Error(`GitHub user not found`);
        }
        if (response.status === 403 || error.message.includes("rate limit")) {
          throw new Error(`GitHub API rate limit exceeded`);
        }
        throw new Error(`GitHub API error: ${error.message}`);
      }
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error(`Authentication failed: invalid GitHub token`);
        }
        if (response.status === 403) {
          throw new Error(`GitHub API rate limit exceeded`);
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      if (!data.data?.user) {
        throw new Error(`GitHub user not found`);
      }
      return data;
    } catch (error) {
      const isLastAttempt = attempt === 2;
      if (error instanceof Error && (error.message.includes("not found") || error.message.includes("Authentication failed"))) {
        throw error;
      }
      if (isLastAttempt) {
        if (error instanceof Error) {
          throw new Error(`Network failure: ${error.message}`, { cause: error });
        }
        throw new Error(`Network failure: ${String(error)}`, { cause: error });
      }
      await sleep(delays[attempt]);
    }
  }
  throw new Error("Network failure: maximum retry attempts exceeded");
}
async function fetchContributions(username, year, token) {
  let from;
  let to;
  let effectiveYear;
  if (year != null) {
    from = `${year}-01-01T00:00:00Z`;
    to = `${year}-12-31T23:59:59Z`;
    effectiveYear = year;
  } else {
    const now = /* @__PURE__ */ new Date();
    const oneYearAgo = new Date(now);
    oneYearAgo.setFullYear(now.getFullYear() - 1);
    from = oneYearAgo.toISOString();
    to = now.toISOString();
    effectiveYear = now.getFullYear();
  }
  const response = await makeGraphQLRequest(CONTRIBUTIONS_QUERY, { username, from, to }, token);
  const calendar = response.data.user.contributionsCollection.contributionCalendar;
  const weeks = calendar.weeks.map((week) => {
    const days = week.contributionDays.map((day) => ({
      date: day.date,
      count: day.contributionCount,
      level: mapContributionLevel(day.contributionLevel)
    }));
    return {
      days,
      firstDay: days[0].date
    };
  });
  return {
    weeks,
    stats: {
      total: calendar.totalContributions,
      longestStreak: 0,
      currentStreak: 0,
      mostActiveDay: ""
    },
    year: effectiveYear,
    username
  };
}

// src/core/stats.ts
function computeStats(weeks) {
  if (weeks.length === 0) {
    return {
      total: 0,
      longestStreak: 0,
      currentStreak: 0,
      mostActiveDay: "Monday"
      // Default for empty data
    };
  }
  const allDays = weeks.flatMap((week) => week.days);
  const total = allDays.reduce((sum, day) => sum + day.count, 0);
  let longestStreak = 0;
  let currentStreakCount = 0;
  for (const day of allDays) {
    if (day.count > 0) {
      currentStreakCount++;
      longestStreak = Math.max(longestStreak, currentStreakCount);
    } else {
      currentStreakCount = 0;
    }
  }
  let currentStreak = 0;
  for (let i = allDays.length - 1; i >= 0; i--) {
    if (allDays[i].count > 0) {
      currentStreak++;
    } else {
      break;
    }
  }
  const dayTotals = [0, 0, 0, 0, 0, 0, 0];
  for (const week of weeks) {
    for (let dayIndex = 0; dayIndex < week.days.length; dayIndex++) {
      dayTotals[dayIndex] += week.days[dayIndex].count;
    }
  }
  let maxDayIndex = 0;
  let maxContributions = dayTotals[0];
  for (let i = 1; i < dayTotals.length; i++) {
    if (dayTotals[i] > maxContributions) {
      maxContributions = dayTotals[i];
      maxDayIndex = i;
    }
  }
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const mostActiveDay = dayNames[maxDayIndex];
  return {
    total,
    longestStreak,
    currentStreak,
    mostActiveDay
  };
}

// src/themes/registry.ts
var themes = /* @__PURE__ */ new Map();
function registerTheme(theme) {
  themes.set(theme.name, theme);
}
function getTheme(name) {
  return themes.get(name);
}
function listThemes() {
  return [...themes.keys()];
}
function getDefaultTheme() {
  return "terrain";
}

// src/core/svg.ts
function svgElement(tag, attrs, children) {
  const attrString = Object.entries(attrs).map(([key, value]) => `${key}="${value}"`).join(" ");
  if (children !== void 0) {
    return `<${tag} ${attrString}>${children}</${tag}>`;
  }
  return `<${tag} ${attrString}/>`;
}
function svgRoot(attrs, content) {
  const mergedAttrs = {
    xmlns: "http://www.w3.org/2000/svg",
    viewBox: "0 0 840 240",
    ...attrs
  };
  return svgElement("svg", mergedAttrs, content);
}
function svgStyle(css) {
  return `<style><![CDATA[${css}]]></style>`;
}
function formatNumber(n) {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

// src/utils/math.ts
function lerp(a, b, t) {
  return a + (b - a) * t;
}
function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
function hash(str) {
  let hash2 = 5381;
  for (let i = 0; i < str.length; i++) {
    hash2 = hash2 * 33 ^ str.charCodeAt(i);
  }
  return hash2 >>> 0;
}
function seededRandom(seed) {
  return function() {
    let t = seed += 1831565813;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// src/themes/shared.ts
var FONT_FAMILY = "'Segoe UI', system-ui, sans-serif";
function renderTitle(title, palette) {
  return [
    `<text`,
    ` x="24"`,
    ` y="17"`,
    ` font-family="${FONT_FAMILY}"`,
    ` font-size="14"`,
    ` fill="${palette.text.primary}"`,
    ` font-weight="600"`,
    `>${escapeXml(title)}</text>`
  ].join("");
}
function renderStatsBar(stats, palette) {
  const items = [
    `${formatNumber(stats.total)} contributions`,
    `${formatNumber(stats.currentStreak)}d current streak`,
    `${formatNumber(stats.longestStreak)}d longest streak`,
    `Most active: ${stats.mostActiveDay}`
  ];
  const segments = items.map(
    (text, i) => `<text x="${24 + i * 200}" y="233" font-family="${FONT_FAMILY}" font-size="11" fill="${palette.text.secondary}">${escapeXml(text)}</text>`
  ).join("");
  return `<g class="stats-bar">${segments}</g>`;
}
function contributionGrid(data, options) {
  const { cellSize, gap, offsetX, offsetY } = options;
  const cells = [];
  for (let week = 0; week < data.weeks.length; week++) {
    const weekData = data.weeks[week];
    for (let day = 0; day < weekData.days.length; day++) {
      const dayData = weekData.days[day];
      cells.push({
        x: offsetX + week * (cellSize + gap),
        y: offsetY + day * (cellSize + gap),
        level: dayData.level,
        count: dayData.count,
        date: dayData.date
      });
    }
  }
  return cells;
}
function computeLevel100(count, maxCount) {
  if (count === 0) return 0;
  if (maxCount <= 0) return 1;
  const ratio = clamp(count / maxCount, 0, 1);
  const curved = Math.sqrt(ratio);
  return clamp(Math.round(curved * 98) + 1, 1, 99);
}
function enrichGridCells100(cells, data) {
  const nonZeroCounts = [];
  for (const week of data.weeks) {
    for (const day of week.days) {
      if (day.count > 0) nonZeroCounts.push(day.count);
    }
  }
  nonZeroCounts.sort((a, b) => a - b);
  const p90Index = Math.floor(nonZeroCounts.length * 0.9);
  const effectiveMax = nonZeroCounts.length > 0 ? nonZeroCounts[Math.min(p90Index, nonZeroCounts.length - 1)] : 1;
  return cells.map((cell) => ({
    ...cell,
    level100: computeLevel100(cell.count, effectiveMax)
  }));
}
function escapeXml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

// src/themes/terrain/seasons.ts
var ZONE_BOUNDS = [
  { zone: 0, start: 0, end: 4 },
  // Winter peak
  { zone: 1, start: 5, end: 13 },
  // Winter -> Spring (longer transition)
  { zone: 2, start: 14, end: 18 },
  // Spring peak
  { zone: 3, start: 19, end: 27 },
  // Spring -> Summer (longer transition)
  { zone: 4, start: 28, end: 32 },
  // Summer peak
  { zone: 5, start: 33, end: 40 },
  // Summer -> Autumn (longer transition)
  { zone: 6, start: 41, end: 45 },
  // Autumn peak
  { zone: 7, start: 46, end: 51 }
  // Autumn -> Winter (longer transition)
];
function computeSeasonRotation(oldestWeekDate, hemisphere = "north") {
  const year = oldestWeekDate.getFullYear();
  const dec1 = new Date(year, 11, 1);
  const refDate = oldestWeekDate < dec1 ? new Date(year - 1, 11, 1) : dec1;
  const diffMs = oldestWeekDate.getTime() - refDate.getTime();
  let rotation = Math.round(diffMs / (7 * 864e5));
  if (hemisphere === "south") rotation = (rotation + 26) % 52;
  return (rotation % 52 + 52) % 52;
}
function getSeasonZone(week, rotation = 0) {
  let w = (week + rotation) % 52;
  w = clamp(w, 0, 51);
  for (const bound of ZONE_BOUNDS) {
    if (w >= bound.start && w <= bound.end) {
      return bound.zone;
    }
  }
  return 4;
}
function getTransitionBlend(week, rotation = 0) {
  let w = (week + rotation) % 52;
  w = clamp(w, 0, 51);
  const zone = getSeasonZone(week, rotation);
  switch (zone) {
    case 0:
      return { from: "winter", to: "winter", t: 0 };
    case 1: {
      const bound = ZONE_BOUNDS[1];
      const t = (w - bound.start) / (bound.end - bound.start);
      return { from: "winter", to: "spring", t };
    }
    case 2:
      return { from: "spring", to: "spring", t: 0 };
    case 3: {
      const bound = ZONE_BOUNDS[3];
      const t = (w - bound.start) / (bound.end - bound.start);
      return { from: "spring", to: "summer", t };
    }
    case 4:
      return { from: "summer", to: "summer", t: 0 };
    case 5: {
      const bound = ZONE_BOUNDS[5];
      const t = (w - bound.start) / (bound.end - bound.start);
      return { from: "summer", to: "autumn", t };
    }
    case 6:
      return { from: "autumn", to: "autumn", t: 0 };
    case 7: {
      const bound = ZONE_BOUNDS[7];
      const t = (w - bound.start) / (bound.end - bound.start);
      return { from: "autumn", to: "winter", t };
    }
  }
}
var SEASON_TINTS = {
  winter: {
    colorShift: 0.35,
    colorTarget: [238, 242, 248],
    // #eef2f8 — snowy white
    greenMul: 0.6,
    warmth: -5,
    snowCoverage: 0.35,
    saturation: 0.65
  },
  spring: {
    colorShift: 0.05,
    colorTarget: [255, 220, 230],
    // pink warmth
    greenMul: 1.15,
    warmth: 5,
    snowCoverage: 0,
    saturation: 1.15
  },
  summer: {
    colorShift: 0,
    colorTarget: [0, 0, 0],
    greenMul: 1,
    warmth: 0,
    snowCoverage: 0,
    saturation: 1
  },
  autumn: {
    colorShift: 0.12,
    colorTarget: [210, 170, 60],
    // golden-yellow with hint of orange
    greenMul: 0.65,
    // some green remains (late summer trees)
    warmth: 15,
    // moderate warmth (yellow-orange, not red)
    snowCoverage: 0,
    saturation: 1.12
    // vivid but natural
  }
};
function getSeasonalTint(week, rotation = 0) {
  const { from, to, t } = getTransitionBlend(week, rotation);
  const a = SEASON_TINTS[from];
  const b = SEASON_TINTS[to];
  return lerpTint(a, b, t);
}
function lerpTint(a, b, t) {
  return {
    colorShift: lerp(a.colorShift, b.colorShift, t),
    colorTarget: [
      Math.round(lerp(a.colorTarget[0], b.colorTarget[0], t)),
      Math.round(lerp(a.colorTarget[1], b.colorTarget[1], t)),
      Math.round(lerp(a.colorTarget[2], b.colorTarget[2], t))
    ],
    greenMul: lerp(a.greenMul, b.greenMul, t),
    warmth: lerp(a.warmth, b.warmth, t),
    snowCoverage: lerp(a.snowCoverage, b.snowCoverage, t),
    saturation: lerp(a.saturation, b.saturation, t)
  };
}
function applyTint(r, g, b, tint) {
  const gray = 0.299 * r + 0.587 * g + 0.114 * b;
  let nr = gray + (r - gray) * tint.saturation;
  let ng = gray + (g - gray) * tint.saturation;
  let nb = gray + (b - gray) * tint.saturation;
  ng *= tint.greenMul;
  nr += tint.warmth;
  nb -= tint.warmth;
  if (tint.colorShift > 0) {
    nr = lerp(nr, tint.colorTarget[0], tint.colorShift);
    ng = lerp(ng, tint.colorTarget[1], tint.colorShift);
    nb = lerp(nb, tint.colorTarget[2], tint.colorShift);
  }
  if (tint.snowCoverage > 0) {
    nr = lerp(nr, 240, tint.snowCoverage);
    ng = lerp(ng, 244, tint.snowCoverage);
    nb = lerp(nb, 250, tint.snowCoverage);
  }
  return [
    clamp(Math.round(nr), 0, 255),
    clamp(Math.round(ng), 0, 255),
    clamp(Math.round(nb), 0, 255)
  ];
}
function applyTintToHex(hex, tint) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const [nr, ng, nb] = applyTint(r, g, b, tint);
  return "#" + [nr, ng, nb].map((c) => c.toString(16).padStart(2, "0")).join("");
}
function applyTintToRgb(rgb, tint) {
  const m = rgb.match(/(\d+)/g);
  if (!m || m.length < 3) return rgb;
  const [r, g, b] = [+m[0], +m[1], +m[2]];
  const [nr, ng, nb] = applyTint(r, g, b, tint);
  if (m.length >= 4) {
    return `rgba(${nr},${ng},${nb},${m[3].includes(".") ? m[3] : +m[3]})`;
  }
  return `rgb(${nr},${ng},${nb})`;
}
var SEASON_REMOVE = {
  winter: /* @__PURE__ */ new Set([
    "flower",
    "butterfly",
    "wildflowerPatch",
    "tulip",
    "tulipField",
    "cherryBlossom",
    "cherryBlossomSmall",
    "cherryPetals",
    "crocus",
    "lamb",
    "sprout",
    "gardenBed",
    "birdhouse",
    "nest",
    "parasol",
    "beachTowel",
    "surfboard",
    "swimmingPool",
    "sunflower",
    "watermelon",
    "hammock",
    "iceCreamCart",
    "lemonade",
    "sprinkler",
    "fireflies",
    "sandcastleSummer"
  ]),
  spring: /* @__PURE__ */ new Set([
    "snowPine",
    "snowDeciduous",
    "snowman",
    "snowdrift",
    "igloo",
    "frozenPond",
    "icicle",
    "sled",
    "snowCoveredRock",
    "bareBush",
    "winterBird",
    "firewood",
    "parasol",
    "beachTowel",
    "surfboard",
    "swimmingPool",
    "iceCreamCart",
    "lemonade",
    "sprinkler",
    "sandcastleSummer"
  ]),
  summer: /* @__PURE__ */ new Set([
    "snowPine",
    "snowDeciduous",
    "snowman",
    "snowdrift",
    "igloo",
    "frozenPond",
    "icicle",
    "sled",
    "snowCoveredRock",
    "bareBush",
    "winterBird",
    "firewood",
    "autumnMaple",
    "autumnOak",
    "autumnBirch",
    "autumnGinkgo",
    "fallenLeaves",
    "leafSwirl",
    "cornStalk",
    "scarecrowAutumn",
    "harvestBasket",
    "hotDrink",
    "autumnWreath"
  ]),
  autumn: /* @__PURE__ */ new Set([
    "snowPine",
    "snowDeciduous",
    "snowman",
    "snowdrift",
    "igloo",
    "frozenPond",
    "icicle",
    "sled",
    "snowCoveredRock",
    "bareBush",
    "winterBird",
    "firewood",
    "flower",
    "butterfly",
    "wildflowerPatch",
    "tulip",
    "tulipField",
    "cherryBlossom",
    "cherryBlossomSmall",
    "cherryPetals",
    "crocus",
    "lamb",
    "sprout",
    "gardenBed",
    "birdhouse",
    "nest",
    "parasol",
    "beachTowel",
    "surfboard",
    "swimmingPool",
    "sunflower",
    "watermelon",
    "hammock",
    "iceCreamCart",
    "lemonade",
    "sprinkler",
    "fireflies",
    "sandcastleSummer"
  ])
};
var SEASON_ADD = {
  winter: {
    nature: ["snowPine", "snowDeciduous", "snowCoveredRock", "bareBush", "winterBird", "snowdrift"],
    settlement: [
      "snowman",
      "igloo",
      "sled",
      "firewood",
      "icicle",
      "snowdrift",
      "houseWinter",
      "houseBWinter",
      "barnWinter",
      "churchWinter",
      "christmasTree",
      "winterLantern",
      "frozenFountain"
    ],
    general: ["snowdrift", "snowCoveredRock", "bareBush", "icicle"]
  },
  spring: {
    nature: [
      "cherryBlossom",
      "cherryBlossomSmall",
      "cherryBlossomFull",
      "cherryBlossomBranch",
      "peachBlossom",
      "tulip",
      "tulipField",
      "sprout",
      "crocus",
      "lamb",
      "robinBird"
    ],
    settlement: [
      "cherryBlossom",
      "cherryBlossomFull",
      "tulipField",
      "nest",
      "birdhouse",
      "gardenBed",
      "rainPuddle",
      "cherryPetals",
      "flowerBed",
      "wateringCan",
      "umbrella",
      "butterflyGarden"
    ],
    general: ["sprout", "crocus", "cherryPetals", "rainPuddle", "seedling"]
  },
  summer: {
    nature: ["sunflower", "fireflies", "watermelon"],
    settlement: [
      "parasol",
      "beachTowel",
      "hammock",
      "iceCreamCart",
      "lemonade",
      "sprinkler",
      "swimmingPool"
    ],
    general: ["sunflower", "watermelon"]
  },
  autumn: {
    nature: [
      "autumnMaple",
      "autumnMaple",
      "autumnOak",
      "autumnOak",
      "autumnBirch",
      "autumnGinkgo",
      "fallenLeaves",
      "fallenLeaves",
      "fallenLeaves",
      "leafSwirl",
      "leafSwirl",
      "acorn",
      "pumpkinPatch"
    ],
    settlement: [
      "cornStalk",
      "scarecrowAutumn",
      "harvestBasket",
      "hotDrink",
      "autumnWreath",
      "fallenLeaves",
      "fallenLeaves",
      "hayMaze",
      "appleBasket",
      "rake",
      "autumnMaple"
    ],
    general: ["fallenLeaves", "fallenLeaves", "leafSwirl", "leafSwirl", "acorn", "pumpkinPatch"]
  }
};
function getSeasonalPoolOverrides(week, rotation = 0, level = 50) {
  const { from, to, t } = getTransitionBlend(week, rotation);
  if (from === to) {
    const remove2 = SEASON_REMOVE[from];
    const additions = SEASON_ADD[from];
    const add2 = getLevelAdditions(additions, level);
    return { add: add2, remove: remove2 };
  }
  const remove = /* @__PURE__ */ new Set();
  for (const r of SEASON_REMOVE[from]) remove.add(r);
  for (const r of SEASON_REMOVE[to]) remove.add(r);
  const fromAdd = getLevelAdditions(SEASON_ADD[from], level);
  const toAdd = getLevelAdditions(SEASON_ADD[to], level);
  const fromCount = Math.round(fromAdd.length * (1 - t));
  const toCount = Math.round(toAdd.length * t);
  const add = [...fromAdd.slice(0, fromCount), ...toAdd.slice(0, toCount)];
  return { add, remove };
}
function getLevelAdditions(additions, level) {
  const result = [...additions.general];
  if (level >= 31 && level <= 65) {
    result.push(...additions.nature);
  } else if (level >= 66) {
    result.push(...additions.settlement);
  }
  return result;
}

// src/themes/terrain/palette.ts
function interpolateRGB(anchors, level) {
  const l = clamp(level, 0, 99);
  let lower = anchors[0];
  let upper = anchors[anchors.length - 1];
  for (let i = 0; i < anchors.length - 1; i++) {
    if (l >= anchors[i].level && l <= anchors[i + 1].level) {
      lower = anchors[i];
      upper = anchors[i + 1];
      break;
    }
  }
  if (lower.level === upper.level) return lower.rgb;
  const t = (l - lower.level) / (upper.level - lower.level);
  return [
    Math.round(lerp(lower.rgb[0], upper.rgb[0], t)),
    Math.round(lerp(lower.rgb[1], upper.rgb[1], t)),
    Math.round(lerp(lower.rgb[2], upper.rgb[2], t))
  ];
}
function interpolateHeight(anchors, level) {
  const l = clamp(level, 0, 99);
  let lower = anchors[0];
  let upper = anchors[anchors.length - 1];
  for (let i = 0; i < anchors.length - 1; i++) {
    if (l >= anchors[i].level && l <= anchors[i + 1].level) {
      lower = anchors[i];
      upper = anchors[i + 1];
      break;
    }
  }
  if (lower.level === upper.level) return lower.height;
  const t = (l - lower.level) / (upper.level - lower.level);
  return Math.round(lerp(lower.height, upper.height, t));
}
function darken(rgb, factor) {
  return `rgb(${Math.round(rgb[0] * factor)},${Math.round(rgb[1] * factor)},${Math.round(rgb[2] * factor)})`;
}
function rgbToHex(rgb) {
  return "#" + rgb.map((c) => c.toString(16).padStart(2, "0")).join("");
}
function makeElevation(rgb) {
  return {
    top: rgbToHex(rgb),
    left: darken(rgb, 0.75),
    right: darken(rgb, 0.6)
  };
}
var DARK_COLOR_ANCHORS = [
  { level: 0, rgb: [160, 130, 90] },
  // Desert sand
  { level: 4, rgb: [140, 120, 85] },
  // Dry earth
  { level: 8, rgb: [100, 115, 100] },
  // Scrubland
  { level: 12, rgb: [40, 80, 130] },
  // Shallow water / oasis
  { level: 18, rgb: [30, 70, 120] },
  // Deeper water
  { level: 24, rgb: [80, 130, 95] },
  // Wetland shore
  { level: 30, rgb: [130, 160, 90] },
  // Grassland
  { level: 40, rgb: [90, 145, 60] },
  // Lush grass
  { level: 52, rgb: [55, 120, 42] },
  // Forest
  { level: 65, rgb: [45, 105, 38] },
  // Dense forest
  { level: 75, rgb: [90, 140, 55] },
  // Rich green farmland
  { level: 85, rgb: [80, 125, 50] },
  // Village green
  { level: 93, rgb: [70, 110, 52] },
  // Town with parks
  { level: 99, rgb: [65, 100, 55] }
  // Lush city
];
var DARK_HEIGHT_ANCHORS = [
  { level: 0, height: 0 },
  { level: 8, height: 0 },
  { level: 12, height: 0 },
  // Water: flat
  { level: 18, height: 0 },
  { level: 24, height: 1 },
  { level: 30, height: 3 },
  { level: 40, height: 5 },
  { level: 52, height: 8 },
  { level: 65, height: 11 },
  { level: 75, height: 14 },
  { level: 85, height: 18 },
  { level: 93, height: 21 },
  { level: 99, height: 24 }
];
var LIGHT_COLOR_ANCHORS = [
  { level: 0, rgb: [195, 170, 130] },
  // Desert sand
  { level: 4, rgb: [180, 158, 120] },
  // Dry earth
  { level: 8, rgb: [145, 155, 135] },
  // Scrubland
  { level: 12, rgb: [100, 160, 210] },
  // Shallow water / oasis
  { level: 18, rgb: [85, 148, 200] },
  // Deeper water
  { level: 24, rgb: [120, 168, 140] },
  // Wetland shore
  { level: 30, rgb: [160, 195, 115] },
  // Grassland
  { level: 40, rgb: [115, 175, 80] },
  // Lush grass
  { level: 52, rgb: [75, 150, 58] },
  // Forest
  { level: 65, rgb: [65, 135, 52] },
  // Dense forest
  { level: 75, rgb: [115, 170, 75] },
  // Rich green farmland
  { level: 85, rgb: [100, 155, 68] },
  // Village green
  { level: 93, rgb: [90, 140, 65] },
  // Town with parks
  { level: 99, rgb: [80, 128, 62] }
  // Lush city
];
var LIGHT_HEIGHT_ANCHORS = DARK_HEIGHT_ANCHORS;
var DARK_ASSETS = {
  trunk: "#6b4226",
  pine: "#2a6e1e",
  leaf: "#3d8c2a",
  bush: "#357a22",
  roofA: "#c45435",
  roofB: "#d4924a",
  wall: "#d4c8a0",
  wallShade: "#b0a078",
  church: "#e0d8c0",
  fence: "#9e8a60",
  wheat: "#d4b840",
  sheep: "#e8e8e0",
  sheepHead: "#333",
  cow: "#8b5e3c",
  cowSpot: "#f5f0e0",
  chicken: "#d4a030",
  whale: "#4a7a9e",
  whaleBelly: "#8ab4c8",
  boat: "#8b6840",
  sail: "#e8e0d0",
  fish: "#70b0c8",
  flag: "#cc3333",
  windmill: "#c8b888",
  windBlade: "#d8d0b8",
  well: "#7a6a4a",
  chimney: "#8a6a4a",
  path: "#a09068",
  water: "#3a6a9e",
  waterLight: "#5a90be",
  deer: "#8a6030",
  horse: "#6e4422",
  flower: "#e06080",
  flowerCenter: "#f0d040",
  mushroom: "#e8dcc8",
  mushroomCap: "#c44030",
  rock: "#808080",
  boulder: "#6a6a6a",
  palm: "#4a8828",
  willow: "#558838",
  seagull: "#e0e0e0",
  dock: "#7a6040",
  tent: "#c8b888",
  tentStripe: "#cc4444",
  hut: "#a08860",
  market: "#d8c898",
  marketAwning: "#cc5533",
  inn: "#c8a878",
  innSign: "#d4a040",
  blacksmith: "#555555",
  anvil: "#444444",
  castle: "#a0a0a0",
  castleRoof: "#606080",
  tower: "#909090",
  bridge: "#8a7a5a",
  cart: "#8a6a40",
  barrel: "#7a5a30",
  torch: "#6a5030",
  torchFlame: "#ff9922",
  cobble: "#888878",
  smoke: "rgba(180,180,180,0.4)",
  bird: "#444444",
  scarecrow: "#8a7040",
  scarecrowHat: "#5a4020",
  stump: "#6b4a26",
  riverOverlay: "rgba(35,85,160,0.60)",
  pondOverlay: "rgba(25,75,150,0.65)",
  reeds: "#6a8838",
  fountain: "#909090",
  fountainWater: "#70a8d0",
  canal: "#7a7a6a",
  gardenTree: "#4a9a3a",
  ricePaddy: "#8aaa48",
  ricePaddyWater: "#4a88b0",
  // New 118-type expansion colors
  jellyfish: "#9a70c0",
  coral: "#d06858",
  turtle: "#5a8848",
  buoy: "#cc4444",
  lighthouse: "#d8d0b8",
  crab: "#c06030",
  driftwood: "#8a7050",
  sandcastle: "#d8c890",
  tidePools: "#5a90b0",
  heron: "#a0a8b0",
  shellfish: "#c0a880",
  cattail: "#6a8838",
  frog: "#4a8830",
  lily: "#e088a0",
  rabbit: "#b0a090",
  fox: "#c06a28",
  butterfly: "#d070a0",
  butterflyWing: "#e0a040",
  beehive: "#c0a040",
  wildflower: "#d060d0",
  tallGrass: "#5a9838",
  birchBark: "#e0d8c8",
  haybale: "#c0a848",
  owl: "#8a7050",
  squirrel: "#a06030",
  moss: "#4a7a30",
  fern: "#3a8828",
  deadTree: "#6a5a40",
  log: "#7a5a30",
  berryBush: "#3a7828",
  berry: "#cc3030",
  spiderWeb: "rgba(200,200,200,0.5)",
  silo: "#a0a0a0",
  pig: "#e0a8a0",
  trough: "#7a6a50",
  haystack: "#c8a838",
  orchard: "#4a8828",
  orchardFruit: "#cc4430",
  beeFarm: "#c8b060",
  pumpkin: "#d07020",
  tavern: "#a08860",
  tavernSign: "#8a6830",
  bakery: "#c8a878",
  stable: "#8a7050",
  gardenFence: "#e0d8c0",
  laundry: "#e0d8e8",
  doghouse: "#8a6030",
  shrine: "#a0a0a8",
  wagon: "#8a6840",
  cathedral: "#c0b8a8",
  cathedralWindow: "#4080c0",
  library: "#b0a088",
  clocktower: "#a0a0a0",
  clockFace: "#e8e0c8",
  statue: "#909098",
  parkBench: "#6a5a40",
  warehouse: "#8a8078",
  gatehouse: "#a09888",
  manor: "#c8b898",
  manorGarden: "#4a8838",
  signpost: "#7a6040",
  lantern: "#6a5a40",
  lanternGlow: "#ffc840",
  woodpile: "#7a5a30",
  puddle: "#5a88b8",
  campfire: "#6a5030",
  campfireFlame: "#ff6622",
  // Seasonal: Winter
  snowCap: "#e8eef5",
  snowGround: "#d8e2ee",
  ice: "#a0c0e0",
  icicle: "#b0d4f0",
  frozenWater: "#6090b8",
  igloo: "#dce8f2",
  sledWood: "#8a5a30",
  sledRunner: "#607080",
  scarfRed: "#cc3030",
  snowmanCoal: "#2a2a2a",
  snowmanCarrot: "#e07020",
  winterBirdRed: "#cc3030",
  winterBirdBrown: "#8a6040",
  firewoodLog: "#6a4020",
  bareBranch: "#6a5a4a",
  frostWhite: "#e0e8f0",
  // Seasonal: Spring
  cherryPetalPink: "#f5a0b8",
  cherryPetalWhite: "#f8e0e8",
  cherryTrunk: "#6a4030",
  cherryBranch: "#7a5040",
  tulipRed: "#e04050",
  tulipYellow: "#f0d040",
  tulipPurple: "#9050c0",
  tulipStem: "#5a9a40",
  sproutGreen: "#80d050",
  nestBrown: "#7a5530",
  eggBlue: "#a8d8e8",
  eggWhite: "#f0ece0",
  crocusPurple: "#8040b0",
  crocusYellow: "#e8c830",
  lambWool: "#f0ece5",
  birdhouseWood: "#a07040",
  gardenSoil: "#5a4030",
  // Seasonal: Summer
  parasolRed: "#e04040",
  parasolBlue: "#4080d0",
  parasolYellow: "#e8c820",
  parasolStripe: "#ffffff",
  beachTowelA: "#e05050",
  beachTowelB: "#4090d0",
  sandcastleWall: "#d8c090",
  surfboardBody: "#e0e0e0",
  surfboardStripe: "#e04040",
  iceCreamCart: "#f0e8d0",
  iceCreamUmbrella: "#e04040",
  hammockFabric: "#d09050",
  sunflowerPetal: "#f0c820",
  sunflowerCenter: "#5a3a20",
  watermelonRind: "#40a040",
  watermelonFlesh: "#e04040",
  watermelonSeed: "#2a2a2a",
  lemonadeStand: "#f0d880",
  sprinklerMetal: "#8090a0",
  poolWater: "#60b8e0",
  poolEdge: "#c0c8d0",
  // Seasonal: Autumn
  mapleRed: "#c83020",
  mapleCrimson: "#a02020",
  mapleOrange: "#d07020",
  oakGold: "#c8a030",
  oakBrown: "#8a6030",
  birchYellow: "#d8c040",
  ginkgoYellow: "#d8c830",
  fallenLeafRed: "#c04030",
  fallenLeafOrange: "#d08030",
  fallenLeafGold: "#d0a030",
  fallenLeafBrown: "#8a5a30",
  acornBody: "#8a6030",
  acornCap: "#5a3820",
  cornStalkColor: "#c8a860",
  cornEar: "#d8c060",
  harvestApple: "#c83030",
  harvestGrape: "#6030a0",
  hotDrinkMug: "#c8a060",
  hotDrinkSteam: "#d0d8e0",
  wreathGreen: "#507038",
  wreathBerry: "#c03030",
  // Extended Seasonal: Autumn
  autumnGold: "#d4a84b",
  autumnBronze: "#b07830",
  autumnBurgundy: "#8b2040",
  autumnRust: "#c05530",
  autumnOlive: "#8b8b40",
  // Extended Seasonal: Spring
  blossomPink: "#ffb6c1",
  blossomWhite: "#fff0f5",
  peachPink: "#ffd5cc",
  // Extended Seasonal: Winter
  icicleBlue: "#d0e8f8",
  christmasRed: "#c41e3a",
  christmasGold: "#ffd700",
  christmasGreen: "#228b22",
  // Fruit Trees
  appleRed: "#c41e3a",
  oliveGreen: "#808060",
  oliveFruit: "#4a4a30",
  lemonYellow: "#fff44f",
  orangeFruit: "#ff8c00",
  pearGreen: "#d1e231",
  peachFruit: "#ffcba4",
  // Additional Livestock
  donkey: "#808080",
  goat: "#e8e0d0",
  goatHorn: "#b0a090",
  // Enhanced asset detail colors
  shadow: "#1a1a2e",
  bushDark: "#2d5a3d",
  leafLight: "#6db86d",
  flowerAlt: "#e8a0c0",
  // Epic building colors
  epicGold: "#ffd700",
  epicMarble: "#d8d0c0",
  epicJade: "#2e8b57",
  epicCrystal: "#7fdbff",
  epicMagic: "#9b59b6",
  epicPortal: "#00ced1"
};
var LIGHT_ASSETS = {
  trunk: "#7a5030",
  pine: "#358025",
  leaf: "#4a9e35",
  bush: "#40882a",
  roofA: "#d05a3a",
  roofB: "#daa055",
  wall: "#f0e8d0",
  wallShade: "#d0c498",
  church: "#f0e8d8",
  fence: "#b09a68",
  wheat: "#dac040",
  sheep: "#f5f5f0",
  sheepHead: "#444",
  cow: "#9a6e45",
  cowSpot: "#fff",
  chicken: "#daa835",
  whale: "#4580aa",
  whaleBelly: "#90bcd0",
  boat: "#9a7848",
  sail: "#fff",
  fish: "#60a0b8",
  flag: "#dd3838",
  windmill: "#d8c898",
  windBlade: "#eee",
  well: "#8a7a55",
  chimney: "#9a7a55",
  path: "#b8a078",
  water: "#4578aa",
  waterLight: "#65a0cc",
  deer: "#9a7038",
  horse: "#7e5430",
  flower: "#f07090",
  flowerCenter: "#ffe050",
  mushroom: "#f0e8d8",
  mushroomCap: "#d05040",
  rock: "#909090",
  boulder: "#7a7a7a",
  palm: "#55a030",
  willow: "#609840",
  seagull: "#f0f0f0",
  dock: "#8a7050",
  tent: "#d8c898",
  tentStripe: "#dd5555",
  hut: "#b09870",
  market: "#e8d8a8",
  marketAwning: "#dd6644",
  inn: "#d8b888",
  innSign: "#e4b050",
  blacksmith: "#666666",
  anvil: "#555555",
  castle: "#b0b0b0",
  castleRoof: "#707090",
  tower: "#a0a0a0",
  bridge: "#9a8a6a",
  cart: "#9a7a50",
  barrel: "#8a6a38",
  torch: "#7a6038",
  torchFlame: "#ffaa33",
  cobble: "#989888",
  smoke: "rgba(160,160,160,0.35)",
  bird: "#555555",
  scarecrow: "#9a8050",
  scarecrowHat: "#6a5030",
  stump: "#7a5a30",
  riverOverlay: "rgba(60,130,210,0.55)",
  pondOverlay: "rgba(50,120,200,0.60)",
  reeds: "#7a9848",
  fountain: "#a0a0a0",
  fountainWater: "#80b8e0",
  canal: "#8a8a7a",
  gardenTree: "#55aa45",
  ricePaddy: "#9aba58",
  ricePaddyWater: "#5a98c0",
  // New 118-type expansion colors
  jellyfish: "#b080d8",
  coral: "#e07868",
  turtle: "#6a9858",
  buoy: "#dd5555",
  lighthouse: "#f0e8d8",
  crab: "#d07040",
  driftwood: "#9a8060",
  sandcastle: "#e8d8a0",
  tidePools: "#6aa0c0",
  heron: "#b0b8c0",
  shellfish: "#d0b890",
  cattail: "#7a9848",
  frog: "#5a9838",
  lily: "#f098b0",
  rabbit: "#c0b0a0",
  fox: "#d07a38",
  butterfly: "#e080b0",
  butterflyWing: "#f0b050",
  beehive: "#d0b050",
  wildflower: "#e070e0",
  tallGrass: "#6aa848",
  birchBark: "#f0e8d8",
  haybale: "#d0b858",
  owl: "#9a8060",
  squirrel: "#b07040",
  moss: "#5a8a38",
  fern: "#4a9838",
  deadTree: "#7a6a50",
  log: "#8a6a40",
  berryBush: "#4a8838",
  berry: "#dd4040",
  spiderWeb: "rgba(180,180,180,0.45)",
  silo: "#b0b0b0",
  pig: "#f0b8b0",
  trough: "#8a7a60",
  haystack: "#d8b848",
  orchard: "#55a038",
  orchardFruit: "#dd5540",
  beeFarm: "#d8c070",
  pumpkin: "#e08030",
  tavern: "#b09870",
  tavernSign: "#9a7838",
  bakery: "#d8b888",
  stable: "#9a8060",
  gardenFence: "#f0e8d0",
  laundry: "#f0e8f0",
  doghouse: "#9a7040",
  shrine: "#b0b0b8",
  wagon: "#9a7850",
  cathedral: "#d0c8b8",
  cathedralWindow: "#5090d0",
  library: "#c0b098",
  clocktower: "#b0b0b0",
  clockFace: "#f8f0d8",
  statue: "#a0a0a8",
  parkBench: "#7a6a50",
  warehouse: "#9a9088",
  gatehouse: "#b0a898",
  manor: "#d8c8a8",
  manorGarden: "#55a048",
  signpost: "#8a7050",
  lantern: "#7a6a50",
  lanternGlow: "#ffd850",
  woodpile: "#8a6a40",
  puddle: "#6a98c8",
  campfire: "#7a6038",
  campfireFlame: "#ff7733",
  // Seasonal: Winter
  snowCap: "#f0f4f8",
  snowGround: "#e4ecf4",
  ice: "#b0d0e8",
  icicle: "#c0e0f8",
  frozenWater: "#70a0c8",
  igloo: "#e8f0f8",
  sledWood: "#9a6a38",
  sledRunner: "#708090",
  scarfRed: "#dd4040",
  snowmanCoal: "#333333",
  snowmanCarrot: "#f08030",
  winterBirdRed: "#dd4040",
  winterBirdBrown: "#9a7050",
  firewoodLog: "#7a5030",
  bareBranch: "#7a6a5a",
  frostWhite: "#eef4f8",
  // Seasonal: Spring
  cherryPetalPink: "#f8b0c8",
  cherryPetalWhite: "#fce8f0",
  cherryTrunk: "#7a5040",
  cherryBranch: "#8a6050",
  tulipRed: "#f05060",
  tulipYellow: "#f8e050",
  tulipPurple: "#a060d0",
  tulipStem: "#6aaa50",
  sproutGreen: "#90e060",
  nestBrown: "#8a6540",
  eggBlue: "#b8e8f0",
  eggWhite: "#f8f4e8",
  crocusPurple: "#9050c0",
  crocusYellow: "#f0d838",
  lambWool: "#f8f4ed",
  birdhouseWood: "#b08050",
  gardenSoil: "#6a5040",
  // Seasonal: Summer
  parasolRed: "#f05050",
  parasolBlue: "#5090e0",
  parasolYellow: "#f0d030",
  parasolStripe: "#ffffff",
  beachTowelA: "#f06060",
  beachTowelB: "#50a0e0",
  sandcastleWall: "#e8d0a0",
  surfboardBody: "#f0f0f0",
  surfboardStripe: "#f05050",
  iceCreamCart: "#f8f0e0",
  iceCreamUmbrella: "#f05050",
  hammockFabric: "#e0a060",
  sunflowerPetal: "#f8d030",
  sunflowerCenter: "#6a4a30",
  watermelonRind: "#50b050",
  watermelonFlesh: "#f05050",
  watermelonSeed: "#333333",
  lemonadeStand: "#f8e890",
  sprinklerMetal: "#90a0b0",
  poolWater: "#70c8f0",
  poolEdge: "#d0d8e0",
  // Seasonal: Autumn
  mapleRed: "#d84030",
  mapleCrimson: "#b03030",
  mapleOrange: "#e08030",
  oakGold: "#d8b040",
  oakBrown: "#9a7040",
  birchYellow: "#e8d050",
  ginkgoYellow: "#e8d840",
  fallenLeafRed: "#d05040",
  fallenLeafOrange: "#e09040",
  fallenLeafGold: "#e0b040",
  fallenLeafBrown: "#9a6a40",
  acornBody: "#9a7040",
  acornCap: "#6a4830",
  cornStalkColor: "#d8b870",
  cornEar: "#e8d070",
  harvestApple: "#d84040",
  harvestGrape: "#7040b0",
  hotDrinkMug: "#d8b070",
  hotDrinkSteam: "#e0e8f0",
  wreathGreen: "#608048",
  wreathBerry: "#d04040",
  // Extended Seasonal: Autumn
  autumnGold: "#e0b85c",
  autumnBronze: "#c08840",
  autumnBurgundy: "#9b3050",
  autumnRust: "#d06540",
  autumnOlive: "#9b9b50",
  // Extended Seasonal: Spring
  blossomPink: "#ffc6d1",
  blossomWhite: "#fff8fb",
  peachPink: "#ffe5dc",
  // Extended Seasonal: Winter
  icicleBlue: "#e0f0ff",
  christmasRed: "#d42e4a",
  christmasGold: "#ffe720",
  christmasGreen: "#32a032",
  // Fruit Trees
  appleRed: "#d42e4a",
  oliveGreen: "#909070",
  oliveFruit: "#5a5a40",
  lemonYellow: "#ffff5f",
  orangeFruit: "#ff9c10",
  pearGreen: "#e1f241",
  peachFruit: "#ffdbb4",
  // Additional Livestock
  donkey: "#909090",
  goat: "#f0e8e0",
  goatHorn: "#c0b0a0",
  // Enhanced asset detail colors
  shadow: "#4a4a5e",
  bushDark: "#3d6a4d",
  leafLight: "#8dd88d",
  flowerAlt: "#f8b0d0",
  // Epic building colors
  epicGold: "#ffe740",
  epicMarble: "#f0e8d8",
  epicJade: "#3aad6a",
  epicCrystal: "#90e8ff",
  epicMagic: "#b070d0",
  epicPortal: "#20e8e0"
};
function getTerrainPalette100(mode) {
  const colorAnchors = mode === "dark" ? DARK_COLOR_ANCHORS : LIGHT_COLOR_ANCHORS;
  const heightAnchors = mode === "dark" ? DARK_HEIGHT_ANCHORS : LIGHT_HEIGHT_ANCHORS;
  const getElevation = (level) => {
    const rgb = interpolateRGB(colorAnchors, level);
    return makeElevation(rgb);
  };
  const getHeight = (level) => {
    return interpolateHeight(heightAnchors, level);
  };
  const sampleLevels = [0, 5, 12, 25, 40, 55, 70, 82, 92, 99];
  const elevations = sampleLevels.map((l) => getElevation(l));
  const heights = sampleLevels.map((l) => getHeight(l));
  return {
    getElevation,
    getHeight,
    elevations,
    heights,
    text: mode === "dark" ? { primary: "#e6edf3", secondary: "#8b949e", accent: "#58a6ff" } : { primary: "#1f2328", secondary: "#656d76", accent: "#0969da" },
    bg: { subtle: mode === "dark" ? "#161b22" : "#f6f8fa" },
    cloud: mode === "dark" ? { fill: "rgba(200,210,220,0.12)", stroke: "rgba(200,210,220,0.06)", opacity: 0.8 } : { fill: "rgba(190,205,220,0.35)", stroke: "rgba(160,175,195,0.30)", opacity: 0.85 },
    assets: mode === "dark" ? DARK_ASSETS : LIGHT_ASSETS
  };
}
function tintAssetColors(assets, tint) {
  const result = {};
  for (const [key, value] of Object.entries(assets)) {
    if (typeof value === "string") {
      if (value.startsWith("#") && value.length === 7) {
        result[key] = applyTintToHex(value, tint);
      } else if (value.startsWith("rgb")) {
        result[key] = applyTintToRgb(value, tint);
      } else {
        result[key] = value;
      }
    }
  }
  return result;
}
function getSeasonalPalette100(mode, week, rotation = 0) {
  const base = getTerrainPalette100(mode);
  const tint = getSeasonalTint(week, rotation);
  if (tint.colorShift === 0 && tint.warmth === 0 && tint.snowCoverage === 0 && tint.greenMul === 1 && tint.saturation === 1) {
    return base;
  }
  const colorAnchors = mode === "dark" ? DARK_COLOR_ANCHORS : LIGHT_COLOR_ANCHORS;
  const heightAnchors = mode === "dark" ? DARK_HEIGHT_ANCHORS : LIGHT_HEIGHT_ANCHORS;
  const getElevation = (level) => {
    const rgb = interpolateRGB(colorAnchors, level);
    const tinted = [
      clamp(Math.round(applyTintValues(rgb[0], rgb[1], rgb[2], tint)[0]), 0, 255),
      clamp(Math.round(applyTintValues(rgb[0], rgb[1], rgb[2], tint)[1]), 0, 255),
      clamp(Math.round(applyTintValues(rgb[0], rgb[1], rgb[2], tint)[2]), 0, 255)
    ];
    return makeElevation(tinted);
  };
  const getHeight = (level) => {
    return interpolateHeight(heightAnchors, level);
  };
  const sampleLevels = [0, 5, 12, 25, 40, 55, 70, 82, 92, 99];
  const elevations = sampleLevels.map((l) => getElevation(l));
  const heights = sampleLevels.map((l) => getHeight(l));
  return {
    getElevation,
    getHeight,
    elevations,
    heights,
    text: base.text,
    bg: base.bg,
    cloud: base.cloud,
    assets: tintAssetColors(base.assets, tint)
  };
}
function applyTintValues(r, g, b, tint) {
  const gray = 0.299 * r + 0.587 * g + 0.114 * b;
  let nr = gray + (r - gray) * tint.saturation;
  let ng = gray + (g - gray) * tint.saturation;
  let nb = gray + (b - gray) * tint.saturation;
  ng *= tint.greenMul;
  nr += tint.warmth;
  nb -= tint.warmth;
  if (tint.colorShift > 0) {
    nr = lerp(nr, tint.colorTarget[0], tint.colorShift);
    ng = lerp(ng, tint.colorTarget[1], tint.colorShift);
    nb = lerp(nb, tint.colorTarget[2], tint.colorShift);
  }
  if (tint.snowCoverage > 0) {
    nr = lerp(nr, 240, tint.snowCoverage);
    ng = lerp(ng, 244, tint.snowCoverage);
    nb = lerp(nb, 250, tint.snowCoverage);
  }
  return [
    clamp(Math.round(nr), 0, 255),
    clamp(Math.round(ng), 0, 255),
    clamp(Math.round(nb), 0, 255)
  ];
}

// src/themes/terrain/blocks.ts
var THW = 8;
var THH = 3.5;
function toIsoCells(cells, palette, originX, originY) {
  const isoCells = [];
  let cellIndex = 0;
  const numWeeks = Math.ceil(cells.length / 7);
  for (let week = 0; week < numWeeks; week++) {
    for (let day = 0; day < 7; day++) {
      if (cellIndex >= cells.length) break;
      const cell = cells[cellIndex++];
      const isoX = originX + (week - day) * THW;
      const isoY = originY + (week + day) * THH;
      const height = palette.getHeight(cell.level100);
      const colors = palette.getElevation(cell.level100);
      isoCells.push({
        week,
        day,
        level100: cell.level100,
        height,
        isoX,
        isoY,
        colors
      });
    }
  }
  isoCells.sort((a, b) => {
    const sumA = a.week + a.day;
    const sumB = b.week + b.day;
    if (sumA !== sumB) return sumA - sumB;
    return a.week - b.week;
  });
  return isoCells;
}
function parseColor(color) {
  if (color.startsWith("#")) {
    const hex = color.slice(1);
    return [
      parseInt(hex.slice(0, 2), 16),
      parseInt(hex.slice(2, 4), 16),
      parseInt(hex.slice(4, 6), 16)
    ];
  }
  const m = color.match(/(\d+)/g);
  if (m && m.length >= 3) return [+m[0], +m[1], +m[2]];
  return [128, 128, 128];
}
function toHex(r, g, b) {
  return "#" + [r, g, b].map((c) => Math.round(c).toString(16).padStart(2, "0")).join("");
}
function toRgb(r, g, b) {
  return `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
}
function blendColorTowardWater(color, waterRgb, strength) {
  const [r, g, b] = parseColor(color);
  const nr = r + (waterRgb[0] - r) * strength;
  const ng = g + (waterRgb[1] - g) * strength;
  const nb = b + (waterRgb[2] - b) * strength;
  return color.startsWith("#") ? toHex(nr, ng, nb) : toRgb(nr, ng, nb);
}
function getWaterBlendStrength(level, isRiver) {
  if (isRiver) return 0.4;
  if (level <= 14) return 0.25;
  return 0.45;
}
function blendWithWater(colors, isDark, level, isRiver) {
  const waterRgb = isDark ? [40, 80, 140] : [70, 140, 200];
  const strength = level !== void 0 ? getWaterBlendStrength(level, !!isRiver) : 0.35;
  return {
    top: blendColorTowardWater(colors.top, waterRgb, strength),
    left: blendColorTowardWater(colors.left, waterRgb, strength),
    right: blendColorTowardWater(colors.right, waterRgb, strength)
  };
}
function renderBlock(cell, isWater = false) {
  const { isoX: cx, isoY: cy, height: h, colors } = cell;
  if (h === 0) {
    const topPoints2 = [
      `${cx},${cy - THH}`,
      `${cx + THW},${cy}`,
      `${cx},${cy + THH}`,
      `${cx - THW},${cy}`
    ].join(" ");
    if (isWater) {
      const inset = 1.5;
      const innerPoints = [
        `${cx},${cy - THH + inset}`,
        `${cx + THW - inset * 1.5},${cy}`,
        `${cx},${cy + THH - inset}`,
        `${cx - THW + inset * 1.5},${cy}`
      ].join(" ");
      return `<polygon points="${topPoints2}" fill="${colors.top}" stroke="${colors.left}" stroke-width="0.3"/><polygon points="${innerPoints}" fill="${colors.top}" opacity="0.3" style="filter:brightness(1.3)"/><ellipse cx="${cx + 1}" cy="${cy - 0.5}" rx="1.5" ry="0.6" fill="#fff" opacity="0.15"/>`;
    }
    return `<polygon points="${topPoints2}" fill="${colors.top}" stroke="${colors.left}" stroke-width="0.3"/>`;
  }
  const parts = [];
  const leftPoints = [
    `${cx - THW},${cy}`,
    `${cx},${cy + THH}`,
    `${cx},${cy + THH + h}`,
    `${cx - THW},${cy + h}`
  ].join(" ");
  parts.push(`<polygon points="${leftPoints}" fill="${colors.left}"/>`);
  if (isWater && h > 0) {
    const midY = cy + THH + h * 0.5;
    const leftGradPoints = [
      `${cx - THW},${cy + h * 0.5}`,
      `${cx},${midY}`,
      `${cx},${cy + THH + h}`,
      `${cx - THW},${cy + h}`
    ].join(" ");
    parts.push(`<polygon points="${leftGradPoints}" fill="#1a3a6a" opacity="0.15"/>`);
  }
  const rightPoints = [
    `${cx + THW},${cy}`,
    `${cx},${cy + THH}`,
    `${cx},${cy + THH + h}`,
    `${cx + THW},${cy + h}`
  ].join(" ");
  parts.push(`<polygon points="${rightPoints}" fill="${colors.right}"/>`);
  if (isWater && h > 0) {
    const midY = cy + THH + h * 0.5;
    const rightGradPoints = [
      `${cx + THW},${cy + h * 0.5}`,
      `${cx},${midY}`,
      `${cx},${cy + THH + h}`,
      `${cx + THW},${cy + h}`
    ].join(" ");
    parts.push(`<polygon points="${rightGradPoints}" fill="#1a3a6a" opacity="0.12"/>`);
  }
  const topPoints = [
    `${cx},${cy - THH}`,
    `${cx + THW},${cy}`,
    `${cx},${cy + THH}`,
    `${cx - THW},${cy}`
  ].join(" ");
  if (isWater) {
    const inset = 1.5;
    const innerPoints = [
      `${cx},${cy - THH + inset}`,
      `${cx + THW - inset * 1.5},${cy}`,
      `${cx},${cy + THH - inset}`,
      `${cx - THW + inset * 1.5},${cy}`
    ].join(" ");
    parts.push(
      `<polygon points="${topPoints}" fill="${colors.top}" stroke="${colors.left}" stroke-width="0.3"/>`
    );
    parts.push(
      `<polygon points="${innerPoints}" fill="${colors.top}" opacity="0.3" style="filter:brightness(1.3)"/>`
    );
    parts.push(
      `<ellipse cx="${cx + 1}" cy="${cy - 0.5}" rx="1.5" ry="0.6" fill="#fff" opacity="0.15"/>`
    );
  } else {
    parts.push(
      `<polygon points="${topPoints}" fill="${colors.top}" stroke="${colors.left}" stroke-width="0.3"/>`
    );
  }
  return parts.join("");
}
function getIsoCells(cells, palette, originX, originY) {
  return toIsoCells(cells, palette, originX, originY);
}
function renderSeasonalTerrainBlocks(cells, weekPalettes, originX, originY, seasonRotation, biomeMap) {
  const refPalette = weekPalettes[26] || weekPalettes[0];
  const isoCells = toIsoCells(cells, refPalette, originX, originY);
  const isDark = refPalette.text.primary.startsWith("#e");
  const blocks = isoCells.map((cell) => {
    const weekIdx = Math.min(cell.week, weekPalettes.length - 1);
    const weekPalette = weekPalettes[weekIdx];
    const zone = getSeasonZone(cell.week, seasonRotation);
    const colors = weekPalette.getElevation(cell.level100);
    const height = weekPalette.getHeight(cell.level100);
    const tintedCell = { ...cell, colors, height };
    const biome = biomeMap?.get(`${cell.week},${cell.day}`);
    const isNaturalWater = cell.level100 >= 9 && cell.level100 <= 22;
    const isBiomeWater = biome && (biome.isRiver || biome.isPond);
    if (isBiomeWater || isNaturalWater) {
      const isWinterish = zone === 0 || zone === 7 || zone === 1;
      if (isWinterish && isNaturalWater) {
        const iceColors = {
          top: weekPalette.assets.ice || colors.top,
          left: weekPalette.assets.frozenWater || colors.left,
          right: weekPalette.assets.frozenWater || colors.right
        };
        return renderBlock({ ...tintedCell, colors: iceColors }, false);
      }
      const blended = blendWithWater(colors, isDark, cell.level100, !!biome?.isRiver);
      return renderBlock({ ...tintedCell, colors: blended }, true);
    }
    return renderBlock(tintedCell);
  });
  return `<g class="terrain-blocks">${blocks.join("")}</g>`;
}

// src/themes/terrain/effects.ts
var MAX_WATER = 15;
var MAX_SPARKLE = 10;
var NUM_CLOUDS = 2;
function renderTerrainCSS(isoCells, biomeMap) {
  const blocks = [];
  const hasWater = isoCells.some((c) => c.level100 >= 10 && c.level100 <= 22);
  const hasTown = isoCells.some((c) => c.level100 >= 90);
  if (hasWater) {
    blocks.push(
      `@keyframes water-shimmer { 0% { opacity: 0.7; } 50% { opacity: 1; } 100% { opacity: 0.7; } }`
    );
    const waterCells = isoCells.filter((c) => c.level100 >= 10 && c.level100 <= 22);
    const selected = selectEvenly(waterCells, MAX_WATER);
    for (let i = 0; i < selected.length; i++) {
      const dur = (3 + i % 3 * 0.8).toFixed(1);
      const delay = (i * 0.7 % 4).toFixed(1);
      blocks.push(
        `.water-${i} { animation: water-shimmer ${dur}s ease-in-out ${delay}s infinite; }`
      );
    }
  }
  if (hasTown) {
    blocks.push(
      `@keyframes town-sparkle { 0% { opacity: 1; } 40% { opacity: 0.5; } 100% { opacity: 1; } }`
    );
    const townCells = isoCells.filter((c) => c.level100 >= 90);
    const selected = selectEvenly(townCells, MAX_SPARKLE);
    for (let i = 0; i < selected.length; i++) {
      const dur = (2 + i % 4 * 0.5).toFixed(1);
      const delay = (i * 0.9 % 3.5).toFixed(1);
      blocks.push(
        `.sparkle-${i} { animation: town-sparkle ${dur}s ease-in-out ${delay}s infinite; }`
      );
    }
  }
  if (biomeMap) {
    const riverCells = isoCells.filter((c) => {
      const biome = biomeMap.get(`${c.week},${c.day}`);
      return biome && (biome.isRiver || biome.isPond) && c.level100 > 22;
    });
    const selectedRiver = selectEvenly(riverCells, 8);
    if (selectedRiver.length > 0) {
      if (!hasWater) {
        blocks.push(
          `@keyframes water-shimmer { 0% { opacity: 0.7; } 50% { opacity: 1; } 100% { opacity: 0.7; } }`
        );
      }
      for (let i = 0; i < selectedRiver.length; i++) {
        const dur = (3.5 + i % 3 * 0.6).toFixed(1);
        const delay = (i * 0.8 % 3.5).toFixed(1);
        blocks.push(
          `.river-shimmer-${i} { animation: water-shimmer ${dur}s ease-in-out ${delay}s infinite; }`
        );
      }
    }
  }
  blocks.push(
    `@keyframes flag-wave { 0% { transform: scaleX(1); } 50% { transform: scaleX(0.7); } 100% { transform: scaleX(1); } }`
  );
  blocks.push(
    `@keyframes sway-gentle { 0% { transform: rotate(-2deg); } 50% { transform: rotate(2deg); } 100% { transform: rotate(-2deg); } }`
  );
  blocks.push(
    `.sway-gentle { animation: sway-gentle 3s ease-in-out infinite; transform-origin: bottom center; }`
  );
  blocks.push(
    `@keyframes sway-slow { 0% { transform: rotate(-1deg); } 50% { transform: rotate(1deg); } 100% { transform: rotate(-1deg); } }`
  );
  blocks.push(
    `.sway-slow { animation: sway-slow 4s ease-in-out infinite; transform-origin: bottom center; }`
  );
  return blocks.join("\n");
}
function renderAnimatedOverlays(isoCells, palette) {
  const overlays = [];
  const waterCells = isoCells.filter((c) => c.level100 >= 10 && c.level100 <= 22);
  const selectedWater = selectEvenly(waterCells, MAX_WATER);
  for (let i = 0; i < selectedWater.length; i++) {
    const cell = selectedWater[i];
    const { isoX: cx, isoY: cy } = cell;
    const points = [
      `${cx},${cy - THH + 1}`,
      `${cx + THW - 2},${cy}`,
      `${cx},${cy + THH - 1}`,
      `${cx - THW + 2},${cy}`
    ].join(" ");
    overlays.push(
      `<polygon points="${points}" fill="${palette.text.accent}" opacity="0.15" class="water-${i}"/>`
    );
  }
  const townCells = isoCells.filter((c) => c.level100 >= 90);
  const selectedTown = selectEvenly(townCells, MAX_SPARKLE);
  for (let i = 0; i < selectedTown.length; i++) {
    const cell = selectedTown[i];
    const { isoX: cx, isoY: cy, height: h } = cell;
    overlays.push(
      `<circle cx="${cx}" cy="${cy - h - 1}" r="1" fill="#ffe080" opacity="0.7" class="sparkle-${i}"/>`
    );
  }
  return `<g class="terrain-overlays">${overlays.join("")}</g>`;
}
function renderCelestials(seed, palette, isDark) {
  const rng = seededRandom(seed + 3331);
  const parts = [];
  if (isDark) {
    const numStars = 18 + Math.floor(rng() * 10);
    for (let i = 0; i < numStars; i++) {
      const sx = 30 + rng() * 780;
      const sy = 5 + rng() * 55;
      const sr = 0.3 + rng() * 0.6;
      const opacity = 0.3 + rng() * 0.5;
      parts.push(
        `<circle cx="${sx.toFixed(1)}" cy="${sy.toFixed(1)}" r="${sr.toFixed(1)}" fill="#fff" opacity="${opacity.toFixed(2)}"/>`
      );
    }
    for (let i = 0; i < 3; i++) {
      const bx = 60 + rng() * 720;
      const by = 8 + rng() * 40;
      const len = 1.2 + rng() * 0.8;
      parts.push(
        `<g opacity="${(0.5 + rng() * 0.3).toFixed(2)}"><line x1="${bx - len}" y1="${by}" x2="${bx + len}" y2="${by}" stroke="#fff" stroke-width="0.4"/><line x1="${bx}" y1="${by - len}" x2="${bx}" y2="${by + len}" stroke="#fff" stroke-width="0.4"/></g>`
      );
    }
    const mx = 750 + rng() * 60;
    const my = 18 + rng() * 15;
    const mr = 8;
    parts.push(
      `<g><circle cx="${mx}" cy="${my}" r="${mr}" fill="#e8e4d0" opacity="0.85"/><circle cx="${mx + 3.5}" cy="${my - 1.5}" r="${mr - 0.5}" fill="${palette.bg.subtle}"/><circle cx="${mx}" cy="${my}" r="${mr + 3}" fill="#e8e4d0" opacity="0.04"/></g>`
    );
  } else {
    const sx = 770 + rng() * 50;
    const sy = 20 + rng() * 12;
    const sr = 7;
    parts.push(`<circle cx="${sx}" cy="${sy}" r="${sr + 6}" fill="#ffeebb" opacity="0.1"/>`);
    parts.push(`<circle cx="${sx}" cy="${sy}" r="${sr + 3}" fill="#ffdd88" opacity="0.15"/>`);
    parts.push(`<circle cx="${sx}" cy="${sy}" r="${sr}" fill="#ffe066" opacity="0.9"/>`);
    parts.push(
      `<circle cx="${sx - 1.5}" cy="${sy - 1.5}" r="${sr * 0.45}" fill="#fff8cc" opacity="0.6"/>`
    );
    for (let r = 0; r < 8; r++) {
      const angle = r / 8 * Math.PI * 2;
      const innerR = sr + 2;
      const outerR = sr + 5 + r % 2 * 2;
      const x1 = sx + Math.cos(angle) * innerR;
      const y1 = sy + Math.sin(angle) * innerR;
      const x2 = sx + Math.cos(angle) * outerR;
      const y2 = sy + Math.sin(angle) * outerR;
      parts.push(
        `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="#ffdd66" stroke-width="0.8" opacity="0.5" stroke-linecap="round"/>`
      );
    }
  }
  return `<g class="celestials">${parts.join("")}</g>`;
}
function renderClouds(seed, palette) {
  const rng = seededRandom(seed);
  const clouds = [];
  for (let i = 0; i < NUM_CLOUDS; i++) {
    const baseCx = 250 + rng() * 500;
    const baseCy = 20 + rng() * 60;
    const scale = 0.8 + rng() * 0.5;
    const dur = (35 + rng() * 20).toFixed(0);
    const driftX = 60 + rng() * 50;
    const ellipses = [];
    const f = palette.cloud.fill;
    const s = palette.cloud.stroke;
    const o = palette.cloud.opacity;
    ellipses.push(
      `<ellipse cx="${baseCx}" cy="${baseCy}" rx="${(28 * scale).toFixed(1)}" ry="${(5 * scale).toFixed(1)}" fill="${f}" stroke="${s}" stroke-width="0.4" opacity="${o}"/>`
    );
    ellipses.push(
      `<ellipse cx="${(baseCx - 14 * scale).toFixed(1)}" cy="${(baseCy - 3 * scale).toFixed(1)}" rx="${(12 * scale).toFixed(1)}" ry="${(6 * scale).toFixed(1)}" fill="${f}" stroke="${s}" stroke-width="0.3" opacity="${o}"/>`
    );
    ellipses.push(
      `<ellipse cx="${(baseCx - 2 * scale).toFixed(1)}" cy="${(baseCy - 6 * scale).toFixed(1)}" rx="${(14 * scale).toFixed(1)}" ry="${(8 * scale).toFixed(1)}" fill="${f}" stroke="${s}" stroke-width="0.3" opacity="${o}"/>`
    );
    ellipses.push(
      `<ellipse cx="${(baseCx + 12 * scale).toFixed(1)}" cy="${(baseCy - 3.5 * scale).toFixed(1)}" rx="${(11 * scale).toFixed(1)}" ry="${(5.5 * scale).toFixed(1)}" fill="${f}" stroke="${s}" stroke-width="0.3" opacity="${o}"/>`
    );
    ellipses.push(
      `<ellipse cx="${(baseCx - 4 * scale).toFixed(1)}" cy="${(baseCy - 9 * scale).toFixed(1)}" rx="${(7 * scale).toFixed(1)}" ry="${(4 * scale).toFixed(1)}" fill="${f}" stroke="none" opacity="${(o * 0.7).toFixed(2)}"/>`
    );
    clouds.push(
      `<g>` + ellipses.join("") + `<animateTransform attributeName="transform" type="translate" values="0,0;${driftX.toFixed(0)},0;0,0" dur="${dur}s" repeatCount="indefinite"/></g>`
    );
  }
  return `<g class="terrain-clouds">${clouds.join("")}</g>`;
}
function renderWaterOverlays(isoCells, palette, biomeMap) {
  const overlays = [];
  let shimmerIdx = 0;
  for (const cell of isoCells) {
    const biome = biomeMap.get(`${cell.week},${cell.day}`);
    if (!biome || !biome.isRiver && !biome.isPond) continue;
    const { isoX: cx, isoY: cy } = cell;
    const color = biome.isPond ? palette.assets.pondOverlay : palette.assets.riverOverlay;
    const outerPoints = [
      `${cx},${cy - THH + 0.5}`,
      `${cx + THW - 1},${cy}`,
      `${cx},${cy + THH - 0.5}`,
      `${cx - THW + 1},${cy}`
    ].join(" ");
    const innerInset = 2.2;
    const innerPoints = [
      `${cx},${cy - THH + innerInset}`,
      `${cx + THW - innerInset * 1.2},${cy}`,
      `${cx},${cy + THH - innerInset}`,
      `${cx - THW + innerInset * 1.2},${cy}`
    ].join(" ");
    const shimmerClass = cell.level100 > 22 && shimmerIdx < 8 ? ` class="river-shimmer-${shimmerIdx++}"` : "";
    overlays.push(`<polygon points="${outerPoints}" fill="${color}"${shimmerClass}/>`);
    overlays.push(
      `<polygon points="${innerPoints}" fill="${palette.assets.waterLight}" opacity="0.18"/>`
    );
  }
  return overlays.length > 0 ? `<g class="water-overlays">${overlays.join("")}</g>` : "";
}
function renderWaterRipples(isoCells, palette, biomeMap) {
  const ripples = [];
  const color = palette.assets.waterLight;
  const rng = seededRandom(isoCells.length * 7 + 31);
  for (const cell of isoCells) {
    const biome = biomeMap.get(`${cell.week},${cell.day}`);
    if (!biome || !biome.isRiver && !biome.isPond) continue;
    const { isoX: cx, isoY: cy } = cell;
    const jitterX = (rng() - 0.5) * 2;
    const jitterY = (rng() - 0.5) * 0.8;
    const amp1 = 0.3 + rng() * 0.15;
    ripples.push(
      `<path d="M${cx - THW * 0.55 + jitterX},${cy - THH * 0.05 + jitterY} Q${cx - THW * 0.1},${cy - THH * amp1} ${cx + THW * 0.4},${cy - THH * 0.12}" stroke="${color}" fill="none" stroke-width="0.25" opacity="0.28"/>`
    );
    const amp2 = 0.15 + rng() * 0.2;
    ripples.push(
      `<path d="M${cx - THW * 0.35 + jitterX * 0.5},${cy + THH * 0.15 + jitterY} Q${cx + THW * 0.05},${cy - THH * amp2} ${cx + THW * 0.45},${cy + THH * 0.05}" stroke="${color}" fill="none" stroke-width="0.2" opacity="0.22"/>`
    );
    const amp3 = 0.1 + rng() * 0.12;
    ripples.push(
      `<path d="M${cx - THW * 0.2 + jitterX * 0.3},${cy + THH * 0.35 + jitterY} Q${cx + THW * 0.15},${cy + THH * amp3} ${cx + THW * 0.35},${cy + THH * 0.28}" stroke="${color}" fill="none" stroke-width="0.2" opacity="0.18"/>`
    );
  }
  return ripples.length > 0 ? `<g class="water-ripples">${ripples.join("")}</g>` : "";
}
function renderSnowParticles(isoCells, seed, seasonRotation = 0) {
  const rng = seededRandom(seed + 9991);
  const particles = [];
  const maxParticles = 40;
  let count = 0;
  const winterCells = isoCells.filter((c) => {
    const zone = getSeasonZone(c.week, seasonRotation);
    return zone === 0 || zone === 1 || zone === 7;
  });
  if (winterCells.length === 0) return "";
  const selected = selectEvenly(winterCells, maxParticles);
  for (const cell of selected) {
    if (count >= maxParticles) break;
    const zone = getSeasonZone(cell.week, seasonRotation);
    const density = zone === 0 ? 0.8 : 0.4;
    if (rng() > density) continue;
    const px = cell.isoX + (rng() - 0.5) * 10;
    const py = cell.isoY - cell.height - 5 - rng() * 20;
    const r = 0.3 + rng() * 0.4;
    const opacity = 0.3 + rng() * 0.4;
    particles.push(
      `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="${r.toFixed(1)}" fill="#fff" opacity="${opacity.toFixed(2)}"/>`
    );
    count++;
  }
  return particles.length > 0 ? `<g class="snow-particles">${particles.join("")}</g>` : "";
}
function renderFallingPetals(isoCells, seed, palette, seasonRotation = 0) {
  const rng = seededRandom(seed + 7771);
  const petals = [];
  const maxPetals = 30;
  let count = 0;
  const petalColor = palette.assets.cherryPetalPink || "#f5a0b8";
  const springCells = isoCells.filter((c) => {
    const zone = getSeasonZone(c.week, seasonRotation);
    return zone === 2 || zone === 1 || zone === 3;
  });
  if (springCells.length === 0) return "";
  const selected = selectEvenly(springCells, maxPetals);
  for (const cell of selected) {
    if (count >= maxPetals) break;
    const zone = getSeasonZone(cell.week, seasonRotation);
    const density = zone === 2 ? 0.7 : 0.35;
    if (rng() > density) continue;
    const px = cell.isoX + (rng() - 0.5) * 8;
    const py = cell.isoY - cell.height - 3 - rng() * 15;
    const rx = 0.3 + rng() * 0.2;
    const ry = 0.12 + rng() * 0.08;
    const rotation = Math.floor(rng() * 180);
    const opacity = 0.35 + rng() * 0.3;
    petals.push(
      `<ellipse cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" rx="${rx.toFixed(1)}" ry="${ry.toFixed(2)}" fill="${petalColor}" opacity="${opacity.toFixed(2)}" transform="rotate(${rotation},${px.toFixed(1)},${py.toFixed(1)})"/>`
    );
    count++;
  }
  return petals.length > 0 ? `<g class="falling-petals">${petals.join("")}</g>` : "";
}
function renderFallingLeaves(isoCells, seed, palette, seasonRotation = 0) {
  const rng = seededRandom(seed + 5551);
  const leaves = [];
  const maxLeaves = 30;
  let count = 0;
  const leafColors = [
    palette.assets.fallenLeafRed || "#c04030",
    palette.assets.fallenLeafOrange || "#d08030",
    palette.assets.fallenLeafGold || "#d0a030",
    palette.assets.mapleRed || "#c83020",
    palette.assets.oakGold || "#c8a030"
  ];
  const autumnCells = isoCells.filter((c) => {
    const zone = getSeasonZone(c.week, seasonRotation);
    return zone === 6 || zone === 5 || zone === 7;
  });
  if (autumnCells.length === 0) return "";
  const selected = selectEvenly(autumnCells, maxLeaves);
  for (const cell of selected) {
    if (count >= maxLeaves) break;
    const zone = getSeasonZone(cell.week, seasonRotation);
    const density = zone === 6 ? 0.7 : 0.35;
    if (rng() > density) continue;
    const px = cell.isoX + (rng() - 0.5) * 8;
    const py = cell.isoY - cell.height - 2 - rng() * 12;
    const rx = 0.4 + rng() * 0.3;
    const ry = 0.15 + rng() * 0.1;
    const rotation = Math.floor(rng() * 360);
    const opacity = 0.4 + rng() * 0.3;
    const color = leafColors[Math.floor(rng() * leafColors.length)];
    leaves.push(
      `<ellipse cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" rx="${rx.toFixed(1)}" ry="${ry.toFixed(2)}" fill="${color}" opacity="${opacity.toFixed(2)}" transform="rotate(${rotation},${px.toFixed(1)},${py.toFixed(1)})"/>`
    );
    count++;
  }
  return leaves.length > 0 ? `<g class="falling-leaves">${leaves.join("")}</g>` : "";
}
function selectEvenly(items, max) {
  if (items.length <= max) return items;
  const step = items.length / max;
  const result = [];
  for (let i = 0; i < max; i++) {
    result.push(items[Math.floor(i * step)]);
  }
  return result;
}

// src/themes/terrain/assets.ts
function getEffectiveLevel(level100, density) {
  if (level100 === 0) return 0;
  return clamp(level100 + (density - 5) * 5, 1, 99);
}
function getLevelPool100(level) {
  if (level <= 4)
    return { types: ["rock", "boulder", "stump", "deadTree", "puddle"], chance: 0.08 };
  if (level <= 8)
    return { types: ["rock", "boulder", "bush", "stump", "deadTree", "signpost"], chance: 0.13 };
  if (level <= 14)
    return {
      types: [
        "whale",
        "fish",
        "fishSchool",
        "boat",
        "seagull",
        "dock",
        "waves",
        "kelp",
        "coral",
        "jellyfish",
        "turtle",
        "crab",
        "buoy"
      ],
      chance: 0.21
    };
  if (level <= 22)
    return {
      types: [
        "fish",
        "fishSchool",
        "boat",
        "seagull",
        "waves",
        "dock",
        "kelp",
        "coral",
        "turtle",
        "sailboat",
        "lighthouse",
        "crab",
        "buoy"
      ],
      chance: 0.24
    };
  if (level <= 27)
    return {
      types: [
        "rock",
        "boulder",
        "flower",
        "bush",
        "bird",
        "driftwood",
        "sandcastle",
        "tidePools",
        "heron",
        "shellfish",
        "cattail",
        "frog",
        "lily"
      ],
      chance: 0.21
    };
  if (level <= 30)
    return {
      types: [
        "bush",
        "flower",
        "rock",
        "fence",
        "driftwood",
        "tidePools",
        "heron",
        "cattail",
        "frog",
        "lily",
        "puddle"
      ],
      chance: 0.24
    };
  if (level <= 36)
    return {
      types: [
        "bush",
        "flower",
        "mushroom",
        "deer",
        "bird",
        "rabbit",
        "fox",
        "butterfly",
        "wildflowerPatch",
        "tallGrass",
        "signpost",
        "puddle"
      ],
      chance: 0.29
    };
  if (level <= 42)
    return {
      types: [
        "pine",
        "deciduous",
        "bush",
        "mushroom",
        "flower",
        "deer",
        "rabbit",
        "fox",
        "butterfly",
        "beehive",
        "birch",
        "haybale",
        "tallGrass",
        "lantern"
      ],
      chance: 0.33
    };
  if (level <= 52)
    return {
      types: [
        "pine",
        "pine",
        "deciduous",
        "willow",
        "bird",
        "bush",
        "owl",
        "squirrel",
        "moss",
        "fern",
        "berryBush",
        "log",
        "woodpile"
      ],
      chance: 0.39
    };
  if (level <= 58)
    return {
      types: [
        "pine",
        "deciduous",
        "willow",
        "palm",
        "bird",
        "pine",
        "stump",
        "owl",
        "moss",
        "fern",
        "deadTree",
        "log",
        "spider",
        "campfire"
      ],
      chance: 0.42
    };
  if (level <= 65)
    return {
      types: [
        "deciduous",
        "willow",
        "pine",
        "palm",
        "bird",
        "mushroom",
        "squirrel",
        "berryBush",
        "fern",
        "moss",
        "log",
        "woodpile"
      ],
      chance: 0.36
    };
  if (level <= 70)
    return {
      types: [
        "wheat",
        "fence",
        "sheep",
        "goat",
        "chicken",
        "bush",
        "ricePaddy",
        "pumpkin",
        "orchard",
        "appleTree",
        "pearTree",
        "trough",
        "haystack",
        "signpost"
      ],
      chance: 0.39
    };
  if (level <= 75)
    return {
      types: [
        "wheat",
        "fence",
        "scarecrow",
        "cow",
        "cow",
        "sheep",
        "goat",
        "chicken",
        "horse",
        "donkey",
        "ricePaddy",
        "silo",
        "pigpen",
        "trough",
        "orchard",
        "appleTree",
        "lemonTree",
        "orangeTree",
        "beeFarm",
        "pumpkin"
      ],
      chance: 0.46
    };
  if (level <= 78)
    return {
      types: [
        "barn",
        "sheep",
        "goat",
        "cow",
        "cow",
        "horse",
        "horse",
        "donkey",
        "wheat",
        "fence",
        "chicken",
        "cart",
        "ricePaddy",
        "silo",
        "pigpen",
        "haystack",
        "orchard",
        "appleTree",
        "oliveTree",
        "lemonTree",
        "peachTree",
        "beeFarm",
        "haybale"
      ],
      chance: 0.5
    };
  if (level <= 84)
    return {
      types: [
        "tent",
        "hut",
        "house",
        "well",
        "fence",
        "sheep",
        "barrel",
        "tavern",
        "bakery",
        "stable",
        "garden",
        "doghouse",
        "shrine",
        "lantern",
        "woodpile"
      ],
      chance: 0.5
    };
  if (level <= 90)
    return {
      types: [
        "house",
        "houseB",
        "church",
        "windmill",
        "well",
        "barrel",
        "torch",
        "tavern",
        "bakery",
        "stable",
        "garden",
        "laundry",
        "wagon",
        "shrine",
        "lantern",
        "signpost"
      ],
      chance: 0.55
    };
  if (level <= 95)
    return {
      types: [
        "house",
        "houseB",
        "market",
        "inn",
        "windmill",
        "flag",
        "cobblePath",
        "torch",
        "gardenTree",
        "flower",
        "bush",
        "cathedral",
        "library",
        "clocktower",
        "statue",
        "park",
        "warehouse",
        "lantern"
      ],
      chance: 0.62
    };
  return {
    types: [
      "castle",
      "tower",
      "church",
      "market",
      "inn",
      "blacksmith",
      "bridge",
      "flag",
      "cobblePath",
      "gardenTree",
      "flower",
      "fountain",
      "cathedral",
      "library",
      "clocktower",
      "statue",
      "park",
      "gatehouse",
      "manor",
      "warehouse",
      "lantern"
    ],
    chance: 0.72
  };
}
function blendWithBiome(pool, ctx, level) {
  const types = [...pool.types];
  let chance = pool.chance;
  if (ctx.isRiver) {
    if (level >= 91) types.push("bridge", "canal");
    else if (level >= 66) types.push("watermill", "canal", "reeds", "heron");
    else if (level >= 31) types.push("reeds", "reeds", "willow", "frog", "heron", "cattail");
    else types.push("reeds", "pondLily", "lily", "frog");
    chance = Math.max(chance, 0.35);
  } else if (ctx.isPond) {
    if (level >= 79) types.push("fountain", "pondLily", "reeds", "lily");
    else types.push("pondLily", "pondLily", "reeds", "lily", "frog", "cattail");
    chance = Math.max(chance, 0.3);
  } else if (ctx.nearWater) {
    if (level >= 79) types.push("fountain", "gardenTree");
    else types.push("willow", "reeds", "bush", "driftwood", "heron");
    chance += 0.05;
  }
  if (ctx.forestDensity > 0.3) {
    const treesToAdd = ctx.forestDensity > 0.6 ? 3 : 1;
    for (let i = 0; i < treesToAdd; i++) {
      if (level >= 91) types.push("gardenTree", "flower");
      else if (level >= 79) types.push("gardenTree");
      else if (level >= 43) types.push("pine", "deciduous", "owl", "squirrel", "moss", "fern");
      else types.push("pine", "birch");
    }
    chance += ctx.forestDensity * 0.08;
  }
  if (level >= 96) {
    types.push("gardenTree", "fountain", "park");
  } else if (level >= 91) {
    types.push("gardenTree", "lantern");
  }
  return { types, chance: Math.min(chance, 0.65) };
}
function computeRichness(cell, cellMap) {
  let neighborSum = 0;
  let count = 0;
  for (let dw = -1; dw <= 1; dw++) {
    for (let dd = -1; dd <= 1; dd++) {
      if (dw === 0 && dd === 0) continue;
      const key = `${cell.week + dw},${cell.day + dd}`;
      const n = cellMap.get(key);
      if (n) {
        neighborSum += n.level100;
        count++;
      }
    }
  }
  if (count === 0) return 0;
  return neighborSum / (count * 99);
}
var SMIL_ANIMATED_TYPES = /* @__PURE__ */ new Set([
  "seagull",
  "waves",
  "bird",
  "windmill",
  "smoke",
  "fountain",
  "watermill",
  "jellyfish",
  "turtle",
  "butterfly",
  "bakery",
  "clocktower",
  "campfire"
]);
var CSS_ANIMATED_TYPES = /* @__PURE__ */ new Set(["cattail", "tallGrass", "laundry"]);
function selectAssets(isoCells, seed, variantSeed, biomeMap, seasonRotation, density = 5, excludeCells) {
  const rng = seededRandom(seed);
  const variantRng = seededRandom(variantSeed ?? seed);
  const assets = [];
  const smokeBudget = { remaining: 8 };
  const animBudget = { smil: 18, css: 15 };
  const cellMap = /* @__PURE__ */ new Map();
  for (const cell of isoCells) {
    cellMap.set(`${cell.week},${cell.day}`, cell);
  }
  for (const cell of isoCells) {
    if (excludeCells?.has(`${cell.week},${cell.day}`)) continue;
    const effectiveLevel = getEffectiveLevel(cell.level100, density);
    let pool = getLevelPool100(effectiveLevel);
    const biomeCtx = biomeMap?.get(`${cell.week},${cell.day}`);
    if (biomeCtx) pool = blendWithBiome(pool, biomeCtx, effectiveLevel);
    if (seasonRotation != null) {
      const { add, remove } = getSeasonalPoolOverrides(cell.week, seasonRotation, effectiveLevel);
      pool = {
        types: [...pool.types.filter((t) => !remove.has(t)), ...add],
        chance: pool.chance
      };
    }
    const richness = computeRichness(cell, cellMap);
    const finalChance = pool.chance + richness * 0.2;
    if (pool.types.length === 0) continue;
    if (rng() < finalChance) {
      let type = pool.types[Math.floor(rng() * pool.types.length)];
      if (type === "smoke" && smokeBudget.remaining <= 0) {
        type = "barrel";
      } else if (type === "smoke") {
        smokeBudget.remaining--;
      }
      const ox = (rng() - 0.5) * 3;
      const oy = (rng() - 0.5) * 1.5;
      let variant = Math.floor(variantRng() * 3);
      if (SMIL_ANIMATED_TYPES.has(type)) {
        if (animBudget.smil > 0) animBudget.smil--;
        else type = "barrel";
      }
      if (CSS_ANIMATED_TYPES.has(type)) {
        if (animBudget.css > 0) animBudget.css--;
        else variant = 0;
      }
      assets.push({ cell, type, cx: cell.isoX, cy: cell.isoY, ox, oy, variant });
      if (richness > 0.4 && cell.level100 >= 25 && rng() < 0.4) {
        let type2 = pool.types[Math.floor(rng() * pool.types.length)];
        if (type2 === "smoke" && smokeBudget.remaining <= 0) type2 = "torch";
        else if (type2 === "smoke") smokeBudget.remaining--;
        if (SMIL_ANIMATED_TYPES.has(type2)) {
          if (animBudget.smil > 0) animBudget.smil--;
          else type2 = "barrel";
        }
        let variant2 = Math.floor(variantRng() * 3);
        if (CSS_ANIMATED_TYPES.has(type2)) {
          if (animBudget.css > 0) animBudget.css--;
          else variant2 = 0;
        }
        assets.push({
          cell,
          type: type2,
          cx: cell.isoX,
          cy: cell.isoY,
          ox: (rng() - 0.5) * 4,
          oy: (rng() - 0.5) * 2,
          variant: variant2
        });
      }
    }
  }
  return assets;
}
function svgWhale(x, y, c, v) {
  if (v === 1) {
    return `<g transform="translate(${x},${y})"><ellipse cx="0" cy="-0.5" rx="3" ry="1.5" fill="${c.whale}" transform="rotate(-15)"/><ellipse cx="0" cy="0" rx="2" ry="0.8" fill="${c.whaleBelly}" opacity="0.5"/><path d="M2.5,-1.5 Q4,-3 5,-3.5 M2.5,-1.5 Q4,-2 5,-1" stroke="${c.whale}" fill="none" stroke-width="0.8"/><ellipse cx="5" cy="-3.5" rx="1" ry="0.4" fill="${c.whale}"/><ellipse cx="5" cy="-1" rx="1" ry="0.4" fill="${c.whale}"/></g>`;
  }
  if (v === 2) {
    return `<g transform="translate(${x},${y})"><ellipse cx="0" cy="-0.8" rx="2.2" ry="1.3" fill="${c.whale}"/><ellipse cx="0" cy="-0.3" rx="1.5" ry="0.6" fill="${c.whaleBelly}" opacity="0.5"/><path d="M2,-0.8 Q3,-0.8 3.5,-1.8 M2,-0.8 Q3,-0.8 3.5,0.2" stroke="${c.whale}" fill="none" stroke-width="0.7"/><ellipse cx="3.5" cy="-1.8" rx="0.8" ry="0.3" fill="${c.whale}"/><ellipse cx="3.5" cy="0.2" rx="0.8" ry="0.3" fill="${c.whale}"/><circle cx="-1.2" cy="-1" r="0.3" fill="#fff"/><circle cx="-1.2" cy="-1" r="0.15" fill="#222"/></g>`;
  }
  return `<g transform="translate(${x},${y})"><ellipse cx="0" cy="-1.2" rx="3.5" ry="2" fill="${c.whale}"/><ellipse cx="0" cy="-0.5" rx="2.5" ry="1" fill="${c.whaleBelly}" opacity="0.5"/><path d="M3,-1.2 Q4.5,-1.2 5,-2.5 M3,-1.2 Q4.5,-1.2 5,0" stroke="${c.whale}" fill="none" stroke-width="1"/><ellipse cx="5" cy="-2.5" rx="1.2" ry="0.4" fill="${c.whale}"/><ellipse cx="5" cy="0" rx="1.2" ry="0.4" fill="${c.whale}"/><circle cx="-2" cy="-1.5" r="0.4" fill="#fff"/><circle cx="-2" cy="-1.5" r="0.2" fill="#222"/><line x1="-0.5" y1="-3.2" x2="-1.2" y2="-4.5" stroke="${c.waterLight}" stroke-width="0.3" opacity="0.6"/><line x1="-0.5" y1="-3.2" x2="-0.5" y2="-4.8" stroke="${c.waterLight}" stroke-width="0.3" opacity="0.6"/><line x1="-0.5" y1="-3.2" x2="0.2" y2="-4.5" stroke="${c.waterLight}" stroke-width="0.3" opacity="0.6"/></g>`;
}
function svgFish(x, y, c, v) {
  if (v === 1) {
    return `<g transform="translate(${x},${y})"><ellipse cx="-1" cy="-0.5" rx="1.3" ry="0.5" fill="${c.fish}"/><polygon points="0.3,-0.5 1,-1.3 1,0.3" fill="${c.fish}"/><ellipse cx="1" cy="-1.5" rx="1.1" ry="0.4" fill="${c.fish}" opacity="0.8"/><polygon points="2.1,-1.5 2.6,-2.1 2.6,-0.9" fill="${c.fish}" opacity="0.8"/></g>`;
  }
  if (v === 2) {
    return `<g transform="translate(${x},${y})"><ellipse cx="0" cy="-1" rx="2.2" ry="0.9" fill="${c.fish}"/><polygon points="2.2,-1 3.2,-2.2 3.2,0.2" fill="${c.fish}"/><line x1="-0.5" y1="-0.3" x2="-0.5" y2="-1.7" stroke="${c.whaleBelly}" stroke-width="0.3" opacity="0.4"/><line x1="0.5" y1="-0.3" x2="0.5" y2="-1.7" stroke="${c.whaleBelly}" stroke-width="0.3" opacity="0.4"/><circle cx="-1.3" cy="-1.1" r="0.3" fill="#fff"/></g>`;
  }
  return `<g transform="translate(${x},${y})"><ellipse cx="0" cy="-0.8" rx="1.8" ry="0.7" fill="${c.fish}"/><polygon points="1.8,-0.8 2.8,-2 2.8,0.4" fill="${c.fish}"/><circle cx="-1" cy="-0.9" r="0.25" fill="#fff"/></g>`;
}
function svgFishSchool(x, y, c, v) {
  return `<g transform="translate(${x},${y})"><ellipse cx="-1" cy="-0.5" rx="1" ry="0.4" fill="${c.fish}" opacity="0.8"/><ellipse cx="1" cy="-1.2" rx="0.8" ry="0.35" fill="${c.fish}" opacity="0.7"/><ellipse cx="0.5" cy="0" rx="0.9" ry="0.4" fill="${c.fish}" opacity="0.6"/></g>`;
}
function svgBoat(x, y, c, v) {
  if (v === 1) {
    return `<g transform="translate(${x},${y})"><polygon points="-3,0 -2,-1.5 3,-1.5 3.5,0" fill="${c.boat}"/><line x1="0" y1="-1.5" x2="0" y2="-6" stroke="${c.trunk}" stroke-width="0.4"/><polygon points="0,-5.5 0,-2 2.5,-2.5" fill="${c.sail}" opacity="0.9"/><polygon points="0,-5 0,-2.5 -2,-3" fill="${c.sail}" opacity="0.7"/></g>`;
  }
  if (v === 2) {
    return `<g transform="translate(${x},${y})"><polygon points="-2.5,0 -1.5,-1 2.5,-1 3,0" fill="${c.boat}"/><line x1="2" y1="-1" x2="3.5" y2="-3" stroke="${c.trunk}" stroke-width="0.3"/><line x1="3.5" y1="-3" x2="4" y2="-1.5" stroke="${c.waterLight}" stroke-width="0.2" opacity="0.6"/></g>`;
  }
  return `<g transform="translate(${x},${y})"><polygon points="-3,0 -2,-1.5 3,-1.5 3.5,0" fill="${c.boat}"/><line x1="0" y1="-1.5" x2="0" y2="-6" stroke="${c.trunk}" stroke-width="0.4"/><polygon points="0,-5.5 0,-2 2.5,-2.5" fill="${c.sail}" opacity="0.9"/></g>`;
}
function svgSeagull(x, y, c, v) {
  if (v === 1) {
    return `<g transform="translate(${x},${y})"><ellipse cx="0" cy="-1" rx="1.2" ry="0.7" fill="${c.seagull}"/><circle cx="-0.8" cy="-1.5" r="0.4" fill="${c.seagull}"/><polygon points="-1.2,-1.4 -1.7,-1.3 -1.2,-1.2" fill="${c.wheat}"/></g>`;
  }
  if (v === 2) {
    return `<g transform="translate(${x},${y})"><g><path d="M-1.5,-3 Q-0.5,-4.5 0.5,-3" stroke="${c.seagull}" fill="none" stroke-width="0.5"/><path d="M1,-4.5 Q2,-5.5 3,-4.5" stroke="${c.seagull}" fill="none" stroke-width="0.4" opacity="0.7"/><animateMotion path="M0,0 C2,-1 3,0 2,1 C1,2 -1,1 -2,0 C-3,-1 -1,-2 0,0" dur="10s" repeatCount="indefinite"/></g></g>`;
  }
  return `<g transform="translate(${x},${y})"><g><path d="M-2,-3 Q-1,-4.5 0,-3 Q1,-4.5 2,-3" stroke="${c.seagull}" fill="none" stroke-width="0.6"/><circle cx="0" cy="-3" r="0.4" fill="${c.seagull}"/><animateMotion path="M0,0 C2,-1 3,0 2,1 C1,2 -1,1 -2,0 C-3,-1 -1,-2 0,0" dur="10s" repeatCount="indefinite"/></g></g>`;
}
function svgDock(x, y, c, v) {
  return `<g transform="translate(${x},${y})"><rect x="-3" y="-0.5" width="6" height="1" fill="${c.dock}" rx="0.2"/><line x1="-2" y1="0.5" x2="-2" y2="1.5" stroke="${c.dock}" stroke-width="0.5"/><line x1="2" y1="0.5" x2="2" y2="1.5" stroke="${c.dock}" stroke-width="0.5"/></g>`;
}
function svgWaves(x, y, c, v) {
  return `<g transform="translate(${x},${y})"><path d="M-3,-0.5 Q-1.5,-1.5 0,-0.5 Q1.5,0.5 3,-0.5" stroke="${c.waterLight}" fill="none" stroke-width="0.4" opacity="0.5"><animate attributeName="d" values="M-3,-0.5 Q-1.5,-1.5 0,-0.5 Q1.5,0.5 3,-0.5;M-3,-0.3 Q-1.5,-1.2 0,-0.8 Q1.5,0.2 3,-0.3;M-3,-0.5 Q-1.5,-1.5 0,-0.5 Q1.5,0.5 3,-0.5" dur="4s" repeatCount="indefinite"/></path></g>`;
}
function svgRock(x, y, c, v) {
  if (v === 1) {
    return `<g transform="translate(${x},${y})"><ellipse cx="0" cy="-1" rx="2" ry="1.3" fill="${c.rock}"/><ellipse cx="-0.4" cy="-1.4" rx="1" ry="0.5" fill="${c.boulder}" opacity="0.6"/><ellipse cx="-0.6" cy="-1.2" rx="0.3" ry="0.15" fill="${c.snowCap}" opacity="0.3"/></g>`;
  }
  if (v === 2) {
    return `<g transform="translate(${x},${y})"><ellipse cx="0" cy="-0.2" rx="2.5" ry="0.8" fill="${c.shadow}" opacity="0.2"/><ellipse cx="0" cy="-0.5" rx="2.4" ry="0.7" fill="${c.rock}"/><ellipse cx="0.4" cy="-1.2" rx="1.6" ry="0.5" fill="${c.boulder}"/><ellipse cx="0.2" cy="-1.8" rx="0.8" ry="0.3" fill="${c.rock}"/><ellipse cx="-0.3" cy="-1.5" rx="0.2" ry="0.1" fill="${c.snowCap}" opacity="0.25"/></g>`;
  }
  return `<g transform="translate(${x},${y})"><polygon points="-1.5,0 -1.2,-1.8 -0.2,-2.5 0.8,-2.2 1.5,-1 1.2,0" fill="${c.rock}"/><polygon points="-0.8,-0.5 -0.5,-1.6 0.3,-1.8 0.8,-1 0.5,-0.3" fill="${c.boulder}" opacity="0.5"/><line x1="-0.5" y1="-1.2" x2="0.3" y2="-1.5" stroke="${c.shadow}" stroke-width="0.15" opacity="0.3"/></g>`;
}
function svgBoulder(x, y, c, v) {
  return `<g transform="translate(${x},${y})"><ellipse cx="0" cy="-1.5" rx="2.5" ry="1.8" fill="${c.boulder}"/><ellipse cx="-0.5" cy="-2" rx="1.5" ry="1" fill="${c.rock}" opacity="0.5"/></g>`;
}
function svgFlower(x, y, c, v) {
  if (v === 1) {
    return `<g transform="translate(${x},${y})"><line x1="0" y1="0" x2="0" y2="-2.5" stroke="${c.pine}" stroke-width="0.3"/><circle cx="0" cy="-3" r="1" fill="${c.flowerCenter}"/><circle cx="0" cy="-3" r="0.4" fill="${c.flower}"/></g>`;
  }
  if (v === 2) {
    return `<g transform="translate(${x},${y})"><line x1="-0.8" y1="0" x2="-0.8" y2="-2" stroke="${c.pine}" stroke-width="0.25"/><line x1="0.8" y1="0" x2="0.8" y2="-2.2" stroke="${c.pine}" stroke-width="0.25"/><circle cx="-0.8" cy="-2.5" r="0.7" fill="${c.wildflower}"/><circle cx="0.8" cy="-2.7" r="0.7" fill="${c.wildflower}"/><circle cx="0" cy="-2.3" r="0.5" fill="${c.wildflower}" opacity="0.8"/></g>`;
  }
  return `<g transform="translate(${x},${y})"><line x1="0" y1="0" x2="0" y2="-2.5" stroke="${c.pine}" stroke-width="0.3"/><circle cx="0" cy="-3" r="1" fill="${c.flower}"/><circle cx="0" cy="-3" r="0.4" fill="${c.flowerCenter}"/></g>`;
}
function svgBush(x, y, c, v) {
  if (v === 1) {
    return `<g transform="translate(${x},${y})"><ellipse cx="0" cy="-0.6" rx="3.2" ry="1.2" fill="${c.bushDark}"/><ellipse cx="-0.8" cy="-1" rx="1.8" ry="0.9" fill="${c.bush}"/><ellipse cx="0.9" cy="-0.9" rx="1.6" ry="0.8" fill="${c.bush}"/><ellipse cx="0" cy="-1.2" rx="1.2" ry="0.6" fill="${c.leafLight}"/></g>`;
  }
  if (v === 2) {
    return `<g transform="translate(${x},${y})"><ellipse cx="0" cy="-1" rx="2.3" ry="1.6" fill="${c.bushDark}"/><ellipse cx="-0.5" cy="-1.5" rx="1.5" ry="1.1" fill="${c.bush}"/><ellipse cx="0.6" cy="-1.3" rx="1.3" ry="1" fill="${c.bush}"/><ellipse cx="0" cy="-1.8" rx="0.9" ry="0.6" fill="${c.leafLight}"/><circle cx="-0.9" cy="-2.1" r="0.35" fill="${c.flower}"/><circle cx="0.4" cy="-2.4" r="0.3" fill="${c.flowerAlt}"/><circle cx="0.9" cy="-1.8" r="0.28" fill="${c.flower}"/><circle cx="-0.3" cy="-2.6" r="0.25" fill="${c.flowerAlt}"/></g>`;
  }
  return `<g transform="translate(${x},${y})"><ellipse cx="0" cy="-1" rx="2.2" ry="1.6" fill="${c.bushDark}"/><ellipse cx="-0.4" cy="-1.5" rx="1.4" ry="1" fill="${c.bush}"/><ellipse cx="0.5" cy="-1.3" rx="1.2" ry="0.9" fill="${c.bush}"/><ellipse cx="0" cy="-1.8" rx="0.8" ry="0.5" fill="${c.leafLight}"/></g>`;
}
function svgPine(x, y, c, v) {
  if (v === 1) {
    return `<g transform="translate(${x},${y})"><ellipse cx="0" cy="-0.2" rx="1" ry="0.3" fill="${c.shadow}" opacity="0.15"/><rect x="-0.4" y="-1.8" width="0.8" height="1.8" fill="${c.trunk}"/><polygon points="0,-5.5 -3.2,-1.5 3.2,-1.5" fill="${c.bushDark}"/><polygon points="0,-5.5 -2.8,-2 2.8,-2" fill="${c.pine}"/><polygon points="0,-7 -2.4,-3.5 2.4,-3.5" fill="${c.bushDark}" opacity="0.9"/><polygon points="0,-7 -2,-4 2,-4" fill="${c.pine}"/><polygon points="0,-8 -1.2,-5.5 1.2,-5.5" fill="${c.leafLight}" opacity="0.8"/></g>`;
  }
  if (v === 2) {
    return `<g transform="translate(${x},${y})"><ellipse cx="0.5" cy="-0.2" rx="1" ry="0.3" fill="${c.shadow}" opacity="0.15"/><path d="M0,0 Q0.4,-1.5 0.8,-3" stroke="${c.trunk}" fill="none" stroke-width="0.7"/><polygon points="1,-8.5 -1.8,-3 3.8,-3" fill="${c.bushDark}"/><polygon points="1,-8.5 -1.4,-3.5 3.4,-3.5" fill="${c.pine}"/><polygon points="1.2,-10 -0.8,-6 3.2,-6" fill="${c.bushDark}" opacity="0.9"/><polygon points="1.2,-10 -0.4,-6.5 2.8,-6.5" fill="${c.pine}"/><polygon points="1.2,-10.8 0,-7.5 2.4,-7.5" fill="${c.leafLight}" opacity="0.7"/></g>`;
  }
  return `<g transform="translate(${x},${y})"><ellipse cx="0" cy="-0.2" rx="0.8" ry="0.25" fill="${c.shadow}" opacity="0.15"/><rect x="-0.35" y="-2.5" width="0.7" height="2.5" fill="${c.trunk}"/><polygon points="0,-8.5 -2.8,-2 2.8,-2" fill="${c.bushDark}"/><polygon points="0,-8.5 -2.4,-2.5 2.4,-2.5" fill="${c.pine}"/><polygon points="0,-10.5 -2,-5.5 2,-5.5" fill="${c.bushDark}" opacity="0.9"/><polygon points="0,-10.5 -1.6,-6 1.6,-6" fill="${c.pine}"/><polygon points="0,-11.5 -0.9,-8 0.9,-8" fill="${c.leafLight}" opacity="0.7"/></g>`;
}
function svgDeciduous(x, y, c, v) {
  if (v === 1) {
    return `<g transform="translate(${x},${y})"><ellipse cx="0" cy="-0.2" rx="0.8" ry="0.25" fill="${c.shadow}" opacity="0.15"/><rect x="-0.35" y="-4.5" width="0.7" height="4.5" fill="${c.trunk}"/><line x1="-0.3" y1="-3.5" x2="-1" y2="-4.5" stroke="${c.trunk}" stroke-width="0.3"/><line x1="0.3" y1="-4" x2="0.8" y2="-5" stroke="${c.trunk}" stroke-width="0.25"/><ellipse cx="0" cy="-7.5" rx="2.3" ry="3.8" fill="${c.bushDark}"/><ellipse cx="-0.3" cy="-7" rx="1.8" ry="3" fill="${c.leaf}"/><ellipse cx="0.5" cy="-7.8" rx="1.4" ry="2.5" fill="${c.bush}" opacity="0.8"/><ellipse cx="-0.2" cy="-8.5" rx="1" ry="1.5" fill="${c.leafLight}" opacity="0.6"/></g>`;
  }
  if (v === 2) {
    return `<g transform="translate(${x},${y})"><ellipse cx="0" cy="-0.2" rx="1.5" ry="0.4" fill="${c.shadow}" opacity="0.15"/><rect x="-0.4" y="-3" width="0.8" height="3" fill="${c.trunk}"/><line x1="0" y1="-2.5" x2="-2" y2="-4" stroke="${c.trunk}" stroke-width="0.45"/><line x1="0" y1="-2.5" x2="2" y2="-4" stroke="${c.trunk}" stroke-width="0.45"/><circle cx="-2" cy="-5.5" r="2.3" fill="${c.bushDark}"/><circle cx="-2" cy="-5.5" r="2" fill="${c.leaf}"/><circle cx="-2.5" cy="-6" r="1.2" fill="${c.leafLight}" opacity="0.6"/><circle cx="2" cy="-5.5" r="2.3" fill="${c.bushDark}"/><circle cx="2" cy="-5.5" r="2" fill="${c.leaf}"/><circle cx="1.5" cy="-6" r="1.2" fill="${c.leafLight}" opacity="0.6"/><circle cx="0" cy="-6" r="2" fill="${c.bush}" opacity="0.8"/></g>`;
  }
  return `<g transform="translate(${x},${y})"><ellipse cx="0" cy="-0.2" rx="1" ry="0.3" fill="${c.shadow}" opacity="0.15"/><rect x="-0.35" y="-3.5" width="0.7" height="3.5" fill="${c.trunk}"/><line x1="-0.2" y1="-3" x2="-1.2" y2="-4" stroke="${c.trunk}" stroke-width="0.3"/><line x1="0.2" y1="-2.8" x2="1" y2="-3.8" stroke="${c.trunk}" stroke-width="0.25"/><circle cx="0" cy="-6" r="3.2" fill="${c.bushDark}"/><circle cx="0" cy="-6" r="2.9" fill="${c.leaf}"/><circle cx="-1" cy="-5.5" r="2" fill="${c.bush}" opacity="0.75"/><circle cx="0.8" cy="-6.5" r="1.5" fill="${c.leafLight}" opacity="0.6"/></g>`;
}
function svgMushroom(x, y, c, v) {
  if (v === 1) {
    return `<g transform="translate(${x},${y})"><rect x="-1.2" y="-1.5" width="0.6" height="1.5" fill="${c.mushroom}"/><ellipse cx="-0.9" cy="-1.7" rx="1" ry="0.7" fill="${c.trunk}"/><rect x="0.5" y="-1.8" width="0.5" height="1.8" fill="${c.mushroom}"/><ellipse cx="0.75" cy="-2" rx="0.8" ry="0.6" fill="${c.trunk}"/></g>`;
  }
  if (v === 2) {
    return `<g transform="translate(${x},${y})"><rect x="-0.3" y="-3" width="0.6" height="3" fill="${c.mushroom}"/><ellipse cx="0" cy="-3.2" rx="1" ry="0.6" fill="${c.mushroomCap}"/></g>`;
  }
  return `<g transform="translate(${x},${y})"><rect x="-0.4" y="-2" width="0.8" height="2" fill="${c.mushroom}"/><ellipse cx="0" cy="-2.2" rx="1.5" ry="1" fill="${c.mushroomCap}"/><circle cx="-0.5" cy="-2.5" r="0.3" fill="${c.mushroom}" opacity="0.7"/></g>`;
}
function svgStump(x, y, c, v) {
  if (v === 1) {
    return `<g transform="translate(${x},${y})"><ellipse cx="0" cy="-1.5" rx="1.5" ry="0.8" fill="${c.stump}"/><rect x="-1.5" y="-1.5" width="3" height="1.5" fill="${c.trunk}"/><ellipse cx="0" cy="-1.5" rx="1.5" ry="0.6" fill="${c.stump}" opacity="0.7"/><circle cx="1.2" cy="-1.2" r="0.4" fill="${c.mushroom}"/><circle cx="1.5" cy="-0.8" r="0.3" fill="${c.mushroom}" opacity="0.8"/></g>`;
  }
  if (v === 2) {
    return `<g transform="translate(${x},${y})"><ellipse cx="0" cy="-1.5" rx="1.5" ry="0.8" fill="${c.stump}"/><rect x="-1.5" y="-1.5" width="3" height="1.5" fill="${c.trunk}"/><ellipse cx="0" cy="-1.5" rx="1.5" ry="0.6" fill="${c.moss}" opacity="0.6"/><ellipse cx="-0.5" cy="-1" rx="0.8" ry="0.3" fill="${c.moss}" opacity="0.4"/></g>`;
  }
  return `<g transform="translate(${x},${y})"><ellipse cx="0" cy="-1.5" rx="1.5" ry="0.8" fill="${c.stump}"/><rect x="-1.5" y="-1.5" width="3" height="1.5" fill="${c.trunk}"/><ellipse cx="0" cy="-1.5" rx="1.5" ry="0.6" fill="${c.stump}" opacity="0.7"/></g>`;
}
function svgDeer(x, y, c, v) {
  if (v === 1) {
    return `<g transform="translate(${x},${y})"><ellipse cx="0" cy="-2" rx="2.2" ry="1.2" fill="${c.deer}"/><circle cx="-2.2" cy="-1.8" r="0.6" fill="${c.deer}"/><line x1="-2.5" y1="-2.4" x2="-2.8" y2="-3.2" stroke="${c.trunk}" stroke-width="0.25"/><line x1="-1.9" y1="-2.4" x2="-1.5" y2="-3.2" stroke="${c.trunk}" stroke-width="0.25"/><line x1="-1" y1="-0.8" x2="-1" y2="0" stroke="${c.deer}" stroke-width="0.4"/><line x1="1" y1="-0.8" x2="1" y2="0" stroke="${c.deer}" stroke-width="0.4"/></g>`;
  }
  if (v === 2) {
    return `<g transform="translate(${x},${y})"><ellipse cx="0" cy="-2" rx="2.2" ry="1.2" fill="${c.deer}"/><circle cx="-2" cy="-3" r="0.7" fill="${c.deer}"/><line x1="-2.3" y1="-3.7" x2="-3" y2="-4.8" stroke="${c.trunk}" stroke-width="0.3"/><line x1="-1.7" y1="-3.7" x2="-1" y2="-4.8" stroke="${c.trunk}" stroke-width="0.3"/><line x1="-1.2" y1="-0.8" x2="-1.8" y2="0.3" stroke="${c.deer}" stroke-width="0.4"/><line x1="0.8" y1="-0.8" x2="1.5" y2="0.3" stroke="${c.deer}" stroke-width="0.4"/></g>`;
  }
  return `<g transform="translate(${x},${y})"><ellipse cx="0" cy="-2" rx="2.2" ry="1.2" fill="${c.deer}"/><circle cx="-2" cy="-3" r="0.7" fill="${c.deer}"/><line x1="-2.3" y1="-3.7" x2="-3" y2="-5" stroke="${c.trunk}" stroke-width="0.3"/><line x1="-3" y1="-5" x2="-3.5" y2="-5.3" stroke="${c.trunk}" stroke-width="0.25"/><line x1="-1.7" y1="-3.7" x2="-1" y2="-5" stroke="${c.trunk}" stroke-width="0.3"/><line x1="-1" y1="-5" x2="-0.5" y2="-5.3" stroke="${c.trunk}" stroke-width="0.25"/><line x1="-1" y1="-0.8" x2="-1" y2="0" stroke="${c.deer}" stroke-width="0.4"/><line x1="1" y1="-0.8" x2="1" y2="0" stroke="${c.deer}" stroke-width="0.4"/></g>`;
}
function svgWillow(x, y, c, v) {
  if (v === 1) {
    return `<g transform="translate(${x},${y})"><line x1="0" y1="0" x2="0" y2="-3" stroke="${c.trunk}" stroke-width="0.9"/><circle cx="0" cy="-4" r="2.5" fill="${c.willow}"/><path d="M-2.5,-3 Q-4,-1 -4,0" stroke="${c.willow}" fill="none" stroke-width="0.6" opacity="0.7"/><path d="M2.5,-3 Q4,-1 4,0" stroke="${c.willow}" fill="none" stroke-width="0.6" opacity="0.7"/></g>`;
  }
  if (v === 2) {
    return `<g transform="translate(${x},${y})"><path d="M0,0 Q-1,-2.5 0.5,-5" stroke="${c.trunk}" fill="none" stroke-width="1"/><circle cx="0.5" cy="-6" r="1.8" fill="${c.willow}"/><path d="M-1,-5 Q-2.5,-3 -3,-1" stroke="${c.willow}" fill="none" stroke-width="0.5" opacity="0.7"/><path d="M2,-5 Q2.5,-3 2,-1" stroke="${c.willow}" fill="none" stroke-width="0.5" opacity="0.7"/></g>`;
  }
  return `<g transform="translate(${x},${y})"><line x1="0" y1="0" x2="0" y2="-5" stroke="${c.trunk}" stroke-width="0.8"/><circle cx="0" cy="-6" r="2" fill="${c.willow}"/><path d="M-2,-5 Q-3,-3 -3,-1" stroke="${c.willow}" fill="none" stroke-width="0.6" opacity="0.7"/><path d="M2,-5 Q3,-3 3,-1" stroke="${c.willow}" fill="none" stroke-width="0.6" opacity="0.7"/><path d="M-1,-5.5 Q-2,-3.5 -2.5,-2" stroke="${c.willow}" fill="none" stroke-width="0.4" opacity="0.5"/></g>`;
}
function svgPalm(x, y, c, v) {
  if (v === 1) {
    return `<g transform="translate(${x},${y})"><path d="M0,0 Q-2,-4 -1,-8" stroke="${c.trunk}" fill="none" stroke-width="0.7"/><path d="M-1,-8 Q2,-9 3,-7" stroke="${c.palm}" fill="none" stroke-width="0.8"/><path d="M-1,-8 Q-3,-9 -4,-7" stroke="${c.palm}" fill="none" stroke-width="0.8"/><path d="M-1,-8 Q1,-10 2,-9" stroke="${c.palm}" fill="none" stroke-width="0.6"/></g>`;
  }
  if (v === 2) {
    return `<g transform="translate(${x},${y})"><path d="M-1.5,0 Q-2,-3 -1,-6" stroke="${c.trunk}" fill="none" stroke-width="0.6"/><path d="M-1,-6 Q1,-7 2,-5.5" stroke="${c.palm}" fill="none" stroke-width="0.7"/><path d="M-1,-6 Q-3,-7 -3.5,-5.5" stroke="${c.palm}" fill="none" stroke-width="0.7"/><path d="M1.5,0 Q1,-3 2,-7" stroke="${c.trunk}" fill="none" stroke-width="0.6"/><path d="M2,-7 Q4,-8 4.5,-6.5" stroke="${c.palm}" fill="none" stroke-width="0.7"/><path d="M2,-7 Q0,-8 -0.5,-6.5" stroke="${c.palm}" fill="none" stroke-width="0.7"/></g>`;
  }
  return `<g transform="translate(${x},${y})"><path d="M0,0 Q-0.5,-4 0.5,-8" stroke="${c.trunk}" fill="none" stroke-width="0.7"/><path d="M0.5,-8 Q3,-9 4,-7" stroke="${c.palm}" fill="none" stroke-width="0.8"/><path d="M0.5,-8 Q-2,-9 -3,-7" stroke="${c.palm}" fill="none" stroke-width="0.8"/><path d="M0.5,-8 Q2,-10 3,-9" stroke="${c.palm}" fill="none" stroke-width="0.6"/><path d="M0.5,-8 Q-1,-10 -2,-9" stroke="${c.palm}" fill="none" stroke-width="0.6"/></g>`;
}
function svgBird(x, y, c, v) {
  if (v === 1) {
    return `<g transform="translate(${x},${y})"><circle cx="0" cy="-4" r="0.6" fill="${c.bird}"/><ellipse cx="0" cy="-3.5" rx="0.5" ry="0.8" fill="${c.bird}"/><polygon points="-0.6,-4 -1,-3.9 -0.6,-3.8" fill="${c.wheat}"/></g>`;
  }
  if (v === 2) {
    return `<g transform="translate(${x},${y})"><g><path d="M-1.5,-4 Q0,-5.5 1.5,-4" stroke="${c.bird}" fill="none" stroke-width="0.5"/><path d="M0,-5.5 Q1.5,-7 3,-5.5" stroke="${c.bird}" fill="none" stroke-width="0.4" opacity="0.7"/><animateTransform attributeName="transform" type="translate" values="0,0;4,-1;0,0" dur="12s" repeatCount="indefinite"/></g></g>`;
  }
  return `<g transform="translate(${x},${y})"><g><path d="M-1.5,-4 Q0,-5.5 1.5,-4" stroke="${c.bird}" fill="none" stroke-width="0.5"/><animateTransform attributeName="transform" type="translate" values="0,0;4,-1;0,0" dur="12s" repeatCount="indefinite"/></g></g>`;
}
function svgWheat(x, y, c, v) {
  if (v === 1) {
    return `<g transform="translate(${x},${y})"><line x1="-1.5" y1="0" x2="-1.5" y2="-4" stroke="${c.wheat}" stroke-width="0.35"/><line x1="0" y1="0" x2="0" y2="-4.5" stroke="${c.wheat}" stroke-width="0.35"/><line x1="1.5" y1="0" x2="1.5" y2="-3.8" stroke="${c.wheat}" stroke-width="0.35"/><line x1="-0.7" y1="0" x2="-0.7" y2="-4.2" stroke="${c.wheat}" stroke-width="0.25" opacity="0.7"/><ellipse cx="-1.5" cy="-4.3" rx="0.4" ry="0.7" fill="${c.wheat}"/><ellipse cx="0" cy="-4.8" rx="0.4" ry="0.7" fill="${c.wheat}"/><ellipse cx="1.5" cy="-4.1" rx="0.4" ry="0.7" fill="${c.wheat}"/></g>`;
  }
  if (v === 2) {
    return `<g transform="translate(${x},${y})"><line x1="-2" y1="0" x2="-2" y2="-1.2" stroke="${c.wheat}" stroke-width="0.3" opacity="0.6"/><line x1="-0.5" y1="0" x2="-0.5" y2="-1" stroke="${c.wheat}" stroke-width="0.3" opacity="0.6"/><line x1="1" y1="0" x2="1" y2="-1.3" stroke="${c.wheat}" stroke-width="0.3" opacity="0.6"/><line x1="2.5" y1="0" x2="2.5" y2="-0.8" stroke="${c.wheat}" stroke-width="0.3" opacity="0.5"/></g>`;
  }
  return `<g transform="translate(${x},${y})"><line x1="-1.5" y1="0" x2="-1.5" y2="-4" stroke="${c.wheat}" stroke-width="0.3"/><line x1="0" y1="0" x2="0" y2="-4.5" stroke="${c.wheat}" stroke-width="0.3"/><line x1="1.5" y1="0" x2="1.5" y2="-3.8" stroke="${c.wheat}" stroke-width="0.3"/><circle cx="-1.5" cy="-4.2" r="0.5" fill="${c.wheat}"/><circle cx="0" cy="-4.8" r="0.5" fill="${c.wheat}"/><circle cx="1.5" cy="-4" r="0.5" fill="${c.wheat}"/></g>`;
}
function svgFence(x, y, c, v) {
  const postCap = (px) => `<polygon points="${px - 0.3},-3 ${px},-3.5 ${px + 0.3},-3" fill="${c.fence}"/>`;
  if (v === 1) {
    return `<g transform="translate(${x},${y})"><line x1="-3" y1="-1.5" x2="0" y2="-1.5" stroke="${c.fence}" stroke-width="0.5"/><line x1="-3" y1="-2.3" x2="0" y2="-2.3" stroke="${c.fence}" stroke-width="0.4"/><rect x="-3.2" y="-3" width="0.5" height="3" fill="${c.fence}"/><rect x="-0.25" y="-3" width="0.5" height="3" fill="${c.fence}"/>` + postCap(-3) + postCap(0) + `<line x1="0" y1="-1.5" x2="3" y2="-1.5" stroke="${c.fence}" stroke-width="0.5"/><line x1="0" y1="-2.3" x2="3" y2="-2.3" stroke="${c.fence}" stroke-width="0.4"/><rect x="2.75" y="-3" width="0.5" height="3" fill="${c.fence}"/>` + postCap(3) + `</g>`;
  }
  if (v === 2) {
    return `<g transform="translate(${x},${y})"><line x1="-3" y1="-1.5" x2="-0.7" y2="-1.5" stroke="${c.fence}" stroke-width="0.5"/><line x1="0.7" y1="-1.5" x2="3" y2="-1.5" stroke="${c.fence}" stroke-width="0.5"/><line x1="-3" y1="-2.3" x2="-0.7" y2="-2.3" stroke="${c.fence}" stroke-width="0.4"/><line x1="0.7" y1="-2.3" x2="3" y2="-2.3" stroke="${c.fence}" stroke-width="0.4"/><rect x="-3.2" y="-3" width="0.5" height="3" fill="${c.fence}"/><rect x="-0.85" y="-3.5" width="0.4" height="3.5" fill="${c.fence}"/><rect x="0.55" y="-3.5" width="0.4" height="3.5" fill="${c.fence}"/><rect x="2.75" y="-3" width="0.5" height="3" fill="${c.fence}"/>` + postCap(-3) + `<circle cx="-0.65" cy="-3.7" r="0.25" fill="${c.fence}"/><circle cx="0.75" cy="-3.7" r="0.25" fill="${c.fence}"/>` + postCap(3) + `</g>`;
  }
  return `<g transform="translate(${x},${y})"><line x1="-3" y1="-1.5" x2="3" y2="-1.5" stroke="${c.fence}" stroke-width="0.5"/><line x1="-3" y1="-2.3" x2="3" y2="-2.3" stroke="${c.fence}" stroke-width="0.4"/><rect x="-3.2" y="-3" width="0.5" height="3" fill="${c.fence}"/><rect x="-0.25" y="-3" width="0.5" height="3" fill="${c.fence}"/><rect x="2.75" y="-3" width="0.5" height="3" fill="${c.fence}"/>` + postCap(-3) + postCap(0) + postCap(3) + `</g>`;
}
function svgScarecrow(x, y, c, v) {
  if (v === 1) {
    return `<g transform="translate(${x},${y})"><line x1="0" y1="0" x2="0" y2="-6" stroke="${c.scarecrow}" stroke-width="0.5"/><line x1="-2.5" y1="-4" x2="2.5" y2="-4" stroke="${c.scarecrow}" stroke-width="0.4"/><circle cx="0" cy="-7" r="1" fill="${c.scarecrowHat}"/><rect x="-1.5" y="-8.2" width="3" height="0.8" fill="${c.scarecrowHat}" rx="0.2"/><path d="M2,-4.5 Q2.5,-5.5 3,-4.5" stroke="${c.bird}" fill="${c.bird}" stroke-width="0.3"/></g>`;
  }
  if (v === 2) {
    return `<g transform="translate(${x},${y})"><line x1="0" y1="0" x2="0.3" y2="-5.5" stroke="${c.scarecrow}" stroke-width="0.5"/><line x1="-2" y1="-3.5" x2="2.5" y2="-4.2" stroke="${c.scarecrow}" stroke-width="0.4"/><circle cx="0.3" cy="-6.5" r="0.9" fill="${c.scarecrowHat}"/><rect x="-1" y="-7.6" width="2.8" height="0.7" fill="${c.scarecrowHat}" rx="0.2" transform="rotate(-8 0.3 -7)"/><path d="M-2,-3.5 L-2.5,-2.5" stroke="${c.scarecrow}" stroke-width="0.3" opacity="0.5"/></g>`;
  }
  return `<g transform="translate(${x},${y})"><line x1="0" y1="0" x2="0" y2="-6" stroke="${c.scarecrow}" stroke-width="0.5"/><line x1="-2.5" y1="-4" x2="2.5" y2="-4" stroke="${c.scarecrow}" stroke-width="0.4"/><circle cx="0" cy="-7" r="1" fill="${c.scarecrowHat}"/><rect x="-1.5" y="-8.2" width="3" height="0.8" fill="${c.scarecrowHat}" rx="0.2"/></g>`;
}
function svgBarn(x, y, c, v) {
  if (v === 1) {
    return `<g transform="translate(${x},${y})"><polygon points="-4,0 0,2 4,0 4,-4.5 0,-2.5 -4,-4.5" fill="${c.roofA}" opacity="0.9"/><polygon points="-4,0 0,2 0,-2.5 -4,-4.5" fill="${c.wallShade}"/><polygon points="0,-7.5 -4.5,-4 0,-2.2 4.5,-4" fill="${c.roofA}"/><rect x="-0.5" y="-1.5" width="1" height="1.5" fill="${c.trunk}" opacity="0.5"/></g>`;
  }
  if (v === 2) {
    return `<g transform="translate(${x},${y})"><rect x="-2" y="-2.5" width="4" height="2.5" fill="${c.wallShade}"/><polygon points="-2.5,-2.5 0,-4 2.5,-2.5" fill="${c.roofB}"/></g>`;
  }
  return `<g transform="translate(${x},${y})"><polygon points="-3,0 0,1.5 3,0 3,-3.5 0,-2 -3,-3.5" fill="${c.roofA}" opacity="0.8"/><polygon points="-3,0 0,1.5 0,-2 -3,-3.5" fill="${c.wallShade}"/><polygon points="0,-6 -3.5,-3.2 0,-1.8 3.5,-3.2" fill="${c.roofA}"/></g>`;
}
function svgSheep(x, y, c, v) {
  if (v === 1) {
    return `<g transform="translate(${x},${y})"><ellipse cx="0" cy="-0.2" rx="2" ry="0.5" fill="${c.shadow}" opacity="0.15"/><ellipse cx="0" cy="-2" rx="2.2" ry="1.4" fill="${c.sheep}"/><circle cx="-1.3" cy="-2.3" r="1" fill="${c.sheep}"/><circle cx="1.3" cy="-2.3" r="1" fill="${c.sheep}"/><circle cx="0" cy="-2.8" r="0.9" fill="${c.sheep}"/><ellipse cx="-1.8" cy="-1.2" rx="0.7" ry="0.5" fill="${c.sheepHead}"/><ellipse cx="-1.3" cy="-1.8" rx="0.25" ry="0.4" fill="${c.sheepHead}"/><rect x="-1.1" y="-0.8" width="0.5" height="1" fill="${c.sheepHead}"/><rect x="0.6" y="-0.8" width="0.5" height="1" fill="${c.sheepHead}"/></g>`;
  }
  if (v === 2) {
    return `<g transform="translate(${x},${y})"><ellipse cx="0" cy="-1" rx="2.5" ry="1" fill="${c.sheep}"/><circle cx="-1.5" cy="-1.3" r="0.8" fill="${c.sheep}"/><circle cx="1.2" cy="-1.2" r="0.7" fill="${c.sheep}"/><circle cx="-2.2" cy="-1.5" r="0.6" fill="${c.sheepHead}"/><circle cx="-2.4" cy="-1.6" r="0.1" fill="#222"/></g>`;
  }
  return `<g transform="translate(${x},${y})"><ellipse cx="0" cy="-0.2" rx="1.8" ry="0.4" fill="${c.shadow}" opacity="0.15"/><ellipse cx="0" cy="-2.2" rx="2" ry="1.3" fill="${c.sheep}"/><circle cx="-1.2" cy="-2.5" r="0.9" fill="${c.sheep}"/><circle cx="1" cy="-2.4" r="0.85" fill="${c.sheep}"/><circle cx="0" cy="-3" r="0.8" fill="${c.sheep}"/><ellipse cx="-2" cy="-2.8" rx="0.7" ry="0.55" fill="${c.sheepHead}"/><circle cx="-2.1" cy="-2.9" r="0.12" fill="#222"/><ellipse cx="-1.5" cy="-3.3" rx="0.2" ry="0.35" fill="${c.sheepHead}" transform="rotate(-15 -1.5 -3.3)"/><rect x="-1.2" y="-1" width="0.45" height="1.2" fill="${c.sheepHead}"/><rect x="-0.4" y="-1" width="0.45" height="1.2" fill="${c.sheepHead}"/><rect x="0.4" y="-1" width="0.45" height="1.2" fill="${c.sheepHead}"/><rect x="1" y="-1" width="0.45" height="1.2" fill="${c.sheepHead}"/></g>`;
}
function svgCow(x, y, c, v) {
  if (v === 1) {
    return `<g transform="translate(${x},${y})"><ellipse cx="0" cy="-0.2" rx="2.5" ry="0.5" fill="${c.shadow}" opacity="0.15"/><ellipse cx="0" cy="-2.2" rx="2.8" ry="1.6" fill="${c.cow}"/><ellipse cx="-0.5" cy="-2.5" rx="0.9" ry="0.7" fill="${c.cowSpot}"/><ellipse cx="1" cy="-1.8" rx="0.7" ry="0.5" fill="${c.cowSpot}"/><ellipse cx="2.5" cy="-1.5" rx="0.9" ry="0.7" fill="${c.cow}"/><ellipse cx="3" cy="-1.3" rx="0.5" ry="0.4" fill="${c.cowSpot}" opacity="0.6"/><line x1="2.2" y1="-2.1" x2="1.8" y2="-2.8" stroke="${c.fence}" stroke-width="0.3"/><line x1="2.8" y1="-2.1" x2="3.2" y2="-2.7" stroke="${c.fence}" stroke-width="0.3"/><circle cx="2.8" cy="-1.6" r="0.12" fill="#222"/><rect x="-1.5" y="-0.8" width="0.5" height="1" fill="${c.cow}"/><rect x="-0.5" y="-0.8" width="0.5" height="1" fill="${c.cow}"/><rect x="0.5" y="-0.8" width="0.5" height="1" fill="${c.cow}"/><rect x="1.3" y="-0.8" width="0.5" height="1" fill="${c.cow}"/><path d="M-2.8,-2.5 Q-3.5,-2 -3.2,-1" stroke="${c.cowSpot}" fill="none" stroke-width="0.25"/></g>`;
  }
  if (v === 2) {
    return `<g transform="translate(${x},${y})"><ellipse cx="0" cy="-0.2" rx="2.5" ry="0.5" fill="${c.shadow}" opacity="0.15"/><ellipse cx="0" cy="-2.2" rx="2.8" ry="1.6" fill="${c.cow}"/><ellipse cx="0.3" cy="-2.3" rx="1.2" ry="0.9" fill="${c.cowSpot}"/><ellipse cx="-2.5" cy="-2.8" rx="0.9" ry="0.7" fill="${c.cow}"/><ellipse cx="-3.2" cy="-2.6" rx="0.5" ry="0.4" fill="${c.cowSpot}" opacity="0.5"/><line x1="-2.8" y1="-3.4" x2="-3.2" y2="-4" stroke="${c.fence}" stroke-width="0.3"/><line x1="-2.2" y1="-3.4" x2="-1.8" y2="-4" stroke="${c.fence}" stroke-width="0.3"/><circle cx="-2.3" cy="-3" r="0.12" fill="#222"/><rect x="-1.3" y="-0.8" width="0.5" height="1" fill="${c.cow}"/><rect x="-0.3" y="-0.8" width="0.5" height="1" fill="${c.cow}"/><rect x="0.7" y="-0.8" width="0.5" height="1" fill="${c.cow}"/><rect x="1.5" y="-0.8" width="0.5" height="1" fill="${c.cow}"/></g>`;
  }
  return `<g transform="translate(${x},${y})"><ellipse cx="0" cy="-0.2" rx="2.5" ry="0.5" fill="${c.shadow}" opacity="0.15"/><ellipse cx="0" cy="-2.2" rx="2.8" ry="1.6" fill="${c.cow}"/><ellipse cx="0.8" cy="-2.5" rx="1" ry="0.7" fill="${c.cowSpot}"/><ellipse cx="-0.8" cy="-1.7" rx="0.6" ry="0.5" fill="${c.cowSpot}"/><ellipse cx="-2.5" cy="-2.8" rx="0.9" ry="0.7" fill="${c.cow}"/><ellipse cx="-3" cy="-2.6" rx="0.45" ry="0.35" fill="${c.cowSpot}" opacity="0.5"/><line x1="-2.8" y1="-3.4" x2="-3.3" y2="-4" stroke="${c.fence}" stroke-width="0.3"/><line x1="-2.2" y1="-3.4" x2="-1.7" y2="-4" stroke="${c.fence}" stroke-width="0.3"/><ellipse cx="-2" cy="-3.3" rx="0.25" ry="0.4" fill="${c.cow}"/><circle cx="-2.4" cy="-3" r="0.12" fill="#222"/><ellipse cx="0.5" cy="-0.9" rx="0.6" ry="0.3" fill="${c.cowSpot}" opacity="0.4"/><rect x="-1.5" y="-0.8" width="0.55" height="1" fill="${c.cow}"/><rect x="-0.5" y="-0.8" width="0.55" height="1" fill="${c.cow}"/><rect x="0.5" y="-0.8" width="0.55" height="1" fill="${c.cow}"/><rect x="1.4" y="-0.8" width="0.55" height="1" fill="${c.cow}"/><path d="M2.8,-2.5 Q3.5,-2 3.2,-1" stroke="${c.cowSpot}" fill="none" stroke-width="0.3"/><ellipse cx="3.2" cy="-0.9" rx="0.3" ry="0.2" fill="${c.cowSpot}"/></g>`;
}
function svgChicken(x, y, c, v) {
  if (v === 1) {
    return `<g transform="translate(${x},${y})"><ellipse cx="0" cy="-0.1" rx="1" ry="0.25" fill="${c.shadow}" opacity="0.1"/><ellipse cx="0" cy="-1.3" rx="1.3" ry="1" fill="${c.chicken}"/><path d="M1.2,-1.5 Q2,-2 1.8,-2.8 Q1.5,-2.5 1.3,-1.8" fill="${c.chicken}"/><ellipse cx="0.2" cy="-1.4" rx="0.7" ry="0.5" fill="${c.trunk}" opacity="0.3"/><circle cx="-1.2" cy="-0.8" r="0.55" fill="${c.chicken}"/><path d="M-1.2,-1.3 Q-1,-1.7 -0.9,-1.3 Q-0.7,-1.6 -0.6,-1.2" fill="${c.flag}"/><circle cx="-1.1" cy="-0.85" r="0.1" fill="#222"/><polygon points="-1.5,-0.7 -1.9,-0.6 -1.5,-0.5" fill="${c.wheat}"/><ellipse cx="-1.3" cy="-0.5" rx="0.12" ry="0.2" fill="${c.flag}"/><line x1="-0.3" y1="-0.3" x2="-0.4" y2="0.3" stroke="${c.wheat}" stroke-width="0.2"/><line x1="0.4" y1="-0.3" x2="0.5" y2="0.3" stroke="${c.wheat}" stroke-width="0.2"/></g>`;
  }
  if (v === 2) {
    return `<g transform="translate(${x},${y})"><ellipse cx="0" cy="-1.5" rx="1.4" ry="1.1" fill="${c.chicken}"/><path d="M1.3,-1.8 Q2,-2.5 1.8,-3.2" fill="${c.chicken}"/><circle cx="-1.2" cy="-2.2" r="0.6" fill="${c.chicken}"/><path d="M-1.2,-2.8 Q-1,-3.2 -0.85,-2.8 Q-0.7,-3.1 -0.6,-2.7" fill="${c.flag}"/><circle cx="-1" cy="-2.25" r="0.1" fill="#222"/><polygon points="-1.7,-2.1 -2.1,-2 -1.7,-1.9" fill="${c.wheat}"/><circle cx="2.2" cy="-0.5" r="0.4" fill="${c.wheat}"/><circle cx="2.4" cy="-0.55" r="0.08" fill="#222"/><polygon points="2.5,-0.5 2.7,-0.45 2.5,-0.4" fill="${c.flag}" opacity="0.8"/><circle cx="3" cy="-0.6" r="0.35" fill="${c.wheat}"/><circle cx="3.15" cy="-0.65" r="0.07" fill="#222"/></g>`;
  }
  return `<g transform="translate(${x},${y})"><ellipse cx="0" cy="-0.1" rx="1" ry="0.25" fill="${c.shadow}" opacity="0.1"/><ellipse cx="0" cy="-1.5" rx="1.3" ry="1.1" fill="${c.chicken}"/><path d="M1.2,-1.8 Q1.8,-2.5 1.6,-3.3 Q1.3,-2.8 1.1,-2" fill="${c.chicken}"/><ellipse cx="0.3" cy="-1.6" rx="0.6" ry="0.45" fill="${c.trunk}" opacity="0.25"/><circle cx="-1" cy="-2.4" r="0.65" fill="${c.chicken}"/><path d="M-1,-3.1 Q-0.8,-3.5 -0.7,-3 Q-0.5,-3.4 -0.4,-2.9 Q-0.2,-3.2 -0.1,-2.8" fill="${c.flag}"/><circle cx="-0.85" cy="-2.45" r="0.12" fill="#222"/><polygon points="-1.6,-2.3 -2,-2.2 -1.6,-2.1" fill="${c.wheat}"/><ellipse cx="-1.15" cy="-2" rx="0.15" ry="0.25" fill="${c.flag}"/><line x1="-0.4" y1="-0.4" x2="-0.5" y2="0.3" stroke="${c.wheat}" stroke-width="0.25"/><line x1="0.4" y1="-0.4" x2="0.5" y2="0.3" stroke="${c.wheat}" stroke-width="0.25"/><path d="M-0.7,0.3 L-0.5,0.3 L-0.3,0.3" stroke="${c.wheat}" stroke-width="0.15" fill="none"/><path d="M0.3,0.3 L0.5,0.3 L0.7,0.3" stroke="${c.wheat}" stroke-width="0.15" fill="none"/></g>`;
}
function svgHorse(x, y, c, v) {
  if (v === 1) {
    return `<g transform="translate(${x},${y})"><ellipse cx="0" cy="-0.2" rx="2.5" ry="0.5" fill="${c.shadow}" opacity="0.15"/><ellipse cx="0" cy="-2.5" rx="2.5" ry="1.4" fill="${c.horse}"/><path d="M-2,-2.5 Q-2.5,-3.5 -2.2,-4.5 Q-2,-5 -1.5,-5.5" fill="${c.horse}" stroke="${c.horse}" stroke-width="1.2"/><ellipse cx="-1.2" cy="-5.8" rx="0.9" ry="0.5" fill="${c.horse}"/><path d="M-2,-3.5 Q-2.5,-4 -2.3,-4.5 Q-2,-5 -1.5,-5.3" stroke="${c.trunk}" fill="none" stroke-width="0.5"/><polygon points="-1.4,-6.3 -1.2,-6.8 -1,-6.3" fill="${c.horse}"/><circle cx="-1" cy="-5.8" r="0.12" fill="#222"/><rect x="-1.5" y="-1.3" width="0.5" height="1.8" fill="${c.horse}" transform="rotate(-20 -1.5 -1.3)"/><rect x="-0.5" y="-1.3" width="0.5" height="1.5" fill="${c.horse}" transform="rotate(15 -0.5 -1.3)"/><rect x="1" y="-1.3" width="0.5" height="1.5" fill="${c.horse}"/><rect x="1.8" y="-1.3" width="0.5" height="1.8" fill="${c.horse}" transform="rotate(-10 1.8 -1.3)"/><path d="M2.5,-2.8 Q3.5,-2.5 3.8,-1.5 Q4,-0.5 3.5,0" stroke="${c.trunk}" fill="none" stroke-width="0.5"/></g>`;
  }
  if (v === 2) {
    return `<g transform="translate(${x},${y})"><ellipse cx="0.5" cy="-0.2" rx="1.5" ry="0.4" fill="${c.shadow}" opacity="0.15"/><ellipse cx="0" cy="-3" rx="2.2" ry="1.3" fill="${c.horse}" transform="rotate(-25 0 -3)"/><path d="M-1.5,-3.5 Q-2,-5 -1.5,-6" fill="${c.horse}" stroke="${c.horse}" stroke-width="1.1"/><ellipse cx="-1.2" cy="-6.5" rx="0.85" ry="0.5" fill="${c.horse}"/><path d="M-1.8,-4.5 Q-2.3,-5 -2,-5.8" stroke="${c.trunk}" fill="none" stroke-width="0.5"/><polygon points="-1.4,-7 -1.2,-7.5 -1,-7" fill="${c.horse}"/><rect x="-1.2" y="-2.5" width="0.45" height="1.8" fill="${c.horse}" transform="rotate(-60 -1.2 -2.5)"/><rect x="-0.3" y="-2.5" width="0.45" height="1.6" fill="${c.horse}" transform="rotate(-45 -0.3 -2.5)"/><rect x="0.8" y="-1.5" width="0.5" height="1.7" fill="${c.horse}"/><rect x="1.5" y="-1.5" width="0.5" height="1.7" fill="${c.horse}"/></g>`;
  }
  return `<g transform="translate(${x},${y})"><ellipse cx="0" cy="-0.2" rx="2.2" ry="0.5" fill="${c.shadow}" opacity="0.15"/><ellipse cx="0" cy="-2.5" rx="2.5" ry="1.4" fill="${c.horse}"/><path d="M-2,-2.8 Q-2.3,-4 -2,-5" fill="${c.horse}" stroke="${c.horse}" stroke-width="1.2"/><ellipse cx="-1.6" cy="-5.5" rx="1" ry="0.55" fill="${c.horse}"/><ellipse cx="-2.4" cy="-5.3" rx="0.4" ry="0.3" fill="${c.horse}"/><path d="M-1.8,-3.5 Q-2.5,-4 -2.2,-4.8 Q-2,-5.3 -1.5,-5.5" stroke="${c.trunk}" fill="none" stroke-width="0.6"/><polygon points="-1.8,-6 -1.6,-6.5 -1.4,-6" fill="${c.horse}"/><polygon points="-1.3,-6 -1.1,-6.4 -0.9,-6" fill="${c.horse}"/><circle cx="-1.4" cy="-5.5" r="0.12" fill="#222"/><circle cx="-2.5" cy="-5.2" r="0.08" fill="#333"/><rect x="-1.4" y="-1.2" width="0.5" height="1.4" fill="${c.horse}"/><rect x="-0.5" y="-1.2" width="0.5" height="1.4" fill="${c.horse}"/><rect x="0.6" y="-1.2" width="0.5" height="1.4" fill="${c.horse}"/><rect x="1.5" y="-1.2" width="0.5" height="1.4" fill="${c.horse}"/><rect x="-1.45" y="0" width="0.55" height="0.25" fill="${c.trunk}"/><rect x="-0.55" y="0" width="0.55" height="0.25" fill="${c.trunk}"/><rect x="0.55" y="0" width="0.55" height="0.25" fill="${c.trunk}"/><rect x="1.45" y="0" width="0.55" height="0.25" fill="${c.trunk}"/><path d="M2.5,-2.8 Q3.2,-2.5 3,-1.5 Q2.8,-0.5 3.2,0" stroke="${c.trunk}" fill="none" stroke-width="0.6"/></g>`;
}
function svgDonkey(x, y, c, v) {
  const body = c.donkey || "#808080";
  const dark = "#505050";
  const muzzle = "#a0a0a0";
  if (v === 1) {
    return `<g transform="translate(${x},${y})"><ellipse cx="0" cy="-0.2" rx="2" ry="0.4" fill="${c.shadow}" opacity="0.15"/><ellipse cx="0" cy="-2" rx="2.2" ry="1.2" fill="${body}"/><path d="M-1.5,-2.2 Q-2,-3.2 -1.6,-4" fill="${body}" stroke="${body}" stroke-width="0.9"/><ellipse cx="-1.3" cy="-4.3" rx="0.85" ry="0.5" fill="${body}"/><ellipse cx="-2" cy="-4.1" rx="0.4" ry="0.3" fill="${muzzle}"/><ellipse cx="-1.6" cy="-5.2" rx="0.2" ry="0.6" fill="${body}"/><ellipse cx="-1" cy="-5.1" rx="0.2" ry="0.55" fill="${body}"/><circle cx="-1.2" cy="-4.4" r="0.1" fill="#222"/><rect x="-1.2" y="-0.9" width="0.45" height="1.2" fill="${body}"/><rect x="-0.3" y="-0.9" width="0.45" height="1.1" fill="${body}"/><rect x="0.5" y="-0.9" width="0.45" height="1.1" fill="${body}"/><rect x="1.2" y="-0.9" width="0.45" height="1.2" fill="${body}"/><rect x="-1.25" y="0.1" width="0.5" height="0.2" fill="${dark}"/><rect x="1.15" y="0.1" width="0.5" height="0.2" fill="${dark}"/><path d="M2.2,-2.2 Q2.8,-2 2.5,-1" stroke="${dark}" fill="none" stroke-width="0.35"/></g>`;
  }
  return `<g transform="translate(${x},${y})"><ellipse cx="0" cy="-0.2" rx="2" ry="0.4" fill="${c.shadow}" opacity="0.15"/><ellipse cx="0" cy="-2" rx="2.2" ry="1.2" fill="${body}"/><line x1="-1" y1="-2.8" x2="1.5" y2="-2.8" stroke="${dark}" stroke-width="0.3"/><path d="M-1.5,-2.2 Q-2,-3.2 -1.6,-4" fill="${body}" stroke="${body}" stroke-width="0.9"/><ellipse cx="-1.3" cy="-4.3" rx="0.85" ry="0.5" fill="${body}"/><ellipse cx="-2" cy="-4.1" rx="0.4" ry="0.3" fill="${muzzle}"/><ellipse cx="-1.6" cy="-5.2" rx="0.2" ry="0.65" fill="${body}"/><ellipse cx="-1.6" cy="-5.2" rx="0.12" ry="0.5" fill="${muzzle}" opacity="0.5"/><ellipse cx="-1" cy="-5.1" rx="0.2" ry="0.6" fill="${body}"/><ellipse cx="-1" cy="-5.1" rx="0.12" ry="0.45" fill="${muzzle}" opacity="0.5"/><circle cx="-1.2" cy="-4.4" r="0.1" fill="#222"/><circle cx="-2.1" cy="-4" r="0.06" fill="#333"/><rect x="-1.2" y="-0.9" width="0.45" height="1.1" fill="${body}"/><rect x="-0.3" y="-0.9" width="0.45" height="1.1" fill="${body}"/><rect x="0.5" y="-0.9" width="0.45" height="1.1" fill="${body}"/><rect x="1.2" y="-0.9" width="0.45" height="1.1" fill="${body}"/><rect x="-1.25" y="0" width="0.5" height="0.2" fill="${dark}"/><rect x="-0.35" y="0" width="0.5" height="0.2" fill="${dark}"/><rect x="0.45" y="0" width="0.5" height="0.2" fill="${dark}"/><rect x="1.15" y="0" width="0.5" height="0.2" fill="${dark}"/><path d="M2.2,-2.2 Q2.8,-2 2.5,-1" stroke="${dark}" fill="none" stroke-width="0.35"/><ellipse cx="2.5" cy="-0.9" rx="0.25" ry="0.2" fill="${dark}"/></g>`;
}
function svgGoat(x, y, c, v) {
  const body = c.goat || "#e8e0d0";
  const horn = c.goatHorn || "#b0a090";
  const dark = "#8a7a60";
  if (v === 1) {
    return `<g transform="translate(${x},${y})"><ellipse cx="0" cy="-0.2" rx="1.5" ry="0.35" fill="${c.shadow}" opacity="0.15"/><ellipse cx="0" cy="-1.8" rx="2" ry="1.1" fill="${body}"/><ellipse cx="-2" cy="-1.2" rx="0.65" ry="0.5" fill="${body}"/><path d="M-2.3,-1.5 Q-2.8,-2.2 -2.5,-2.8" stroke="${horn}" fill="none" stroke-width="0.25"/><path d="M-1.8,-1.5 Q-1.3,-2.2 -1.6,-2.6" stroke="${horn}" fill="none" stroke-width="0.25"/><path d="M-2.4,-1 Q-2.6,-0.5 -2.4,-0.2" stroke="${dark}" fill="none" stroke-width="0.2"/><circle cx="-1.9" cy="-1.3" r="0.08" fill="#222"/><rect x="-0.8" y="-0.8" width="0.4" height="1" fill="${body}"/><rect x="0.5" y="-0.8" width="0.4" height="1" fill="${body}"/><ellipse cx="2" cy="-2" rx="0.3" ry="0.2" fill="${body}"/></g>`;
  }
  if (v === 2) {
    const brownBody = "#c0a880";
    return `<g transform="translate(${x},${y})"><ellipse cx="0" cy="-0.2" rx="1.5" ry="0.35" fill="${c.shadow}" opacity="0.15"/><ellipse cx="0" cy="-1.8" rx="2" ry="1.1" fill="${brownBody}"/><path d="M-1.5,-2 Q-1.8,-2.8 -1.5,-3.2" fill="${brownBody}" stroke="${brownBody}" stroke-width="0.6"/><ellipse cx="-1.3" cy="-3.5" rx="0.6" ry="0.45" fill="${brownBody}"/><path d="M-1.6,-3.8 Q-2,-4.5 -1.7,-5" stroke="${horn}" fill="none" stroke-width="0.25"/><path d="M-1.1,-3.8 Q-0.7,-4.5 -1,-4.9" stroke="${horn}" fill="none" stroke-width="0.25"/><ellipse cx="-0.85" cy="-3.6" rx="0.3" ry="0.15" fill="${brownBody}" transform="rotate(20 -0.85 -3.6)"/><path d="M-1.6,-3.3 Q-1.8,-2.8 -1.6,-2.4" stroke="${dark}" fill="none" stroke-width="0.2"/><circle cx="-1.15" cy="-3.55" r="0.08" fill="#222"/><rect x="-1" y="-0.8" width="0.4" height="1" fill="${brownBody}"/><rect x="-0.2" y="-0.8" width="0.4" height="1" fill="${brownBody}"/><rect x="0.5" y="-0.8" width="0.4" height="1" fill="${brownBody}"/><rect x="1.1" y="-0.8" width="0.4" height="1" fill="${brownBody}"/></g>`;
  }
  return `<g transform="translate(${x},${y})"><ellipse cx="0" cy="-0.2" rx="1.5" ry="0.35" fill="${c.shadow}" opacity="0.15"/><ellipse cx="0" cy="-1.8" rx="2" ry="1.1" fill="${body}"/><path d="M-1.5,-2 Q-1.8,-2.8 -1.5,-3.2" fill="${body}" stroke="${body}" stroke-width="0.6"/><ellipse cx="-1.3" cy="-3.5" rx="0.6" ry="0.45" fill="${body}"/><path d="M-1.6,-3.8 Q-2,-4.5 -1.7,-5" stroke="${horn}" fill="none" stroke-width="0.25"/><path d="M-1.1,-3.8 Q-0.7,-4.5 -1,-4.9" stroke="${horn}" fill="none" stroke-width="0.25"/><ellipse cx="-0.85" cy="-3.6" rx="0.3" ry="0.15" fill="${body}" transform="rotate(20 -0.85 -3.6)"/><path d="M-1.6,-3.3 Q-1.9,-2.8 -1.7,-2.3" stroke="${dark}" fill="none" stroke-width="0.2"/><path d="M-1.5,-3.2 Q-1.7,-2.7 -1.5,-2.2" stroke="${dark}" fill="none" stroke-width="0.15"/><ellipse cx="-1.15" cy="-3.55" rx="0.1" ry="0.06" fill="#222"/><ellipse cx="-1.7" cy="-3.35" rx="0.25" ry="0.18" fill="${horn}" opacity="0.5"/><rect x="-1" y="-0.8" width="0.4" height="1" fill="${body}"/><rect x="-0.2" y="-0.8" width="0.4" height="1" fill="${body}"/><rect x="0.5" y="-0.8" width="0.4" height="1" fill="${body}"/><rect x="1.1" y="-0.8" width="0.4" height="1" fill="${body}"/><rect x="-1.05" y="0" width="0.45" height="0.2" fill="${dark}"/><rect x="-0.25" y="0" width="0.45" height="0.2" fill="${dark}"/><rect x="0.45" y="0" width="0.45" height="0.2" fill="${dark}"/><rect x="1.05" y="0" width="0.45" height="0.2" fill="${dark}"/><path d="M2,-2 Q2.3,-2.3 2.2,-2.6" stroke="${body}" fill="none" stroke-width="0.25"/></g>`;
}
function svgRicePaddy(x, y, c, v) {
  return `<g transform="translate(${x},${y})"><polygon points="-4,-1 0,-3 4,-1 0,1" fill="${c.ricePaddy}" stroke="${c.ricePaddy}" stroke-width="0.3"/><polygon points="-3,-0.8 0,-2.4 3,-0.8 0,0.6" fill="${c.ricePaddyWater}" opacity="0.6"/><line x1="-1.5" y1="-0.6" x2="1.5" y2="-1.8" stroke="#fff" stroke-width="0.2" opacity="0.25"/><line x1="-1" y1="0" x2="2" y2="-1.2" stroke="#fff" stroke-width="0.2" opacity="0.2"/><line x1="-2" y1="-0.3" x2="1" y2="-1.5" stroke="#fff" stroke-width="0.2" opacity="0.15"/><line x1="-2.5" y1="-0.5" x2="-2.5" y2="-2" stroke="${c.reeds}" stroke-width="0.3"/><line x1="-0.8" y1="-1.8" x2="-0.8" y2="-3.3" stroke="${c.reeds}" stroke-width="0.3"/><line x1="1" y1="-1.5" x2="1" y2="-3" stroke="${c.reeds}" stroke-width="0.3"/><line x1="2.5" y1="-0.5" x2="2.5" y2="-2" stroke="${c.reeds}" stroke-width="0.3"/></g>`;
}
function svgTent(x, y, c, v) {
  return `<g transform="translate(${x},${y})"><polygon points="0,-6 -3.5,0 3.5,0" fill="${c.tent}"/><polygon points="0,-6 -1.5,0 1.5,0" fill="${c.tentStripe}" opacity="0.6"/><line x1="0" y1="-6" x2="0" y2="-7" stroke="${c.trunk}" stroke-width="0.3"/></g>`;
}
function svgHut(x, y, c, v) {
  if (v === 1) {
    return `<g transform="translate(${x},${y})"><ellipse cx="0" cy="-1.5" rx="2" ry="1.5" fill="${c.hut}"/><polygon points="-2.2,-1.5 0,-5 2.2,-1.5" fill="${c.roofB}"/></g>`;
  }
  if (v === 2) {
    return `<g transform="translate(${x},${y})"><rect x="-2" y="-3" width="4" height="3" fill="${c.hut}"/><polygon points="-2.5,-3 0,-5.5 2.5,-3" fill="${c.roofB}"/><rect x="2.5" y="-1.5" width="2" height="1.5" fill="${c.hut}" opacity="0.6"/><line x1="2.5" y1="-1.5" x2="4.5" y2="-1.5" stroke="${c.roofB}" stroke-width="0.3"/><line x1="4.5" y1="-1.5" x2="4.5" y2="0" stroke="${c.trunk}" stroke-width="0.3"/></g>`;
  }
  return `<g transform="translate(${x},${y})"><rect x="-2" y="-3" width="4" height="3" fill="${c.hut}"/><polygon points="-2.5,-3 0,-5.5 2.5,-3" fill="${c.roofB}"/></g>`;
}
function svgHouse(x, y, c, v, roofColor) {
  const roofOptions = [roofColor || c.roofA, "#4477aa", "#448844"];
  const roof = roofOptions[v] || roofOptions[0];
  return `<g transform="translate(${x},${y})"><polygon points="-2.5,0 0,1.2 2.5,0 2.5,-3 0,-1.8 -2.5,-3" fill="${c.wall}"/><polygon points="-2.5,0 0,1.2 0,-1.8 -2.5,-3" fill="${c.wallShade}"/><polygon points="0,-6 -3.2,-2.8 0,-1.5 3.2,-2.8" fill="${roof}"/><rect x="1" y="-6.5" width="1" height="2" fill="${c.chimney}"/></g>`;
}
function svgHouseB(x, y, c, v) {
  return svgHouse(x, y, c, v, c.roofB);
}
function svgChurch(x, y, c, v) {
  if (v === 1) {
    return `<g transform="translate(${x},${y})"><polygon points="-2,0 0,1 2,0 2,-5 0,-4 -2,-5" fill="${c.church}"/><polygon points="-2,0 0,1 0,-4 -2,-5" fill="${c.wallShade}"/><rect x="-1" y="-8.5" width="2" height="3.5" fill="${c.church}"/><polygon points="-1.3,-8.5 0,-10.5 1.3,-8.5" fill="${c.roofA}"/><circle cx="0" cy="-7" r="0.4" fill="${c.blacksmith}" opacity="0.5"/></g>`;
  }
  if (v === 2) {
    return `<g transform="translate(${x},${y})"><rect x="-1.5" y="-3" width="3" height="3" fill="${c.church}"/><polygon points="-2,-3 0,-5 2,-3" fill="${c.roofA}"/><line x1="0" y1="-5.5" x2="0" y2="-5" stroke="${c.wall}" stroke-width="0.4"/><line x1="-0.5" y1="-5.2" x2="0.5" y2="-5.2" stroke="${c.wall}" stroke-width="0.4"/></g>`;
  }
  return `<g transform="translate(${x},${y})"><polygon points="-2,0 0,1 2,0 2,-5 0,-4 -2,-5" fill="${c.church}"/><polygon points="-2,0 0,1 0,-4 -2,-5" fill="${c.wallShade}"/><polygon points="0,-10 -2.5,-5 0,-3.8 2.5,-5" fill="${c.roofA}"/><line x1="0" y1="-12" x2="0" y2="-10" stroke="${c.wall}" stroke-width="0.5"/><line x1="-1" y1="-11" x2="1" y2="-11" stroke="${c.wall}" stroke-width="0.5"/></g>`;
}
function svgWindmill(x, y, c, v) {
  return `<g transform="translate(${x},${y})"><polygon points="-1.5,0 1.5,0 1,-7 -1,-7" fill="${c.windmill}"/><g><line x1="0" y1="-11" x2="0" y2="-3" stroke="${c.windBlade}" stroke-width="0.5"/><line x1="-4" y1="-7" x2="4" y2="-7" stroke="${c.windBlade}" stroke-width="0.5"/><animateTransform attributeName="transform" type="rotate" from="0 0 -7" to="360 0 -7" dur="8s" repeatCount="indefinite"/></g><circle cx="0" cy="-7" r="0.7" fill="${c.roofA}"/></g>`;
}
function svgWell(x, y, c, v) {
  return `<g transform="translate(${x},${y})"><ellipse cx="0" cy="-0.3" rx="2.3" ry="1.2" fill="${c.rock}"/><ellipse cx="0" cy="-0.6" rx="2.1" ry="1" fill="${c.well}" stroke="${c.boulder}" stroke-width="0.3"/><ellipse cx="-1.2" cy="-0.5" rx="0.5" ry="0.25" fill="${c.boulder}" opacity="0.6"/><ellipse cx="0.8" cy="-0.4" rx="0.6" ry="0.3" fill="${c.boulder}" opacity="0.5"/><ellipse cx="-0.2" cy="-0.7" rx="0.4" ry="0.2" fill="${c.rock}" opacity="0.4"/><ellipse cx="0" cy="-0.6" rx="1.4" ry="0.6" fill="${c.shadow}" opacity="0.8"/><rect x="-1.7" y="-4.2" width="0.4" height="3.7" fill="${c.trunk}"/><rect x="1.3" y="-4.2" width="0.4" height="3.7" fill="${c.trunk}"/><rect x="-1.8" y="-4.4" width="3.6" height="0.35" fill="${c.trunk}"/><polygon points="0,-5.8 -2.5,-4.2 2.5,-4.2" fill="${c.roofB}"/><line x1="0" y1="-5.8" x2="-2.5" y2="-4.2" stroke="${c.shadow}" stroke-width="0.15" opacity="0.3"/><ellipse cx="0" cy="-4" rx="0.5" ry="0.2" fill="${c.fence}"/><rect x="-0.5" y="-4.2" width="1" height="0.4" fill="${c.fence}"/><path d="M0,-4 Q0.3,-3 0,-2 Q-0.2,-1.5 0,-1" stroke="${c.fence}" stroke-width="0.15" fill="none"/><path d="M-0.35,-1.3 L-0.3,-0.6 L0.3,-0.6 L0.35,-1.3 Z" fill="${c.barrel}"/><ellipse cx="0" cy="-1.3" rx="0.35" ry="0.12" fill="${c.cart}"/></g>`;
}
function svgMarket(x, y, c, v) {
  if (v === 1) {
    return `<g transform="translate(${x},${y})"><rect x="-3" y="-3" width="6" height="3" fill="${c.market}"/><polygon points="-3.5,-3 0,-5 3.5,-3" fill="${c.marketAwning}"/><rect x="-2" y="-1.5" width="1" height="0.8" fill="${c.barrel}" rx="0.2"/><rect x="4" y="-1.5" width="2.5" height="1.2" fill="${c.cart}"/><circle cx="4.5" cy="0" r="0.5" fill="${c.trunk}"/></g>`;
  }
  if (v === 2) {
    return `<g transform="translate(${x},${y})"><line x1="-3" y1="0" x2="-3" y2="-4" stroke="${c.trunk}" stroke-width="0.5"/><line x1="3" y1="0" x2="3" y2="-4" stroke="${c.trunk}" stroke-width="0.5"/><polygon points="-3.5,-4 0,-5.5 3.5,-4" fill="${c.marketAwning}"/><rect x="-2.5" y="-1" width="5" height="0.8" fill="${c.trunk}" opacity="0.4"/><rect x="-2" y="-1.5" width="1" height="0.8" fill="${c.barrel}" rx="0.2"/><rect x="0.5" y="-1.5" width="1" height="0.8" fill="${c.wheat}" rx="0.2"/></g>`;
  }
  return `<g transform="translate(${x},${y})"><rect x="-3" y="-3" width="6" height="3" fill="${c.market}"/><polygon points="-3.5,-3 0,-5 3.5,-3" fill="${c.marketAwning}"/><rect x="-2" y="-1.5" width="1" height="0.8" fill="${c.barrel}" rx="0.2"/><rect x="0.5" y="-1.5" width="1" height="0.8" fill="${c.wheat}" rx="0.2"/></g>`;
}
function svgInn(x, y, c, v) {
  if (v === 1) {
    return `<g transform="translate(${x},${y})"><polygon points="-3,0 0,1.5 3,0 3,-4 0,-2.5 -3,-4" fill="${c.inn}"/><polygon points="-3,0 0,1.5 0,-2.5 -3,-4" fill="${c.wallShade}"/><polygon points="0,-7 -3.5,-3.8 0,-2.2 3.5,-3.8" fill="${c.roofB}"/><rect x="-1" y="-5.5" width="1.5" height="1.5" fill="${c.wall}"/><polygon points="-1,-5.5 -0.25,-6.5 0.5,-5.5" fill="${c.roofB}"/><rect x="3" y="-5" width="2" height="1.5" fill="${c.innSign}" rx="0.3"/></g>`;
  }
  if (v === 2) {
    return `<g transform="translate(${x},${y})"><polygon points="-3,0 0,1.5 3,0 3,-4 0,-2.5 -3,-4" fill="${c.inn}"/><polygon points="-3,0 0,1.5 0,-2.5 -3,-4" fill="${c.wallShade}"/><polygon points="0,-7 -3.5,-3.8 0,-2.2 3.5,-3.8" fill="${c.roofB}"/><rect x="3" y="-5" width="2" height="1.5" fill="${c.innSign}" rx="0.3"/><rect x="3.5" y="-1.5" width="2" height="0.5" fill="${c.trunk}" opacity="0.6"/><rect x="4" y="-1" width="0.5" height="1" fill="${c.trunk}" opacity="0.5"/></g>`;
  }
  return `<g transform="translate(${x},${y})"><polygon points="-3,0 0,1.5 3,0 3,-4 0,-2.5 -3,-4" fill="${c.inn}"/><polygon points="-3,0 0,1.5 0,-2.5 -3,-4" fill="${c.wallShade}"/><polygon points="0,-7 -3.5,-3.8 0,-2.2 3.5,-3.8" fill="${c.roofB}"/><rect x="3" y="-5" width="2" height="1.5" fill="${c.innSign}" rx="0.3"/></g>`;
}
function svgBlacksmith(x, y, c, v) {
  return `<g transform="translate(${x},${y})"><rect x="-2.5" y="-3" width="5" height="3" fill="${c.blacksmith}"/><polygon points="-3,-3 0,-5 3,-3" fill="${c.roofA}"/><polygon points="-1,-0.5 1,-0.5 1.5,-1.5 -1.5,-1.5" fill="${c.anvil}"/><circle cx="1.5" cy="-5.5" r="0.8" fill="${c.smoke}" opacity="0.5"/></g>`;
}
function svgCastle(x, y, c, v) {
  return `<g transform="translate(${x},${y})"><rect x="-3" y="-6" width="6" height="6" fill="${c.castle}"/><rect x="-3" y="-7" width="1.5" height="1.2" fill="${c.castle}"/><rect x="-0.75" y="-7" width="1.5" height="1.2" fill="${c.castle}"/><rect x="1.5" y="-7" width="1.5" height="1.2" fill="${c.castle}"/><rect x="-1" y="-10" width="2" height="3.5" fill="${c.tower}"/><polygon points="-1.3,-10 0,-12 1.3,-10" fill="${c.castleRoof}"/><rect x="-0.8" y="-2" width="1.6" height="2" fill="${c.blacksmith}" rx="0.8" ry="0"/></g>`;
}
function svgTower(x, y, c, v) {
  return `<g transform="translate(${x},${y})"><rect x="-1.5" y="-8" width="3" height="8" fill="${c.tower}"/><polygon points="-2,-8 0,-11 2,-8" fill="${c.castleRoof}"/><rect x="-0.5" y="-6" width="1" height="1.2" fill="${c.blacksmith}" rx="0.5" ry="0"/></g>`;
}
function svgBridge(x, y, c, v) {
  return `<g transform="translate(${x},${y})"><path d="M-4,0 Q0,-2 4,0" fill="${c.bridge}" stroke="${c.trunk}" stroke-width="0.4"/><line x1="-3" y1="-0.8" x2="-3" y2="-2.5" stroke="${c.trunk}" stroke-width="0.4"/><line x1="3" y1="-0.8" x2="3" y2="-2.5" stroke="${c.trunk}" stroke-width="0.4"/><line x1="-3" y1="-2.5" x2="3" y2="-2.5" stroke="${c.trunk}" stroke-width="0.3"/></g>`;
}
function svgCart(x, y, c, v) {
  return `<g transform="translate(${x},${y})"><rect x="-2" y="-2" width="3.5" height="2" fill="${c.cart}"/><circle cx="-1.5" cy="0" r="0.8" fill="${c.trunk}" stroke="${c.fence}" stroke-width="0.2"/><circle cx="1" cy="0" r="0.8" fill="${c.trunk}" stroke="${c.fence}" stroke-width="0.2"/><line x1="2" y1="-1" x2="3.5" y2="-0.5" stroke="${c.trunk}" stroke-width="0.4"/></g>`;
}
function svgBarrel(x, y, c, v) {
  return `<g transform="translate(${x},${y})"><ellipse cx="0" cy="-0.1" rx="1.4" ry="0.6" fill="${c.shadow}" opacity="0.2"/><ellipse cx="0" cy="-0.3" rx="1.3" ry="0.55" fill="${c.barrel}"/><rect x="-1.3" y="-2.6" width="2.6" height="2.3" fill="${c.barrel}" rx="0.2"/><line x1="-0.6" y1="-2.5" x2="-0.6" y2="-0.4" stroke="${c.trunk}" stroke-width="0.1" opacity="0.3"/><line x1="0.2" y1="-2.5" x2="0.2" y2="-0.4" stroke="${c.trunk}" stroke-width="0.1" opacity="0.3"/><line x1="0.9" y1="-2.5" x2="0.9" y2="-0.4" stroke="${c.trunk}" stroke-width="0.1" opacity="0.25"/><ellipse cx="0" cy="-0.6" rx="1.35" ry="0.25" fill="none" stroke="${c.shadow}" stroke-width="0.25"/><ellipse cx="0" cy="-1.5" rx="1.35" ry="0.25" fill="none" stroke="${c.shadow}" stroke-width="0.25"/><ellipse cx="0" cy="-2.4" rx="1.35" ry="0.25" fill="none" stroke="${c.shadow}" stroke-width="0.25"/><ellipse cx="0" cy="-2.6" rx="1.3" ry="0.55" fill="${c.cart}"/><ellipse cx="0" cy="-2.6" rx="0.9" ry="0.35" fill="${c.barrel}" opacity="0.7"/></g>`;
}
function svgTorch(x, y, c, v) {
  if (v === 1) {
    return `<g transform="translate(${x},${y})"><line x1="0" y1="0.5" x2="0" y2="-3" stroke="${c.torch}" stroke-width="0.4"/><ellipse cx="0" cy="-3.5" rx="0.6" ry="0.8" fill="${c.torchFlame}" opacity="0.8"/><ellipse cx="0" cy="-3.7" rx="0.3" ry="0.5" fill="#ffdd44" opacity="0.9"/></g>`;
  }
  if (v === 2) {
    return `<g transform="translate(${x},${y})"><line x1="0" y1="0" x2="0" y2="-5" stroke="${c.torch}" stroke-width="0.4"/><path d="M0,-5 Q1,-5.5 1,-5" stroke="${c.torch}" fill="none" stroke-width="0.3"/><rect x="0.5" y="-6" width="1" height="0.8" fill="${c.lantern}"/><rect x="0.65" y="-5.8" width="0.7" height="0.4" fill="${c.lanternGlow}" opacity="0.8"/></g>`;
  }
  return `<g transform="translate(${x},${y})"><line x1="0" y1="0" x2="0" y2="-4" stroke="${c.torch}" stroke-width="0.5"/><ellipse cx="0" cy="-4.5" rx="0.8" ry="1" fill="${c.torchFlame}" opacity="0.8"/><ellipse cx="0" cy="-4.8" rx="0.4" ry="0.6" fill="#ffdd44" opacity="0.9"/></g>`;
}
function svgFlag(x, y, c, v) {
  if (v === 1) {
    return `<g transform="translate(${x},${y})"><line x1="0" y1="0" x2="0" y2="-8" stroke="${c.trunk}" stroke-width="0.4"/><polygon points="0,-8 2.5,-6.5 0,-5" fill="#4477bb"/></g>`;
  }
  if (v === 2) {
    return `<g transform="translate(${x},${y})"><line x1="0" y1="0" x2="0" y2="-8" stroke="${c.trunk}" stroke-width="0.4"/><line x1="0" y1="-8" x2="2.5" y2="-8" stroke="${c.trunk}" stroke-width="0.3"/><rect x="0" y="-8" width="2.5" height="3" fill="${c.flag}" opacity="0.9"/></g>`;
  }
  return `<g transform="translate(${x},${y})"><line x1="0" y1="0" x2="0" y2="-8" stroke="${c.trunk}" stroke-width="0.4"/><polygon points="0,-8 3.5,-7 0,-5.5" fill="${c.flag}"/></g>`;
}
function svgCobblePath(x, y, c, v) {
  if (v === 1) {
    return `<g transform="translate(${x},${y})"><ellipse cx="-2" cy="-0.3" rx="0.8" ry="0.35" fill="${c.cobble}" opacity="0.6"/><ellipse cx="-0.5" cy="-0.3" rx="0.7" ry="0.3" fill="${c.cobble}" opacity="0.55"/><ellipse cx="1" cy="-0.3" rx="0.8" ry="0.35" fill="${c.cobble}" opacity="0.5"/><ellipse cx="2.5" cy="-0.3" rx="0.7" ry="0.3" fill="${c.cobble}" opacity="0.5"/></g>`;
  }
  if (v === 2) {
    return `<g transform="translate(${x},${y})"><ellipse cx="0" cy="-0.3" rx="0.8" ry="0.35" fill="${c.cobble}" opacity="0.6"/><ellipse cx="-1.5" cy="-0.8" rx="0.7" ry="0.3" fill="${c.cobble}" opacity="0.5"/><ellipse cx="1.5" cy="-0.8" rx="0.7" ry="0.3" fill="${c.cobble}" opacity="0.5"/><ellipse cx="-1.5" cy="0.2" rx="0.7" ry="0.3" fill="${c.cobble}" opacity="0.5"/><ellipse cx="1.5" cy="0.2" rx="0.7" ry="0.3" fill="${c.cobble}" opacity="0.5"/></g>`;
  }
  return `<g transform="translate(${x},${y})"><ellipse cx="-1" cy="-0.3" rx="1" ry="0.4" fill="${c.cobble}" opacity="0.6"/><ellipse cx="1" cy="0" rx="0.8" ry="0.35" fill="${c.cobble}" opacity="0.5"/><ellipse cx="0" cy="-0.8" rx="0.7" ry="0.3" fill="${c.cobble}" opacity="0.5"/></g>`;
}
function svgSmoke(x, y, c, v) {
  return `<g transform="translate(${x},${y})"><circle cx="0" cy="-5" r="1" fill="${c.smoke}"><animate attributeName="cy" values="-5;-8;-5" dur="4s" repeatCount="indefinite"/><animate attributeName="opacity" values="0.5;0.1;0.5" dur="4s" repeatCount="indefinite"/></circle><circle cx="0.5" cy="-6" r="0.7" fill="${c.smoke}"><animate attributeName="cy" values="-6;-9;-6" dur="3.5s" repeatCount="indefinite"/><animate attributeName="opacity" values="0.4;0.08;0.4" dur="3.5s" repeatCount="indefinite"/></circle></g>`;
}
function svgReeds(x, y, c, v) {
  return `<g transform="translate(${x},${y})"><line x1="-1" y1="0" x2="-1.3" y2="-4" stroke="${c.reeds}" stroke-width="0.4"/><line x1="0" y1="0" x2="0.2" y2="-4.5" stroke="${c.reeds}" stroke-width="0.4"/><line x1="1" y1="0" x2="0.8" y2="-3.8" stroke="${c.reeds}" stroke-width="0.4"/><ellipse cx="-1.3" cy="-4.3" rx="0.3" ry="0.8" fill="${c.trunk}"/><ellipse cx="0.2" cy="-4.8" rx="0.3" ry="0.8" fill="${c.trunk}"/></g>`;
}
function svgFountain(x, y, c, v) {
  return `<g transform="translate(${x},${y})"><ellipse cx="0" cy="-0.5" rx="2.5" ry="1" fill="${c.fountain}" stroke="${c.boulder}" stroke-width="0.3"/><ellipse cx="0" cy="-0.3" rx="2" ry="0.7" fill="${c.fountainWater}" opacity="0.6"/><rect x="-0.4" y="-3" width="0.8" height="2.5" fill="${c.fountain}"/><line x1="0" y1="-3" x2="0" y2="-4.5" stroke="${c.fountainWater}" stroke-width="0.4" opacity="0.7"><animate attributeName="y2" values="-4.5;-5.2;-4.5" dur="2s" repeatCount="indefinite"/></line><circle cx="-0.5" cy="-3.5" r="0.3" fill="${c.fountainWater}" opacity="0.4"/><circle cx="0.5" cy="-3.8" r="0.3" fill="${c.fountainWater}" opacity="0.4"/></g>`;
}
function svgCanal(x, y, c, v) {
  return `<g transform="translate(${x},${y})"><rect x="-3" y="-1" width="6" height="1" fill="${c.canal}"/><rect x="-2.5" y="-0.7" width="5" height="0.5" fill="${c.fountainWater}" opacity="0.5"/></g>`;
}
function svgWatermill(x, y, c, v) {
  return `<g transform="translate(${x},${y})"><rect x="-2" y="-4" width="4" height="4" fill="${c.wall}"/><polygon points="-2.5,-4 0,-6 2.5,-4" fill="${c.roofB}"/><g><circle cx="3" cy="-2" r="2" fill="none" stroke="${c.trunk}" stroke-width="0.5"/><line x1="3" y1="-4" x2="3" y2="0" stroke="${c.trunk}" stroke-width="0.3"/><line x1="1" y1="-2" x2="5" y2="-2" stroke="${c.trunk}" stroke-width="0.3"/><animateTransform attributeName="transform" type="rotate" from="0 3 -2" to="360 3 -2" dur="6s" repeatCount="indefinite"/></g></g>`;
}
function svgGardenTree(x, y, c, v) {
  if (v === 1) {
    return `<g transform="translate(${x},${y})"><line x1="0" y1="0" x2="0" y2="-2.5" stroke="${c.trunk}" stroke-width="0.5"/><polygon points="0,-7 -1.5,-2.5 1.5,-2.5" fill="${c.gardenTree}"/></g>`;
  }
  if (v === 2) {
    return `<g transform="translate(${x},${y})"><line x1="0" y1="0" x2="0" y2="-2.5" stroke="${c.trunk}" stroke-width="0.5"/><circle cx="0" cy="-4" r="2" fill="${c.gardenTree}"/><circle cx="-0.8" cy="-4.5" r="0.4" fill="${c.flower}" opacity="0.8"/><circle cx="0.5" cy="-3.5" r="0.35" fill="${c.flower}" opacity="0.7"/><circle cx="0.8" cy="-4.8" r="0.3" fill="${c.flower}" opacity="0.6"/><circle cx="-0.3" cy="-3.2" r="0.3" fill="${c.flower}" opacity="0.7"/></g>`;
  }
  return `<g transform="translate(${x},${y})"><line x1="0" y1="0" x2="0" y2="-2.5" stroke="${c.trunk}" stroke-width="0.5"/><circle cx="0" cy="-4" r="2" fill="${c.gardenTree}"/><circle cx="-0.8" cy="-3.5" r="1.2" fill="${c.leaf}" opacity="0.6"/></g>`;
}
function svgPondLily(x, y, c, v) {
  return `<g transform="translate(${x},${y})"><ellipse cx="0" cy="-0.3" rx="1.5" ry="0.6" fill="${c.pine}" opacity="0.7"/><circle cx="0.3" cy="-0.5" r="0.4" fill="${c.flower}"/></g>`;
}
function svgKelp(x, y, c, v) {
  return `<g transform="translate(${x},${y})"><path d="M0,0 Q-1,-2 0,-4 Q1,-6 0,-7" stroke="${c.fern}" fill="none" stroke-width="0.6" opacity="0.7"/><path d="M1,0 Q2,-1.5 1,-3.5 Q0,-5 1,-6" stroke="${c.fern}" fill="none" stroke-width="0.5" opacity="0.6"/></g>`;
}
function svgCoral(x, y, c, v) {
  return `<g transform="translate(${x},${y})"><path d="M0,0 Q-1,-2 -2,-3 M0,0 Q0,-2.5 -0.5,-4 M0,0 Q1,-2 2,-3" stroke="${c.coral}" fill="none" stroke-width="0.8"/><circle cx="-2" cy="-3" r="0.5" fill="${c.coral}"/><circle cx="-0.5" cy="-4" r="0.5" fill="${c.coral}"/><circle cx="2" cy="-3" r="0.5" fill="${c.coral}"/></g>`;
}
function svgJellyfish(x, y, c, v) {
  return `<g transform="translate(${x},${y})"><ellipse cx="0" cy="-2" rx="2" ry="1.5" fill="${c.jellyfish}" opacity="0.7"><animate attributeName="cy" values="-2;-3;-2" dur="3s" repeatCount="indefinite"/></ellipse><path d="M-1.5,-0.5 Q-1.2,-1.5 -0.8,0" stroke="${c.jellyfish}" fill="none" stroke-width="0.3" opacity="0.5"/><path d="M-0.3,-0.5 Q0,-1.5 0.3,0" stroke="${c.jellyfish}" fill="none" stroke-width="0.3" opacity="0.5"/><path d="M0.8,-0.5 Q1.2,-1.5 1.5,0" stroke="${c.jellyfish}" fill="none" stroke-width="0.3" opacity="0.5"/></g>`;
}
function svgTurtle(x, y, c, v) {
  return `<g transform="translate(${x},${y})"><g><ellipse cx="0" cy="-1" rx="2" ry="1.2" fill="${c.turtle}"/><ellipse cx="0" cy="-1.3" rx="1.5" ry="0.8" fill="${c.moss}" opacity="0.5"/><circle cx="-2" cy="-1.2" r="0.5" fill="${c.turtle}"/><circle cx="-2.3" cy="-1.3" r="0.12" fill="#222"/><animateTransform attributeName="transform" type="translate" values="0,0;3,0;0,0" dur="8s" repeatCount="indefinite"/></g></g>`;
}
function svgBuoy(x, y, c, v) {
  return `<g transform="translate(${x},${y})"><ellipse cx="0" cy="-0.3" rx="1.2" ry="0.5" fill="${c.waterLight}" opacity="0.3"/><rect x="-0.6" y="-2.5" width="1.2" height="2.2" fill="${c.buoy}" rx="0.3"/><rect x="-0.6" y="-1.8" width="1.2" height="0.5" fill="#fff"/><line x1="0" y1="-2.5" x2="0" y2="-3.5" stroke="${c.buoy}" stroke-width="0.3"/></g>`;
}
function svgSailboat(x, y, c, v) {
  return `<g transform="translate(${x},${y})"><polygon points="-3.5,0 -2.5,-1.5 3.5,-1.5 4,0" fill="${c.boat}"/><line x1="0" y1="-1.5" x2="0" y2="-7" stroke="${c.trunk}" stroke-width="0.4"/><polygon points="0,-6.5 0,-2 3,-2.5" fill="${c.sail}" opacity="0.9"/><polygon points="0,-6 0,-2.5 -2,-3" fill="${c.sail}" opacity="0.7"/></g>`;
}
function svgLighthouse(x, y, c, v) {
  return `<g transform="translate(${x},${y})"><polygon points="-1.5,0 1.5,0 1,-8 -1,-8" fill="${c.lighthouse}"/><rect x="-1.5" y="-1" width="3" height="1" fill="${c.rock}"/><rect x="-0.8" y="-9" width="1.6" height="1.2" fill="${c.lighthouse}" stroke="${c.rock}" stroke-width="0.2"/><polygon points="-1,-9 0,-10.5 1,-9" fill="${c.buoy}"/><circle cx="0" cy="-8.4" r="0.4" fill="${c.lanternGlow}" opacity="0.8"/></g>`;
}
function svgCrab(x, y, c, v) {
  return `<g transform="translate(${x},${y})"><ellipse cx="0" cy="-0.8" rx="1.5" ry="1" fill="${c.crab}"/><path d="M-1.5,-0.8 L-2.5,-1.8 L-2.8,-1.2" stroke="${c.crab}" fill="none" stroke-width="0.4"/><path d="M1.5,-0.8 L2.5,-1.8 L2.8,-1.2" stroke="${c.crab}" fill="none" stroke-width="0.4"/><circle cx="-0.5" cy="-1.2" r="0.15" fill="#222"/><circle cx="0.5" cy="-1.2" r="0.15" fill="#222"/></g>`;
}
function svgDriftwood(x, y, c, v) {
  return `<g transform="translate(${x},${y})"><path d="M-3,-0.3 Q-1,-1 1,-0.5 Q2.5,-0.2 3.5,0" stroke="${c.driftwood}" fill="none" stroke-width="0.8" stroke-linecap="round"/><path d="M1,-0.5 Q1.5,-1.5 2,-1.8" stroke="${c.driftwood}" fill="none" stroke-width="0.5"/></g>`;
}
function svgSandcastle(x, y, c, v) {
  return `<g transform="translate(${x},${y})"><rect x="-2" y="-2" width="4" height="2" fill="${c.sandcastle}"/><rect x="-1" y="-3.5" width="2" height="1.8" fill="${c.sandcastle}"/><rect x="-0.3" y="-4.5" width="0.6" height="1.2" fill="${c.sandcastle}"/><line x1="0" y1="-4.5" x2="0.8" y2="-4.5" stroke="${c.buoy}" stroke-width="0.2"/></g>`;
}
function svgTidePools(x, y, c, v) {
  return `<g transform="translate(${x},${y})"><ellipse cx="-1" cy="-0.3" rx="1.5" ry="0.6" fill="${c.tidePools}" opacity="0.5"/><ellipse cx="1.2" cy="-0.5" rx="1" ry="0.4" fill="${c.tidePools}" opacity="0.4"/><circle cx="-1.5" cy="-0.5" r="0.25" fill="${c.rock}"/><circle cx="0.8" cy="-0.3" r="0.2" fill="${c.rock}"/></g>`;
}
function svgHeron(x, y, c, v) {
  return `<g transform="translate(${x},${y})"><line x1="0" y1="0" x2="0" y2="-3" stroke="${c.heron}" stroke-width="0.3"/><line x1="0.5" y1="0" x2="0.5" y2="-3" stroke="${c.heron}" stroke-width="0.3"/><ellipse cx="0.3" cy="-4" rx="1" ry="1.5" fill="${c.heron}"/><circle cx="-0.2" cy="-5.5" r="0.6" fill="${c.heron}"/><line x1="-0.8" y1="-5.4" x2="-1.8" y2="-5.2" stroke="${c.wheat}" stroke-width="0.3"/></g>`;
}
function svgShellfish(x, y, c, v) {
  return `<g transform="translate(${x},${y})"><ellipse cx="-1" cy="-0.3" rx="0.8" ry="0.5" fill="${c.shellfish}"/><ellipse cx="0.5" cy="-0.2" rx="0.6" ry="0.4" fill="${c.shellfish}" opacity="0.8"/><ellipse cx="1.5" cy="-0.5" rx="0.7" ry="0.45" fill="${c.shellfish}" opacity="0.7"/></g>`;
}
function svgCattail(x, y, c, v) {
  return `<g transform="translate(${x},${y})" class="sway-gentle"><line x1="-0.5" y1="0" x2="-0.7" y2="-4.5" stroke="${c.cattail}" stroke-width="0.3"/><line x1="0.5" y1="0" x2="0.3" y2="-5" stroke="${c.cattail}" stroke-width="0.3"/><ellipse cx="-0.7" cy="-5" rx="0.3" ry="0.9" fill="${c.trunk}"/><ellipse cx="0.3" cy="-5.5" rx="0.3" ry="0.9" fill="${c.trunk}"/></g>`;
}
function svgFrog(x, y, c, v) {
  return `<g transform="translate(${x},${y})"><ellipse cx="0" cy="-0.5" rx="1" ry="0.7" fill="${c.frog}"/><circle cx="-0.5" cy="-1.1" r="0.3" fill="${c.frog}"/><circle cx="0.5" cy="-1.1" r="0.3" fill="${c.frog}"/><circle cx="-0.5" cy="-1.2" r="0.12" fill="#222"/><circle cx="0.5" cy="-1.2" r="0.12" fill="#222"/></g>`;
}
function svgLily(x, y, c, v) {
  return `<g transform="translate(${x},${y})"><ellipse cx="0" cy="-0.2" rx="1.8" ry="0.7" fill="${c.pine}" opacity="0.6"/><path d="M0,-0.4 Q-0.3,-1.2 0,-1 Q0.3,-1.2 0,-0.4" fill="${c.lily}" opacity="0.9"/><circle cx="0" cy="-0.7" r="0.2" fill="${c.flowerCenter}"/></g>`;
}
function svgRabbit(x, y, c, v) {
  if (v === 1) {
    return `<g transform="translate(${x},${y})"><ellipse cx="0" cy="-1" rx="1" ry="0.7" fill="${c.rabbit}"/><circle cx="-0.8" cy="-1.6" r="0.45" fill="${c.rabbit}"/><ellipse cx="-1" cy="-2.3" rx="0.18" ry="0.5" fill="${c.rabbit}"/><ellipse cx="-0.6" cy="-2.3" rx="0.18" ry="0.5" fill="${c.rabbit}"/><circle cx="-1" cy="-1.7" r="0.1" fill="#222"/><line x1="0.8" y1="-0.5" x2="1.5" y2="0.2" stroke="${c.rabbit}" stroke-width="0.3"/></g>`;
  }
  if (v === 2) {
    return `<g transform="translate(${x},${y})"><ellipse cx="-0.5" cy="-0.8" rx="1" ry="0.7" fill="${c.rabbit}"/><circle cx="-1.3" cy="-1.4" r="0.4" fill="${c.rabbit}"/><ellipse cx="-1.5" cy="-2" rx="0.15" ry="0.45" fill="${c.rabbit}"/><ellipse cx="-1.1" cy="-2" rx="0.15" ry="0.45" fill="${c.rabbit}"/><ellipse cx="1.5" cy="-0.6" rx="0.8" ry="0.5" fill="${c.rabbit}" opacity="0.8"/><circle cx="0.9" cy="-1" r="0.3" fill="${c.rabbit}" opacity="0.8"/></g>`;
  }
  return `<g transform="translate(${x},${y})"><ellipse cx="0" cy="-0.8" rx="1.2" ry="0.8" fill="${c.rabbit}"/><circle cx="-0.8" cy="-1.5" r="0.5" fill="${c.rabbit}"/><ellipse cx="-1.1" cy="-2.3" rx="0.2" ry="0.6" fill="${c.rabbit}"/><ellipse cx="-0.6" cy="-2.3" rx="0.2" ry="0.6" fill="${c.rabbit}"/><circle cx="-1" cy="-1.6" r="0.1" fill="#222"/></g>`;
}
function svgFox(x, y, c, v) {
  if (v === 1) {
    return `<g transform="translate(${x},${y})"><ellipse cx="0" cy="-0.8" rx="1.5" ry="0.8" fill="${c.fox}"/><circle cx="-1" cy="-1.2" r="0.5" fill="${c.fox}"/><polygon points="-1.3,-1.7 -1.5,-2.1 -1,-1.8" fill="${c.fox}"/><polygon points="-0.7,-1.7 -0.5,-2.1 -1,-1.8" fill="${c.fox}"/><path d="M1.5,-0.5 Q1.2,-0.2 0.5,-0.5" stroke="${c.fox}" fill="none" stroke-width="0.5"/><circle cx="0.5" cy="-0.5" r="0.25" fill="#fff" opacity="0.8"/></g>`;
  }
  if (v === 2) {
    return `<g transform="translate(${x},${y})"><ellipse cx="0" cy="-1.5" rx="1.8" ry="0.9" fill="${c.fox}"/><circle cx="-1.5" cy="-2.3" r="0.55" fill="${c.fox}"/><polygon points="-1.8,-2.8 -2,-3.3 -1.5,-2.9" fill="${c.fox}"/><polygon points="-1.2,-2.8 -1,-3.3 -1.5,-2.9" fill="${c.fox}"/><circle cx="-1.7" cy="-2.4" r="0.1" fill="#222"/><line x1="-0.8" y1="-0.6" x2="-1.3" y2="0.3" stroke="${c.fox}" stroke-width="0.3"/><line x1="0.8" y1="-0.6" x2="1.3" y2="0.3" stroke="${c.fox}" stroke-width="0.3"/><path d="M1.8,-1.3 Q2.5,-1.5 3,-1" stroke="${c.fox}" fill="none" stroke-width="0.5"/></g>`;
  }
  return `<g transform="translate(${x},${y})"><ellipse cx="0" cy="-1.2" rx="1.8" ry="1" fill="${c.fox}"/><circle cx="-1.5" cy="-2" r="0.6" fill="${c.fox}"/><polygon points="-1.8,-2.6 -2,-3.2 -1.5,-2.7" fill="${c.fox}"/><polygon points="-1.2,-2.6 -1,-3.2 -1.5,-2.7" fill="${c.fox}"/><circle cx="-1.7" cy="-2.1" r="0.1" fill="#222"/><path d="M1.8,-1 Q2.5,-0.8 3,-1.5" stroke="${c.fox}" fill="none" stroke-width="0.6"/><circle cx="3" cy="-1.5" r="0.3" fill="#fff" opacity="0.8"/></g>`;
}
function svgButterfly(x, y, c, v) {
  return `<g transform="translate(${x},${y})"><g><ellipse cx="-1" cy="-3.5" rx="1" ry="0.7" fill="${c.butterfly}" opacity="0.8"/><ellipse cx="1" cy="-3.5" rx="1" ry="0.7" fill="${c.butterflyWing}" opacity="0.8"/><ellipse cx="-0.6" cy="-2.8" rx="0.6" ry="0.4" fill="${c.butterflyWing}" opacity="0.7"/><ellipse cx="0.6" cy="-2.8" rx="0.6" ry="0.4" fill="${c.butterfly}" opacity="0.7"/><line x1="0" y1="-2.5" x2="0" y2="-4" stroke="${c.bird}" stroke-width="0.2"/><animateTransform attributeName="transform" type="translate" values="0,0;2,-1;-1,0.5;0,0" dur="6s" repeatCount="indefinite"/></g></g>`;
}
function svgBeehive(x, y, c, v) {
  return `<g transform="translate(${x},${y})"><line x1="0" y1="-5" x2="0" y2="-7" stroke="${c.trunk}" stroke-width="0.5"/><path d="M-1,-5 Q1,-4.5 1,-5" stroke="${c.trunk}" fill="none" stroke-width="0.3"/><ellipse cx="0" cy="-3.5" rx="1.2" ry="1.8" fill="${c.beehive}"/><line x1="-1.2" y1="-3.5" x2="1.2" y2="-3.5" stroke="${c.trunk}" stroke-width="0.2" opacity="0.4"/><line x1="-1" y1="-2.5" x2="1" y2="-2.5" stroke="${c.trunk}" stroke-width="0.2" opacity="0.4"/><circle cx="0" cy="-1.8" r="0.25" fill="${c.trunk}"/></g>`;
}
function svgWildflowerPatch(x, y, c, v) {
  return `<g transform="translate(${x},${y})"><circle cx="-1.5" cy="-1.5" r="0.5" fill="${c.flower}"/><circle cx="0" cy="-1.8" r="0.6" fill="${c.wildflower}"/><circle cx="1.2" cy="-1.3" r="0.5" fill="${c.butterflyWing}"/><circle cx="-0.5" cy="-1" r="0.4" fill="${c.flower}" opacity="0.8"/><circle cx="0.8" cy="-2" r="0.35" fill="${c.wildflower}" opacity="0.7"/><line x1="-1.5" y1="-1" x2="-1.5" y2="0" stroke="${c.pine}" stroke-width="0.2"/><line x1="0" y1="-1.2" x2="0" y2="0" stroke="${c.pine}" stroke-width="0.2"/><line x1="1.2" y1="-0.8" x2="1.2" y2="0" stroke="${c.pine}" stroke-width="0.2"/></g>`;
}
function svgTallGrass(x, y, c, v) {
  return `<g transform="translate(${x},${y})" class="sway-gentle"><line x1="-1" y1="0" x2="-1.3" y2="-3.5" stroke="${c.tallGrass}" stroke-width="0.4"/><line x1="0" y1="0" x2="0.2" y2="-4" stroke="${c.tallGrass}" stroke-width="0.4"/><line x1="1" y1="0" x2="0.8" y2="-3.2" stroke="${c.tallGrass}" stroke-width="0.4"/><line x1="-0.5" y1="0" x2="-0.8" y2="-3.8" stroke="${c.tallGrass}" stroke-width="0.3" opacity="0.7"/></g>`;
}
function svgBirch(x, y, c, v) {
  if (v === 1) {
    return `<g transform="translate(${x},${y})"><line x1="-2" y1="0" x2="-2" y2="-5.5" stroke="${c.birchBark}" stroke-width="0.5"/><circle cx="-2" cy="-6.5" r="1.5" fill="${c.leaf}" opacity="0.7"/><line x1="0" y1="0" x2="0" y2="-7" stroke="${c.birchBark}" stroke-width="0.6"/><circle cx="0" cy="-8" r="1.8" fill="${c.leaf}" opacity="0.8"/><line x1="2" y1="0" x2="2" y2="-5" stroke="${c.birchBark}" stroke-width="0.5"/><circle cx="2" cy="-6" r="1.3" fill="${c.leaf}" opacity="0.6"/></g>`;
  }
  if (v === 2) {
    return `<g transform="translate(${x},${y})"><path d="M0,0 Q-1,-3.5 -0.5,-7" stroke="${c.birchBark}" fill="none" stroke-width="0.7"/><line x1="-0.7" y1="-2" x2="-0.3" y2="-2" stroke="${c.trunk}" stroke-width="0.2" opacity="0.5"/><line x1="-0.5" y1="-4.5" x2="-0.1" y2="-4.5" stroke="${c.trunk}" stroke-width="0.2" opacity="0.5"/><circle cx="-0.5" cy="-8.5" r="2" fill="${c.leaf}" opacity="0.8"/><circle cx="-1.5" cy="-8" r="1.3" fill="${c.leaf}" opacity="0.6"/></g>`;
  }
  return `<g transform="translate(${x},${y})"><line x1="0" y1="0" x2="0" y2="-7" stroke="${c.birchBark}" stroke-width="0.7"/><line x1="-0.2" y1="-2" x2="0.2" y2="-2" stroke="${c.trunk}" stroke-width="0.2" opacity="0.5"/><line x1="-0.2" y1="-4" x2="0.2" y2="-4" stroke="${c.trunk}" stroke-width="0.2" opacity="0.5"/><circle cx="0" cy="-8.5" r="2.2" fill="${c.leaf}" opacity="0.8"/><circle cx="-1" cy="-8" r="1.5" fill="${c.leaf}" opacity="0.6"/></g>`;
}
function svgHaybale(x, y, c, v) {
  return `<g transform="translate(${x},${y})"><ellipse cx="0" cy="-1" rx="2" ry="1" fill="${c.haybale}"/><rect x="-2" y="-1" width="4" height="1" fill="${c.haybale}"/><ellipse cx="0" cy="0" rx="2" ry="0.6" fill="${c.haybale}" opacity="0.7"/><line x1="-1.5" y1="-0.5" x2="1.5" y2="-0.5" stroke="${c.wheat}" stroke-width="0.2" opacity="0.4"/></g>`;
}
function svgOwl(x, y, c, v) {
  return `<g transform="translate(${x},${y})"><ellipse cx="0" cy="-2" rx="1.2" ry="1.5" fill="${c.owl}"/><circle cx="-0.4" cy="-2.5" r="0.5" fill="#fff"/><circle cx="0.4" cy="-2.5" r="0.5" fill="#fff"/><circle cx="-0.4" cy="-2.5" r="0.2" fill="#222"/><circle cx="0.4" cy="-2.5" r="0.2" fill="#222"/><polygon points="0,-2.1 -0.2,-1.8 0.2,-1.8" fill="${c.wheat}"/></g>`;
}
function svgSquirrel(x, y, c, v) {
  return `<g transform="translate(${x},${y})"><ellipse cx="0" cy="-0.8" rx="0.8" ry="0.6" fill="${c.squirrel}"/><circle cx="-0.6" cy="-1.3" r="0.4" fill="${c.squirrel}"/><circle cx="-0.7" cy="-1.4" r="0.1" fill="#222"/><path d="M0.8,-0.8 Q1.5,-1.5 1.2,-2.2" stroke="${c.squirrel}" fill="none" stroke-width="0.5"/></g>`;
}
function svgMoss(x, y, c, v) {
  return `<g transform="translate(${x},${y})"><ellipse cx="-1" cy="-0.2" rx="1.5" ry="0.5" fill="${c.moss}" opacity="0.7"/><ellipse cx="1" cy="-0.3" rx="1.2" ry="0.4" fill="${c.moss}" opacity="0.6"/><ellipse cx="0" cy="-0.1" rx="0.8" ry="0.3" fill="${c.moss}" opacity="0.5"/></g>`;
}
function svgFern(x, y, c, v) {
  return `<g transform="translate(${x},${y})"><path d="M0,0 Q-2,-2 -3,-3.5" stroke="${c.fern}" fill="none" stroke-width="0.4"/><path d="M0,0 Q0,-2.5 0,-4" stroke="${c.fern}" fill="none" stroke-width="0.4"/><path d="M0,0 Q2,-2 3,-3.5" stroke="${c.fern}" fill="none" stroke-width="0.4"/><circle cx="-1" cy="-1.5" r="0.3" fill="${c.fern}" opacity="0.6"/><circle cx="1" cy="-1.5" r="0.3" fill="${c.fern}" opacity="0.6"/><circle cx="0" cy="-2.5" r="0.3" fill="${c.fern}" opacity="0.5"/></g>`;
}
function svgDeadTree(x, y, c, v) {
  return `<g transform="translate(${x},${y})"><line x1="0" y1="0" x2="0" y2="-6" stroke="${c.deadTree}" stroke-width="0.8"/><line x1="0" y1="-4" x2="-2" y2="-5.5" stroke="${c.deadTree}" stroke-width="0.4"/><line x1="0" y1="-3" x2="1.5" y2="-4.5" stroke="${c.deadTree}" stroke-width="0.4"/><line x1="0" y1="-5" x2="-1" y2="-6.5" stroke="${c.deadTree}" stroke-width="0.3"/></g>`;
}
function svgLog(x, y, c, v) {
  return `<g transform="translate(${x},${y})"><rect x="-3" y="-1" width="6" height="1" fill="${c.log}" rx="0.5"/><ellipse cx="-3" cy="-0.5" rx="0.5" ry="0.5" fill="${c.trunk}"/><ellipse cx="3" cy="-0.5" rx="0.5" ry="0.5" fill="${c.trunk}"/></g>`;
}
function svgBerryBush(x, y, c, v) {
  return `<g transform="translate(${x},${y})"><ellipse cx="0" cy="-1.5" rx="2.2" ry="1.5" fill="${c.berryBush}"/><circle cx="-0.8" cy="-1.8" r="0.3" fill="${c.berry}"/><circle cx="0.5" cy="-2" r="0.3" fill="${c.berry}"/><circle cx="0" cy="-1.2" r="0.25" fill="${c.berry}"/><circle cx="1.2" cy="-1.5" r="0.25" fill="${c.berry}"/></g>`;
}
function svgSpider(x, y, c, v) {
  return `<g transform="translate(${x},${y})"><line x1="-2.5" y1="-4" x2="2.5" y2="-1" stroke="${c.spiderWeb}" fill="none" stroke-width="0.15"/><line x1="-2.5" y1="-1" x2="2.5" y2="-4" stroke="${c.spiderWeb}" fill="none" stroke-width="0.15"/><line x1="0" y1="-5" x2="0" y2="0" stroke="${c.spiderWeb}" fill="none" stroke-width="0.15"/><path d="M-1.5,-1.5 Q0,-2 1.5,-1.5" stroke="${c.spiderWeb}" fill="none" stroke-width="0.12"/><path d="M-1,-3 Q0,-3.5 1,-3" stroke="${c.spiderWeb}" fill="none" stroke-width="0.12"/><circle cx="0" cy="-2.5" r="0.4" fill="${c.bird}"/></g>`;
}
function svgSilo(x, y, c, v) {
  return `<g transform="translate(${x},${y})"><rect x="-1.2" y="-7" width="2.4" height="7" fill="${c.silo}"/><ellipse cx="0" cy="-7" rx="1.2" ry="0.5" fill="${c.silo}" opacity="0.8"/><polygon points="-1.2,-7 0,-8.5 1.2,-7" fill="${c.roofA}"/></g>`;
}
function svgPigpen(x, y, c, v) {
  return `<g transform="translate(${x},${y})"><rect x="-2.5" y="-1" width="5" height="1" fill="${c.fence}" opacity="0.5"/><ellipse cx="0" cy="-1" rx="1.2" ry="0.8" fill="${c.pig}"/><circle cx="-1" cy="-1.3" r="0.4" fill="${c.pig}"/><ellipse cx="-1.3" cy="-1.2" rx="0.25" ry="0.15" fill="#eaa"/></g>`;
}
function svgTrough(x, y, c, v) {
  return `<g transform="translate(${x},${y})"><rect x="-2" y="-1" width="4" height="0.8" fill="${c.trough}"/><line x1="-1.5" y1="-0.2" x2="-1.5" y2="0.5" stroke="${c.trunk}" stroke-width="0.3"/><line x1="1.5" y1="-0.2" x2="1.5" y2="0.5" stroke="${c.trunk}" stroke-width="0.3"/><rect x="-1.8" y="-0.8" width="3.6" height="0.5" fill="${c.tidePools}" opacity="0.4"/></g>`;
}
function svgHaystack(x, y, c, v) {
  return `<g transform="translate(${x},${y})"><polygon points="-2,0 2,0 1.5,-3 -1.5,-3" fill="${c.haystack}"/><polygon points="-1.5,-3 0,-4.5 1.5,-3" fill="${c.haystack}"/></g>`;
}
function svgOrchard(x, y, c, v) {
  return `<g transform="translate(${x},${y})"><line x1="0" y1="0" x2="0" y2="-3" stroke="${c.trunk}" stroke-width="0.6"/><circle cx="0" cy="-5" r="2.5" fill="${c.orchard}"/><circle cx="-1" cy="-4.5" r="0.35" fill="${c.orchardFruit}"/><circle cx="0.8" cy="-5.2" r="0.35" fill="${c.orchardFruit}"/><circle cx="0" cy="-3.8" r="0.3" fill="${c.orchardFruit}"/></g>`;
}
function svgAppleTree(x, y, c, v) {
  const leaf = c.orchard;
  const apple = c.appleRed || "#c41e3a";
  const trunk = c.trunk;
  if (v === 1) {
    return `<g transform="translate(${x},${y})"><rect x="-0.5" y="-1" width="1" height="3" fill="${trunk}"/><circle cx="0" cy="-4.5" r="2.5" fill="${leaf}"/><circle cx="-1.5" cy="-3.5" r="1.5" fill="${leaf}" opacity="0.9"/><circle cx="1.5" cy="-3.5" r="1.5" fill="${leaf}" opacity="0.85"/><circle cx="-1" cy="-4" r="0.35" fill="${apple}"/><circle cx="0.5" cy="-5" r="0.35" fill="${apple}"/><circle cx="1.2" cy="-4" r="0.3" fill="${apple}"/><circle cx="-0.3" cy="-3.5" r="0.3" fill="${apple}"/><circle cx="0" cy="-5.5" r="0.3" fill="${apple}"/></g>`;
  }
  if (v === 2) {
    return `<g transform="translate(${x},${y})"><rect x="-0.5" y="-1" width="1" height="3" fill="${trunk}"/><circle cx="0" cy="-4.5" r="2.3" fill="${leaf}"/><circle cx="-1.2" cy="-3.5" r="1.3" fill="${leaf}" opacity="0.9"/><circle cx="1.2" cy="-3.5" r="1.3" fill="${leaf}" opacity="0.85"/><circle cx="-0.5" cy="-4.5" r="0.3" fill="${apple}"/><circle cx="0.8" cy="-4" r="0.3" fill="${apple}"/><circle cx="-1.5" cy="0.3" r="0.25" fill="${apple}" opacity="0.8"/><circle cx="0.8" cy="0.5" r="0.25" fill="${apple}" opacity="0.75"/></g>`;
  }
  return `<g transform="translate(${x},${y})"><rect x="-0.5" y="-1" width="1" height="3" fill="${trunk}"/><circle cx="0" cy="-4.5" r="2.5" fill="${leaf}"/><circle cx="-1.5" cy="-3.5" r="1.5" fill="${leaf}" opacity="0.9"/><circle cx="1.5" cy="-3.5" r="1.5" fill="${leaf}" opacity="0.85"/><circle cx="-1" cy="-4.2" r="0.35" fill="${apple}"/><circle cx="0.6" cy="-5" r="0.35" fill="${apple}"/><circle cx="0" cy="-3.8" r="0.3" fill="${apple}"/></g>`;
}
function svgOliveTree(x, y, c, v) {
  const leaf = c.oliveGreen || "#808060";
  const fruit = c.oliveFruit || "#4a4a30";
  const trunk = c.trunk;
  if (v === 1) {
    return `<g transform="translate(${x},${y})"><path d="M-0.3,2 Q-0.8,0 -0.5,-1 Q-0.2,-2 0,-2" stroke="${trunk}" fill="none" stroke-width="0.8"/><path d="M0.3,2 Q0.8,0 0.5,-1 Q0.2,-2 0,-2" stroke="${trunk}" fill="none" stroke-width="0.8"/><ellipse cx="0" cy="-4" rx="2.5" ry="1.8" fill="${leaf}" opacity="0.7"/><ellipse cx="-1.5" cy="-3.5" rx="1.2" ry="0.9" fill="${leaf}" opacity="0.6"/><ellipse cx="1.5" cy="-3.5" rx="1.2" ry="0.9" fill="${leaf}" opacity="0.55"/><circle cx="-0.8" cy="-3.8" r="0.2" fill="${fruit}"/><circle cx="0.5" cy="-4.2" r="0.2" fill="${fruit}"/><circle cx="1" cy="-3.5" r="0.18" fill="${fruit}"/></g>`;
  }
  return `<g transform="translate(${x},${y})"><rect x="-0.4" y="-1" width="0.8" height="3" fill="${trunk}"/><ellipse cx="0" cy="-3.5" rx="2.2" ry="1.6" fill="${leaf}" opacity="0.7"/><ellipse cx="-1.2" cy="-3" rx="1" ry="0.8" fill="${leaf}" opacity="0.6"/><ellipse cx="1.2" cy="-3" rx="1" ry="0.8" fill="${leaf}" opacity="0.55"/><circle cx="-0.5" cy="-3.5" r="0.18" fill="${fruit}"/><circle cx="0.6" cy="-3.8" r="0.18" fill="${fruit}"/></g>`;
}
function svgLemonTree(x, y, c, v) {
  const leaf = c.palm;
  const lemon = c.lemonYellow || "#fff44f";
  const trunk = c.trunk;
  if (v === 1) {
    return `<g transform="translate(${x},${y})"><rect x="-0.4" y="-1" width="0.8" height="2.5" fill="${trunk}"/><circle cx="0" cy="-3.5" r="2" fill="${leaf}"/><circle cx="-1" cy="-2.8" r="1.2" fill="${leaf}" opacity="0.9"/><circle cx="1" cy="-2.8" r="1.2" fill="${leaf}" opacity="0.85"/><ellipse cx="-0.8" cy="-3.5" rx="0.35" ry="0.25" fill="${lemon}"/><ellipse cx="0.5" cy="-4" rx="0.35" ry="0.25" fill="${lemon}"/><ellipse cx="0.8" cy="-3" rx="0.3" ry="0.22" fill="${lemon}"/><ellipse cx="-0.2" cy="-2.8" rx="0.3" ry="0.22" fill="${lemon}"/></g>`;
  }
  return `<g transform="translate(${x},${y})"><rect x="-0.4" y="-1" width="0.8" height="2.5" fill="${trunk}"/><circle cx="0" cy="-3.5" r="2" fill="${leaf}"/><circle cx="-1" cy="-2.8" r="1.2" fill="${leaf}" opacity="0.9"/><circle cx="1" cy="-2.8" r="1.2" fill="${leaf}" opacity="0.85"/><ellipse cx="-0.5" cy="-3.5" rx="0.3" ry="0.22" fill="${lemon}"/><ellipse cx="0.6" cy="-3.8" rx="0.3" ry="0.22" fill="${lemon}"/></g>`;
}
function svgOrangeTree(x, y, c, v) {
  const leaf = c.orchard;
  const orange = c.orangeFruit || "#ff8c00";
  const trunk = c.trunk;
  if (v === 1) {
    return `<g transform="translate(${x},${y})"><rect x="-0.5" y="-1" width="1" height="3" fill="${trunk}"/><circle cx="0" cy="-4.2" r="2.3" fill="${leaf}"/><circle cx="-1.3" cy="-3.2" r="1.3" fill="${leaf}" opacity="0.9"/><circle cx="1.3" cy="-3.2" r="1.3" fill="${leaf}" opacity="0.85"/><circle cx="-0.8" cy="-4" r="0.4" fill="${orange}"/><circle cx="0.5" cy="-4.5" r="0.35" fill="${orange}"/><circle cx="1" cy="-3.5" r="0.35" fill="${orange}"/><circle cx="-0.2" cy="-3.2" r="0.3" fill="${orange}"/></g>`;
  }
  return `<g transform="translate(${x},${y})"><rect x="-0.5" y="-1" width="1" height="3" fill="${trunk}"/><circle cx="0" cy="-4.2" r="2.3" fill="${leaf}"/><circle cx="-1.3" cy="-3.2" r="1.3" fill="${leaf}" opacity="0.9"/><circle cx="1.3" cy="-3.2" r="1.3" fill="${leaf}" opacity="0.85"/><circle cx="-0.6" cy="-4" r="0.4" fill="${orange}"/><circle cx="0.7" cy="-4.3" r="0.35" fill="${orange}"/></g>`;
}
function svgPearTree(x, y, c, v) {
  const leaf = c.orchard;
  const pear = c.pearGreen || "#d1e231";
  const trunk = c.trunk;
  if (v === 1) {
    return `<g transform="translate(${x},${y})"><rect x="-0.5" y="-1" width="1" height="3" fill="${trunk}"/><circle cx="0" cy="-4.5" r="2.5" fill="${leaf}"/><circle cx="-1.5" cy="-3.5" r="1.5" fill="${leaf}" opacity="0.9"/><circle cx="1.5" cy="-3.5" r="1.5" fill="${leaf}" opacity="0.85"/><path d="M-0.8,-4.3 Q-0.8,-4.8 -0.6,-4.8 Q-0.4,-4.8 -0.4,-4.3 Q-0.4,-3.8 -0.6,-3.6 Q-0.8,-3.8 -0.8,-4.3" fill="${pear}"/><path d="M0.6,-4.8 Q0.6,-5.3 0.8,-5.3 Q1,-5.3 1,-4.8 Q1,-4.3 0.8,-4.1 Q0.6,-4.3 0.6,-4.8" fill="${pear}"/><path d="M0.3,-3.5 Q0.3,-4 0.5,-4 Q0.7,-4 0.7,-3.5 Q0.7,-3 0.5,-2.8 Q0.3,-3 0.3,-3.5" fill="${pear}"/></g>`;
  }
  return `<g transform="translate(${x},${y})"><rect x="-0.5" y="-1" width="1" height="3" fill="${trunk}"/><circle cx="0" cy="-4.5" r="2.5" fill="${leaf}"/><circle cx="-1.5" cy="-3.5" r="1.5" fill="${leaf}" opacity="0.9"/><circle cx="1.5" cy="-3.5" r="1.5" fill="${leaf}" opacity="0.85"/><path d="M-0.6,-4.5 Q-0.6,-5 -0.4,-5 Q-0.2,-5 -0.2,-4.5 Q-0.2,-4 -0.4,-3.8 Q-0.6,-4 -0.6,-4.5" fill="${pear}"/><path d="M0.7,-4 Q0.7,-4.5 0.9,-4.5 Q1.1,-4.5 1.1,-4 Q1.1,-3.5 0.9,-3.3 Q0.7,-3.5 0.7,-4" fill="${pear}"/></g>`;
}
function svgPeachTree(x, y, c, v) {
  const leaf = c.orchard;
  const peach = c.peachFruit || "#ffcba4";
  const trunk = c.trunk;
  if (v === 1) {
    return `<g transform="translate(${x},${y})"><rect x="-0.5" y="-1" width="1" height="3" fill="${trunk}"/><circle cx="0" cy="-4" r="2.2" fill="${leaf}"/><circle cx="-1.2" cy="-3.2" r="1.3" fill="${leaf}" opacity="0.9"/><circle cx="1.2" cy="-3.2" r="1.3" fill="${leaf}" opacity="0.85"/><circle cx="-0.6" cy="-4" r="0.4" fill="${peach}"/><circle cx="0.5" cy="-4.3" r="0.35" fill="${peach}"/><circle cx="0.8" cy="-3.3" r="0.35" fill="${peach}"/></g>`;
  }
  return `<g transform="translate(${x},${y})"><rect x="-0.5" y="-1" width="1" height="3" fill="${trunk}"/><circle cx="0" cy="-4" r="2.2" fill="${leaf}"/><circle cx="-1.2" cy="-3.2" r="1.3" fill="${leaf}" opacity="0.9"/><circle cx="1.2" cy="-3.2" r="1.3" fill="${leaf}" opacity="0.85"/><circle cx="-0.5" cy="-4" r="0.35" fill="${peach}"/><circle cx="0.6" cy="-4.2" r="0.35" fill="${peach}"/></g>`;
}
function svgBeeFarm(x, y, c, v) {
  return `<g transform="translate(${x},${y})"><rect x="-1.5" y="-2.5" width="3" height="2.5" fill="${c.beeFarm}"/><rect x="-1.5" y="-2.5" width="3" height="0.8" fill="${c.beeFarm}" stroke="${c.trunk}" stroke-width="0.2"/><rect x="-1.5" y="-1.7" width="3" height="0.8" fill="${c.beeFarm}" stroke="${c.trunk}" stroke-width="0.2"/><polygon points="-1.5,-2.5 0,-3.5 1.5,-2.5" fill="${c.roofB}"/></g>`;
}
function svgPumpkin(x, y, c, v) {
  return `<g transform="translate(${x},${y})"><ellipse cx="0" cy="-0.8" rx="1.5" ry="1" fill="${c.pumpkin}"/><ellipse cx="-0.5" cy="-0.8" rx="0.8" ry="1" fill="${c.pumpkin}" opacity="0.6"/><ellipse cx="0.5" cy="-0.8" rx="0.8" ry="1" fill="${c.pumpkin}" opacity="0.6"/><line x1="0" y1="-1.8" x2="0.3" y2="-2.3" stroke="${c.pine}" stroke-width="0.3"/></g>`;
}
function svgTavern(x, y, c, v) {
  return `<g transform="translate(${x},${y})"><polygon points="-2.5,0 0,1.2 2.5,0 2.5,-3.5 0,-2.3 -2.5,-3.5" fill="${c.tavern}"/><polygon points="-2.5,0 0,1.2 0,-2.3 -2.5,-3.5" fill="${c.wallShade}"/><polygon points="0,-6 -3,-3.3 0,-2 3,-3.3" fill="${c.roofB}"/><rect x="3" y="-5" width="1.5" height="1.2" fill="${c.tavernSign}" rx="0.2"/><circle cx="3.75" cy="-4.4" r="0.3" fill="${c.wheat}"/></g>`;
}
function svgBakery(x, y, c, v) {
  return `<g transform="translate(${x},${y})"><rect x="-2.5" y="-3.5" width="5" height="3.5" fill="${c.bakery}"/><polygon points="-3,-3.5 0,-5.5 3,-3.5" fill="${c.roofA}"/><rect x="1.5" y="-6.5" width="0.8" height="1.5" fill="${c.chimney}"/><circle cx="1.9" cy="-7.5" r="0.6" fill="${c.smoke}"><animate attributeName="cy" values="-7.5;-9.5;-7.5" dur="3s" repeatCount="indefinite"/><animate attributeName="opacity" values="0.4;0.1;0.4" dur="3s" repeatCount="indefinite"/></circle></g>`;
}
function svgStable(x, y, c, v) {
  return `<g transform="translate(${x},${y})"><rect x="-3" y="-3" width="6" height="3" fill="${c.stable}"/><polygon points="-3.5,-3 0,-5 3.5,-3" fill="${c.roofB}"/><rect x="-1" y="-2" width="2" height="2" fill="${c.trunk}" opacity="0.6"/></g>`;
}
function svgGarden(x, y, c, v) {
  return `<g transform="translate(${x},${y})"><rect x="-3" y="-0.3" width="6" height="0.3" fill="${c.gardenFence}" opacity="0.5"/><line x1="-3" y1="-0.3" x2="-3" y2="-1.5" stroke="${c.gardenFence}" stroke-width="0.3"/><line x1="3" y1="-0.3" x2="3" y2="-1.5" stroke="${c.gardenFence}" stroke-width="0.3"/><line x1="-3" y1="-1" x2="3" y2="-1" stroke="${c.gardenFence}" stroke-width="0.2"/><circle cx="-1.5" cy="-0.8" r="0.4" fill="${c.flower}"/><circle cx="0" cy="-0.6" r="0.35" fill="${c.wildflower}"/><circle cx="1.5" cy="-0.7" r="0.4" fill="${c.butterflyWing}"/></g>`;
}
function svgLaundry(x, y, c, v) {
  return `<g transform="translate(${x},${y})" class="sway-slow"><line x1="-3" y1="0" x2="-3" y2="-4" stroke="${c.trunk}" stroke-width="0.4"/><line x1="3" y1="0" x2="3" y2="-4" stroke="${c.trunk}" stroke-width="0.4"/><line x1="-3" y1="-3.5" x2="3" y2="-3.5" stroke="${c.trunk}" stroke-width="0.2"/><rect x="-2" y="-3.5" width="1.5" height="2" fill="${c.laundry}" rx="0.1"/><rect x="0" y="-3.5" width="1.2" height="1.8" fill="${c.sail}" rx="0.1"/></g>`;
}
function svgDoghouse(x, y, c, v) {
  return `<g transform="translate(${x},${y})"><rect x="-1.5" y="-2" width="3" height="2" fill="${c.doghouse}"/><polygon points="-1.8,-2 0,-3.2 1.8,-2" fill="${c.roofA}"/><ellipse cx="0" cy="-0.5" rx="0.5" ry="0.6" fill="${c.trunk}" opacity="0.6"/><ellipse cx="2.5" cy="-0.5" rx="0.7" ry="0.5" fill="${c.deer}"/></g>`;
}
function svgShrine(x, y, c, v) {
  return `<g transform="translate(${x},${y})"><rect x="-0.8" y="-3" width="1.6" height="3" fill="${c.shrine}"/><polygon points="-1.2,-3 0,-4.2 1.2,-3" fill="${c.shrine}"/><rect x="-0.3" y="-2.5" width="0.6" height="0.6" fill="${c.fountain}" rx="0.1"/></g>`;
}
function svgWagon(x, y, c, v) {
  return `<g transform="translate(${x},${y})"><rect x="-3" y="-3" width="5" height="2.5" fill="${c.wagon}"/><path d="M-3,-3 Q-1.5,-5 2,-3" stroke="${c.wagon}" fill="${c.sail}" opacity="0.5" stroke-width="0.3"/><circle cx="-2" cy="0" r="0.8" fill="${c.trunk}" stroke="${c.fence}" stroke-width="0.2"/><circle cx="1.5" cy="0" r="0.8" fill="${c.trunk}" stroke="${c.fence}" stroke-width="0.2"/></g>`;
}
function svgCathedral(x, y, c, v) {
  return `<g transform="translate(${x},${y})"><polygon points="-3,0 0,1.5 3,0 3,-6 0,-4.5 -3,-6" fill="${c.cathedral}"/><polygon points="-3,0 0,1.5 0,-4.5 -3,-6" fill="${c.wallShade}"/><polygon points="0,-10 -3.5,-5.5 0,-4 3.5,-5.5" fill="${c.roofA}"/><circle cx="0" cy="-7" r="1" fill="${c.cathedralWindow}" opacity="0.7"/><line x1="0" y1="-12" x2="0" y2="-10" stroke="${c.wall}" stroke-width="0.5"/><line x1="-0.8" y1="-11" x2="0.8" y2="-11" stroke="${c.wall}" stroke-width="0.4"/></g>`;
}
function svgLibrary(x, y, c, v) {
  return `<g transform="translate(${x},${y})"><rect x="-2.5" y="-4" width="5" height="4" fill="${c.library}"/><polygon points="-3,-4 0,-6 3,-4" fill="${c.roofB}"/><rect x="-1.5" y="-3.5" width="1" height="1.5" fill="${c.blacksmith}" rx="0.2"/><rect x="0.5" y="-3.5" width="1" height="1.5" fill="${c.blacksmith}" rx="0.2"/></g>`;
}
function svgClocktower(x, y, c, v) {
  return `<g transform="translate(${x},${y})"><rect x="-1.5" y="-10" width="3" height="10" fill="${c.clocktower}"/><polygon points="-2,-10 0,-12.5 2,-10" fill="${c.castleRoof}"/><circle cx="0" cy="-8" r="1.2" fill="${c.clockFace}"/><g><line x1="0" y1="-8" x2="0" y2="-9" stroke="${c.bird}" stroke-width="0.3"/><animateTransform attributeName="transform" type="rotate" values="-15 0 -8;15 0 -8;-15 0 -8" dur="4s" repeatCount="indefinite"/></g><line x1="0" y1="-8" x2="0.6" y2="-7.5" stroke="${c.bird}" stroke-width="0.2"/></g>`;
}
function svgStatue(x, y, c, v) {
  return `<g transform="translate(${x},${y})"><rect x="-1" y="-1.5" width="2" height="1.5" fill="${c.rock}"/><rect x="-0.6" y="-4" width="1.2" height="2.5" fill="${c.statue}"/><circle cx="0" cy="-4.5" r="0.6" fill="${c.statue}"/></g>`;
}
function svgPark(x, y, c, v) {
  return `<g transform="translate(${x},${y})"><line x1="2" y1="0" x2="2" y2="-3" stroke="${c.trunk}" stroke-width="0.5"/><circle cx="2" cy="-4.5" r="2" fill="${c.gardenTree}"/><rect x="-3" y="-1" width="3" height="0.5" fill="${c.parkBench}"/><line x1="-3" y1="-1" x2="-3" y2="0" stroke="${c.parkBench}" stroke-width="0.3"/><line x1="0" y1="-1" x2="0" y2="0" stroke="${c.parkBench}" stroke-width="0.3"/></g>`;
}
function svgWarehouse(x, y, c, v) {
  return `<g transform="translate(${x},${y})"><rect x="-3.5" y="-3.5" width="7" height="3.5" fill="${c.warehouse}"/><polygon points="-4,-3.5 0,-5.5 4,-3.5" fill="${c.roofA}" opacity="0.8"/><rect x="-1" y="-2" width="2" height="2" fill="${c.blacksmith}" opacity="0.5"/></g>`;
}
function svgGatehouse(x, y, c, v) {
  return `<g transform="translate(${x},${y})"><rect x="-2" y="-6" width="4" height="6" fill="${c.gatehouse}"/><rect x="-1" y="-4" width="2" height="4" fill="${c.blacksmith}" rx="1" ry="0"/><rect x="-3" y="-7" width="2" height="1.5" fill="${c.tower}"/><rect x="1" y="-7" width="2" height="1.5" fill="${c.tower}"/></g>`;
}
function svgManor(x, y, c, v) {
  return `<g transform="translate(${x},${y})"><polygon points="-3.5,0 0,1.8 3.5,0 3.5,-4.5 0,-2.7 -3.5,-4.5" fill="${c.manor}"/><polygon points="-3.5,0 0,1.8 0,-2.7 -3.5,-4.5" fill="${c.wallShade}"/><polygon points="0,-7.5 -4,-4.2 0,-2.5 4,-4.2" fill="${c.roofA}"/><rect x="1.5" y="-7.5" width="1" height="1.5" fill="${c.chimney}"/><rect x="-3.5" y="-0.5" width="1" height="0.5" fill="${c.manorGarden}"/></g>`;
}
function svgSignpost(x, y, c, v) {
  return `<g transform="translate(${x},${y})"><line x1="0" y1="0" x2="0" y2="-5" stroke="${c.signpost}" stroke-width="0.5"/><rect x="0" y="-5" width="2.5" height="0.8" fill="${c.signpost}" rx="0.1"/><rect x="-2.5" y="-4" width="2.5" height="0.8" fill="${c.signpost}" rx="0.1"/></g>`;
}
function svgLantern(x, y, c, v) {
  return `<g transform="translate(${x},${y})"><line x1="0" y1="0" x2="0" y2="-4" stroke="${c.lantern}" stroke-width="0.4"/><rect x="-0.5" y="-5" width="1" height="1" fill="${c.lantern}"/><rect x="-0.3" y="-4.8" width="0.6" height="0.6" fill="${c.lanternGlow}" opacity="0.8"/><circle cx="0" cy="-4.5" r="1" fill="${c.lanternGlow}" opacity="0.15"/></g>`;
}
function svgWoodpile(x, y, c, v) {
  return `<g transform="translate(${x},${y})"><rect x="-2" y="-1.5" width="4" height="1.5" fill="${c.woodpile}"/><rect x="-1.8" y="-2.5" width="3.6" height="1" fill="${c.woodpile}"/><ellipse cx="-2" cy="-0.75" rx="0.4" ry="0.75" fill="${c.trunk}"/><ellipse cx="2" cy="-0.75" rx="0.4" ry="0.75" fill="${c.trunk}"/></g>`;
}
function svgPuddle(x, y, c, v) {
  return `<g transform="translate(${x},${y})"><ellipse cx="0" cy="-0.2" rx="2" ry="0.7" fill="${c.puddle}" opacity="0.4"/><ellipse cx="0.3" cy="-0.3" rx="1.2" ry="0.4" fill="${c.puddle}" opacity="0.25"/></g>`;
}
function svgCampfire(x, y, c, v) {
  return `<g transform="translate(${x},${y})"><ellipse cx="0" cy="-0.2" rx="1.5" ry="0.5" fill="${c.rock}" opacity="0.5"/><line x1="-1" y1="-0.3" x2="0" y2="-0.8" stroke="${c.campfire}" stroke-width="0.4"/><line x1="1" y1="-0.3" x2="0" y2="-0.8" stroke="${c.campfire}" stroke-width="0.4"/><ellipse cx="0" cy="-1.8" rx="0.8" ry="1.2" fill="${c.campfireFlame}" opacity="0.8"><animate attributeName="opacity" values="0.8;0.5;0.8" dur="1.5s" repeatCount="indefinite"/></ellipse><ellipse cx="0" cy="-2" rx="0.4" ry="0.7" fill="${c.lanternGlow}" opacity="0.9"/></g>`;
}
function svgSnowPine(x, y, c, v) {
  const snow = c.snowCap;
  const trunk = c.trunk;
  const icicle = c.icicleBlue || "#d0e8f8";
  if (v === 1) {
    return `<g transform="translate(${x},${y})"><rect x="-0.5" y="-1" width="1" height="3" fill="${trunk}"/><polygon points="0,-8 -3,-2 3,-2" fill="${c.pine}" opacity="0.6"/><polygon points="0,-8 -3,-2 3,-2" fill="${snow}" opacity="0.55"/><polygon points="0,-6 -2.5,-1.5 2.5,-1.5" fill="${snow}" opacity="0.6"/><ellipse cx="0" cy="-8" rx="1.5" ry="0.5" fill="${snow}"/><line x1="-2" y1="-3" x2="-2" y2="-2" stroke="${icicle}" stroke-width="0.12"/><line x1="-1" y1="-4" x2="-1" y2="-3" stroke="${icicle}" stroke-width="0.1"/><line x1="1.5" y1="-3.5" x2="1.5" y2="-2.5" stroke="${icicle}" stroke-width="0.12"/></g>`;
  }
  if (v === 2) {
    return `<g transform="translate(${x},${y})"><rect x="-0.5" y="-1" width="1" height="3" fill="${trunk}"/><polygon points="0,-7.5 -3.5,-1 3.5,-1" fill="${c.ice}" opacity="0.5"/><polygon points="0,-6 -2.5,-2 2.5,-2" fill="${c.pine}" opacity="0.4"/><polygon points="0,-7.5 -2.5,-2.5 2.5,-2.5" fill="${snow}" opacity="0.45"/><ellipse cx="0" cy="-7.5" rx="1.2" ry="0.4" fill="${snow}"/><ellipse cx="-2" cy="-2.5" rx="0.8" ry="0.25" fill="${snow}" opacity="0.5"/><ellipse cx="2" cy="-2.5" rx="0.8" ry="0.25" fill="${snow}" opacity="0.5"/></g>`;
  }
  return `<g transform="translate(${x},${y})"><rect x="-0.5" y="-1" width="1" height="3" fill="${trunk}"/><polygon points="0,-7 -3,-1 3,-1" fill="${c.pine}"/><polygon points="0,-7 -1.5,-4 1.5,-4" fill="${snow}" opacity="0.45"/><ellipse cx="0.5" cy="-6" rx="1" ry="0.3" fill="${snow}" opacity="0.5"/><ellipse cx="-1.5" cy="-3" rx="0.7" ry="0.25" fill="${snow}" opacity="0.4"/><line x1="-2" y1="-2.5" x2="-2" y2="-1.8" stroke="${icicle}" stroke-width="0.08" opacity="0.7"/><line x1="2" y1="-2.5" x2="2" y2="-1.8" stroke="${icicle}" stroke-width="0.08" opacity="0.7"/></g>`;
}
function svgSnowDeciduous(x, y, c, v) {
  const branch = c.bareBranch;
  const snow = c.snowCap;
  if (v === 1) {
    return `<g transform="translate(${x},${y})"><line x1="0" y1="2" x2="0" y2="-5" stroke="${branch}" stroke-width="0.8"/><line x1="0" y1="-2" x2="-2" y2="-4" stroke="${branch}" stroke-width="0.4"/><line x1="0" y1="-3" x2="1.5" y2="-5" stroke="${branch}" stroke-width="0.4"/><line x1="0" y1="-1" x2="2" y2="-2.5" stroke="${branch}" stroke-width="0.4"/><ellipse cx="-1.5" cy="-4.2" rx="1" ry="0.4" fill="${snow}" opacity="0.6"/><ellipse cx="1.2" cy="-5.2" rx="0.8" ry="0.3" fill="${snow}" opacity="0.5"/></g>`;
  }
  if (v === 2) {
    return `<g transform="translate(${x},${y})"><rect x="-0.6" y="-1" width="1.2" height="3.5" fill="${branch}"/><line x1="0" y1="-1" x2="-3" y2="-3.5" stroke="${branch}" stroke-width="0.6"/><line x1="0" y1="-1.5" x2="2.5" y2="-4" stroke="${branch}" stroke-width="0.6"/><line x1="0" y1="0" x2="-2.5" y2="-1.5" stroke="${branch}" stroke-width="0.5"/><line x1="0" y1="0" x2="3" y2="-2" stroke="${branch}" stroke-width="0.5"/><ellipse cx="-2.5" cy="-3.7" rx="1.2" ry="0.5" fill="${snow}" opacity="0.55"/><ellipse cx="2" cy="-4.2" rx="1" ry="0.4" fill="${snow}" opacity="0.5"/><ellipse cx="0" cy="-2" rx="1.5" ry="0.4" fill="${snow}" opacity="0.4"/></g>`;
  }
  return `<g transform="translate(${x},${y})"><line x1="0" y1="2" x2="0" y2="-4" stroke="${branch}" stroke-width="0.7"/><line x1="0" y1="-1.5" x2="-2.5" y2="-3.5" stroke="${branch}" stroke-width="0.4"/><line x1="0" y1="-2.5" x2="2" y2="-4.5" stroke="${branch}" stroke-width="0.4"/><line x1="0" y1="-0.5" x2="2" y2="-2" stroke="${branch}" stroke-width="0.4"/><ellipse cx="-2" cy="-3.7" rx="1" ry="0.35" fill="${snow}" opacity="0.5"/><ellipse cx="1.8" cy="-4.7" rx="0.8" ry="0.3" fill="${snow}" opacity="0.5"/></g>`;
}
function svgSnowman(x, y, c, v) {
  const body = c.snowCap;
  const coal = c.snowmanCoal;
  const carrot = c.snowmanCarrot;
  const scarf = c.scarfRed;
  if (v === 1) {
    return `<g transform="translate(${x},${y})"><circle cx="0" cy="0" r="2.2" fill="${body}"/><circle cx="0" cy="-2.8" r="1.6" fill="${body}"/><circle cx="0" cy="-4.8" r="1.1" fill="${body}"/><circle cx="-0.4" cy="-5" r="0.2" fill="${coal}"/><circle cx="0.4" cy="-5" r="0.2" fill="${coal}"/><polygon points="0,-4.8 1.2,-4.6 0,-4.5" fill="${carrot}"/><rect x="-1" y="-3.6" width="2" height="0.4" rx="0.2" fill="${scarf}"/><line x1="2" y1="-3" x2="3.5" y2="-6" stroke="${c.bareBranch}" stroke-width="0.4"/><line x1="3.2" y1="-5.5" x2="3.8" y2="-6.5" stroke="${c.bareBranch}" stroke-width="0.3"/><line x1="3.2" y1="-5.5" x2="3.8" y2="-5.2" stroke="${c.bareBranch}" stroke-width="0.3"/></g>`;
  }
  if (v === 2) {
    return `<g transform="translate(${x},${y})"><ellipse cx="0" cy="0.5" rx="2.8" ry="1.5" fill="${body}"/><circle cx="0" cy="-1.5" r="1.8" fill="${body}"/><circle cx="0" cy="-3.2" r="1" fill="${body}"/><circle cx="-0.3" cy="-3.4" r="0.15" fill="${coal}"/><circle cx="0.3" cy="-3.4" r="0.15" fill="${coal}"/><polygon points="0,-3.2 1,-3 0,-2.9" fill="${carrot}"/><ellipse cx="0" cy="1.5" rx="3" ry="0.5" fill="${c.ice}" opacity="0.3"/></g>`;
  }
  return `<g transform="translate(${x},${y})"><circle cx="0" cy="0" r="2" fill="${body}"/><circle cx="0" cy="-2.5" r="1.5" fill="${body}"/><circle cx="0" cy="-4.3" r="1" fill="${body}"/><circle cx="-0.35" cy="-4.5" r="0.18" fill="${coal}"/><circle cx="0.35" cy="-4.5" r="0.18" fill="${coal}"/><polygon points="0,-4.3 1.2,-4.1 0,-4" fill="${carrot}"/><circle cx="0" cy="-2.2" r="0.15" fill="${coal}"/><circle cx="0" cy="-2.7" r="0.15" fill="${coal}"/><rect x="-1" y="-3.2" width="2" height="0.35" rx="0.15" fill="${scarf}"/><rect x="-1.2" y="-5.5" width="2.4" height="0.5" fill="${coal}"/><rect x="-0.8" y="-6" width="1.6" height="0.6" fill="${coal}"/></g>`;
}
function svgHouseWinter(x, y, c, v) {
  const snow = c.snowCap;
  const warmGlow = "#ffa040";
  if (v === 1) {
    return `<g transform="translate(${x},${y})"><polygon points="-2.5,0 0,1.2 2.5,0 2.5,-3 0,-1.8 -2.5,-3" fill="${c.wall}"/><polygon points="-2.5,0 0,1.2 0,-1.8 -2.5,-3" fill="${c.wallShade}"/><polygon points="0,-6 -3.2,-2.8 0,-1.5 3.2,-2.8" fill="${c.roofA}"/><polygon points="0,-6.3 -3.4,-2.6 -3.2,-2.8 0,-6" fill="${snow}" opacity="0.9"/><polygon points="0,-6.3 3.4,-2.6 3.2,-2.8 0,-6" fill="${snow}" opacity="0.85"/><rect x="1" y="-6.5" width="1" height="2" fill="${c.chimney}"/><ellipse cx="1.5" cy="-6.8" rx="0.6" ry="0.25" fill="${snow}"/><line x1="-2.8" y1="-2.5" x2="-2.8" y2="-1.8" stroke="${c.icicleBlue || "#d0e8f8"}" stroke-width="0.15"/><line x1="-2.2" y1="-2.3" x2="-2.2" y2="-1.5" stroke="${c.icicleBlue || "#d0e8f8"}" stroke-width="0.12"/><line x1="2.5" y1="-2.4" x2="2.5" y2="-1.6" stroke="${c.icicleBlue || "#d0e8f8"}" stroke-width="0.15"/><rect x="-1" y="-1.5" width="0.6" height="0.6" fill="${warmGlow}" opacity="0.6"/></g>`;
  }
  if (v === 2) {
    return `<g transform="translate(${x},${y})"><polygon points="-2.5,0 0,1.2 2.5,0 2.5,-3 0,-1.8 -2.5,-3" fill="${c.wall}"/><polygon points="-2.5,0 0,1.2 0,-1.8 -2.5,-3" fill="${c.wallShade}"/><polygon points="0,-6 -3.2,-2.8 0,-1.5 3.2,-2.8" fill="${c.roofA}"/><polygon points="0,-6.5 -3.5,-2.5 -3.2,-2.8 0,-6" fill="${snow}"/><polygon points="0,-6.5 3.5,-2.5 3.2,-2.8 0,-6" fill="${snow}" opacity="0.95"/><ellipse cx="-2" cy="-2.6" rx="0.8" ry="0.3" fill="${snow}"/><ellipse cx="2" cy="-2.6" rx="0.8" ry="0.3" fill="${snow}"/><rect x="1" y="-6.5" width="1" height="2" fill="${c.chimney}"/><ellipse cx="1.5" cy="-6.8" rx="0.8" ry="0.35" fill="${snow}"/></g>`;
  }
  return `<g transform="translate(${x},${y})"><polygon points="-2.5,0 0,1.2 2.5,0 2.5,-3 0,-1.8 -2.5,-3" fill="${c.wall}"/><polygon points="-2.5,0 0,1.2 0,-1.8 -2.5,-3" fill="${c.wallShade}"/><polygon points="0,-6 -3.2,-2.8 0,-1.5 3.2,-2.8" fill="${c.roofA}"/><polygon points="0,-6.2 -3.3,-2.7 -3.2,-2.8 0,-6" fill="${snow}" opacity="0.85"/><polygon points="0,-6.2 3.3,-2.7 3.2,-2.8 0,-6" fill="${snow}" opacity="0.8"/><rect x="1" y="-6.5" width="1" height="2" fill="${c.chimney}"/><ellipse cx="1.5" cy="-6.7" rx="0.5" ry="0.2" fill="${snow}"/><rect x="-0.8" y="-1.3" width="0.5" height="0.5" fill="${warmGlow}" opacity="0.5"/></g>`;
}
function svgHouseBWinter(x, y, c, v) {
  return svgHouseWinter(x, y, c, v);
}
function svgBarnWinter(x, y, c, v) {
  const snow = c.snowCap;
  if (v === 1) {
    return `<g transform="translate(${x},${y})"><polygon points="-4,0 0,2 4,0 4,-4.5 0,-2.5 -4,-4.5" fill="${c.roofA}" opacity="0.9"/><polygon points="-4,0 0,2 0,-2.5 -4,-4.5" fill="${c.wallShade}"/><polygon points="0,-7.5 -4.5,-4 0,-2.2 4.5,-4" fill="${c.roofA}"/><polygon points="0,-7.8 -4.7,-3.8 -4.5,-4 0,-7.5" fill="${snow}"/><polygon points="0,-7.8 4.7,-3.8 4.5,-4 0,-7.5" fill="${snow}" opacity="0.95"/><ellipse cx="-3.5" cy="-4" rx="1" ry="0.35" fill="${snow}"/><ellipse cx="3.5" cy="-4" rx="1" ry="0.35" fill="${snow}"/><rect x="-0.5" y="-1.5" width="1" height="1.5" fill="${c.trunk}" opacity="0.5"/></g>`;
  }
  return `<g transform="translate(${x},${y})"><polygon points="-3,0 0,1.5 3,0 3,-3.5 0,-2 -3,-3.5" fill="${c.roofA}" opacity="0.8"/><polygon points="-3,0 0,1.5 0,-2 -3,-3.5" fill="${c.wallShade}"/><polygon points="0,-6 -3.5,-3.2 0,-1.8 3.5,-3.2" fill="${c.roofA}"/><polygon points="0,-6.3 -3.7,-3 -3.5,-3.2 0,-6" fill="${snow}"/><polygon points="0,-6.3 3.7,-3 3.5,-3.2 0,-6" fill="${snow}" opacity="0.9"/><ellipse cx="0" cy="-6" rx="0.5" ry="0.2" fill="${snow}"/></g>`;
}
function svgChurchWinter(x, y, c, v) {
  const snow = c.snowCap;
  if (v === 1) {
    return `<g transform="translate(${x},${y})"><polygon points="-2,0 0,1 2,0 2,-5 0,-4 -2,-5" fill="${c.church}"/><polygon points="-2,0 0,1 0,-4 -2,-5" fill="${c.wallShade}"/><rect x="-1" y="-8.5" width="2" height="3.5" fill="${c.church}"/><polygon points="-1.3,-8.5 0,-10.5 1.3,-8.5" fill="${c.roofA}"/><polygon points="-1.4,-8.3 0,-10.8 0,-10.5 -1.3,-8.5" fill="${snow}"/><polygon points="1.4,-8.3 0,-10.8 0,-10.5 1.3,-8.5" fill="${snow}" opacity="0.9"/><ellipse cx="0" cy="-8.5" rx="1.2" ry="0.3" fill="${snow}"/><circle cx="0" cy="-7" r="0.4" fill="${c.blacksmith}" opacity="0.5"/></g>`;
  }
  return `<g transform="translate(${x},${y})"><polygon points="-2,0 0,1 2,0 2,-5 0,-4 -2,-5" fill="${c.church}"/><polygon points="-2,0 0,1 0,-4 -2,-5" fill="${c.wallShade}"/><polygon points="0,-10 -2.5,-5 0,-3.8 2.5,-5" fill="${c.roofA}"/><polygon points="0,-10.4 -2.7,-4.8 -2.5,-5 0,-10" fill="${snow}"/><polygon points="0,-10.4 2.7,-4.8 2.5,-5 0,-10" fill="${snow}" opacity="0.9"/><ellipse cx="0" cy="-5" rx="2" ry="0.4" fill="${snow}"/><line x1="0" y1="-12" x2="0" y2="-10" stroke="${c.wall}" stroke-width="0.5"/><line x1="-1" y1="-11" x2="1" y2="-11" stroke="${c.wall}" stroke-width="0.5"/></g>`;
}
function svgChristmasTree(x, y, c, v) {
  const tree = c.christmasGreen || "#228b22";
  const star = c.christmasGold || "#ffd700";
  const red = c.christmasRed || "#c41e3a";
  const blue = c.icicleBlue || "#d0e8f8";
  const gold = c.christmasGold || "#ffd700";
  if (v === 1) {
    return `<g transform="translate(${x},${y})"><rect x="-0.3" y="-1" width="0.6" height="2" fill="${c.trunk}"/><polygon points="0,-7 -2.5,-1 2.5,-1" fill="${tree}"/><polygon points="0,-5.5 -2,-1.5 2,-1.5" fill="${tree}" opacity="0.9"/><polygon points="0,-4 -1.5,-2 1.5,-2" fill="${tree}" opacity="0.85"/><polygon points="-0.3,-7.5 0,-8 0.3,-7.5 0.1,-7.5 0.1,-7 -0.1,-7 -0.1,-7.5" fill="${star}"/><circle cx="-1" cy="-3" r="0.25" fill="${red}"/><circle cx="0.8" cy="-2.5" r="0.2" fill="${blue}"/><circle cx="-0.5" cy="-4.5" r="0.2" fill="${gold}"/><circle cx="0.5" cy="-5" r="0.25" fill="${red}"/><rect x="-1.5" y="0.5" width="0.8" height="0.6" fill="${red}"/><rect x="0.5" y="0.3" width="0.7" height="0.5" fill="${blue}"/></g>`;
  }
  if (v === 2) {
    return `<g transform="translate(${x},${y})"><rect x="-0.3" y="-1" width="0.6" height="2" fill="${c.trunk}"/><polygon points="0,-7 -2.5,-1 2.5,-1" fill="${tree}"/><polygon points="0,-5.5 -2,-1.5 2,-1.5" fill="${tree}" opacity="0.9"/><polygon points="-0.3,-7.5 0,-8 0.3,-7.5 0.1,-7.5 0.1,-7 -0.1,-7 -0.1,-7.5" fill="${star}"/><circle cx="-1.5" cy="-2" r="0.15" fill="${red}"/><circle cx="-0.5" cy="-2.5" r="0.15" fill="${gold}"/><circle cx="0.5" cy="-2" r="0.15" fill="${blue}"/><circle cx="1.5" cy="-2.5" r="0.15" fill="${red}"/><circle cx="-1" cy="-4" r="0.15" fill="${blue}"/><circle cx="0" cy="-3.5" r="0.15" fill="${gold}"/><circle cx="1" cy="-4" r="0.15" fill="${red}"/><circle cx="-0.5" cy="-5.5" r="0.15" fill="${gold}"/><circle cx="0.5" cy="-5" r="0.15" fill="${blue}"/></g>`;
  }
  return `<g transform="translate(${x},${y})"><rect x="-0.3" y="-1" width="0.6" height="2" fill="${c.trunk}"/><polygon points="0,-7 -2.5,-1 2.5,-1" fill="${tree}"/><polygon points="0,-5.5 -2,-1.5 2,-1.5" fill="${tree}" opacity="0.9"/><polygon points="0,-4 -1.5,-2 1.5,-2" fill="${tree}" opacity="0.85"/><polygon points="-0.3,-7.5 0,-8.2 0.3,-7.5 0.1,-7.5 0.1,-7 -0.1,-7 -0.1,-7.5" fill="${star}"/><circle cx="-1.2" cy="-2.5" r="0.3" fill="${red}"/><circle cx="1" cy="-3" r="0.25" fill="${gold}"/><circle cx="-0.3" cy="-4" r="0.25" fill="${blue}"/><circle cx="0.7" cy="-5" r="0.2" fill="${red}"/><circle cx="-0.5" cy="-5.8" r="0.2" fill="${gold}"/></g>`;
}
function svgWinterLantern(x, y, c, v) {
  const post = c.lantern;
  const glow = c.lanternGlow;
  const snow = c.snowCap;
  if (v === 1) {
    return `<g transform="translate(${x},${y})"><line x1="0" y1="0" x2="0" y2="-5" stroke="${post}" stroke-width="0.4"/><line x1="0" y1="-4.5" x2="-1.5" y2="-4.5" stroke="${post}" stroke-width="0.25"/><line x1="0" y1="-4.5" x2="1.5" y2="-4.5" stroke="${post}" stroke-width="0.25"/><rect x="-2" y="-5.5" width="1" height="1" fill="${glow}" opacity="0.8"/><rect x="1" y="-5.5" width="1" height="1" fill="${glow}" opacity="0.8"/><ellipse cx="-1.5" cy="-5.7" rx="0.6" ry="0.2" fill="${snow}"/><ellipse cx="1.5" cy="-5.7" rx="0.6" ry="0.2" fill="${snow}"/><circle cx="-1.5" cy="-5" r="0.8" fill="${glow}" opacity="0.3"/><circle cx="1.5" cy="-5" r="0.8" fill="${glow}" opacity="0.3"/></g>`;
  }
  return `<g transform="translate(${x},${y})"><line x1="0" y1="0" x2="0" y2="-5" stroke="${post}" stroke-width="0.35"/><rect x="-0.5" y="-6" width="1" height="1.2" fill="${glow}" opacity="0.8"/><ellipse cx="0" cy="-6.2" rx="0.6" ry="0.25" fill="${snow}"/><circle cx="0" cy="-5.4" r="1" fill="${glow}" opacity="0.25"/><ellipse cx="0" cy="0" rx="0.8" ry="0.3" fill="${snow}" opacity="0.5"/></g>`;
}
function svgFrozenFountain(x, y, c, v) {
  const stone = c.fountain;
  const ice = c.ice;
  const icicle = c.icicleBlue || "#d0e8f8";
  if (v === 1) {
    return `<g transform="translate(${x},${y})"><ellipse cx="0" cy="0" rx="2.5" ry="1" fill="${stone}"/><ellipse cx="0" cy="-0.3" rx="2" ry="0.7" fill="${ice}" opacity="0.7"/><rect x="-0.4" y="-3" width="0.8" height="3" fill="${stone}"/><ellipse cx="0" cy="-3" rx="1" ry="0.4" fill="${stone}"/><polygon points="0,-5 -0.3,-3 0.3,-3" fill="${ice}"/><polygon points="-0.5,-4 -0.2,-3 -0.8,-3" fill="${icicle}"/><polygon points="0.5,-4.5 0.2,-3 0.8,-3" fill="${icicle}"/><polygon points="-1.5,-1 -1.5,-0.3 -1.3,-0.3" fill="${icicle}" opacity="0.8"/><polygon points="1.5,-1.2 1.5,-0.3 1.3,-0.3" fill="${icicle}" opacity="0.8"/></g>`;
  }
  return `<g transform="translate(${x},${y})"><ellipse cx="0" cy="0" rx="2.5" ry="1" fill="${stone}"/><ellipse cx="0" cy="-0.3" rx="2" ry="0.7" fill="${ice}" opacity="0.6"/><rect x="-0.4" y="-3" width="0.8" height="3" fill="${stone}"/><ellipse cx="0" cy="-3" rx="1" ry="0.4" fill="${stone}"/><polygon points="-0.4,-3.8 -0.1,-3 -0.7,-3" fill="${icicle}" opacity="0.7"/><polygon points="0.4,-4 0.1,-3 0.7,-3" fill="${icicle}" opacity="0.7"/></g>`;
}
function svgSnowdrift(x, y, c, v) {
  const snow = c.snowCap;
  if (v === 1) {
    return `<g transform="translate(${x},${y})"><ellipse cx="0" cy="0" rx="3.5" ry="1.2" fill="${snow}"/><ellipse cx="-1" cy="-0.5" rx="2" ry="0.8" fill="${c.frostWhite}" opacity="0.6"/></g>`;
  }
  if (v === 2) {
    return `<g transform="translate(${x},${y})"><path d="M-3,0 Q-1,-1.5 2,-0.5 Q3,0 3.5,0.3" fill="${snow}" stroke="none"/><ellipse cx="0" cy="0.2" rx="3" ry="0.6" fill="${snow}" opacity="0.8"/></g>`;
  }
  return `<g transform="translate(${x},${y})"><ellipse cx="0" cy="0" rx="2" ry="0.8" fill="${snow}"/><ellipse cx="0.3" cy="-0.3" rx="1.2" ry="0.5" fill="${c.frostWhite}" opacity="0.5"/></g>`;
}
function svgIgloo(x, y, c, v) {
  const block = c.igloo;
  const ice = c.ice;
  if (v === 1) {
    return `<g transform="translate(${x},${y})"><path d="M-3.5,0.5 Q-3.5,-3 0,-3.5 Q3.5,-3 3.5,0.5 Z" fill="${block}"/><path d="M-1,0.5 Q-1,-0.5 0,-0.8 Q1,-0.5 1,0.5 Z" fill="${ice}" opacity="0.5"/><line x1="-2" y1="-1" x2="2" y2="-1" stroke="${ice}" stroke-width="0.2" opacity="0.4"/><line x1="-2.5" y1="0" x2="2.5" y2="0" stroke="${ice}" stroke-width="0.2" opacity="0.4"/><path d="M2,0.5 Q2.5,0.3 3,0.5 Q3,-0.2 2.5,-0.3 Q2,-0.2 2,0.5 Z" fill="${block}" opacity="0.8"/></g>`;
  }
  if (v === 2) {
    return `<g transform="translate(${x},${y})"><path d="M-3,0.5 Q-3,-1.5 0,-2 Q2,-1.5 2,0.5 Z" fill="${block}"/><rect x="2.5" y="-0.5" width="1" height="0.5" fill="${block}" opacity="0.7"/><rect x="2" y="0" width="1.2" height="0.5" fill="${block}" opacity="0.6"/><line x1="-1.5" y1="0" x2="1.5" y2="0" stroke="${ice}" stroke-width="0.2" opacity="0.3"/></g>`;
  }
  return `<g transform="translate(${x},${y})"><path d="M-3,0.5 Q-3,-3 0,-3.5 Q3,-3 3,0.5 Z" fill="${block}"/><line x1="-2" y1="-1" x2="2" y2="-1" stroke="${ice}" stroke-width="0.2" opacity="0.4"/><line x1="-2.5" y1="0" x2="2.5" y2="0" stroke="${ice}" stroke-width="0.2" opacity="0.4"/><line x1="-1" y1="-2" x2="1" y2="-2" stroke="${ice}" stroke-width="0.2" opacity="0.3"/></g>`;
}
function svgFrozenPond(x, y, c, v) {
  const ice = c.ice;
  const crack = c.frozenWater;
  if (v === 1) {
    return `<g transform="translate(${x},${y})"><ellipse cx="0" cy="0" rx="3" ry="1.2" fill="${ice}" opacity="0.7"/><line x1="-1" y1="-0.3" x2="1.5" y2="0.5" stroke="${crack}" stroke-width="0.3" opacity="0.5"/><line x1="0" y1="-0.5" x2="0.5" y2="0.8" stroke="${crack}" stroke-width="0.2" opacity="0.4"/><ellipse cx="0.5" cy="-0.2" rx="0.8" ry="0.3" fill="#fff" opacity="0.2"/></g>`;
  }
  if (v === 2) {
    return `<g transform="translate(${x},${y})"><ellipse cx="0" cy="0" rx="2.5" ry="1" fill="${ice}" opacity="0.5"/><ellipse cx="0" cy="0" rx="1.5" ry="0.6" fill="${crack}" opacity="0.3"/><ellipse cx="0.3" cy="-0.1" rx="0.5" ry="0.2" fill="#fff" opacity="0.15"/></g>`;
  }
  return `<g transform="translate(${x},${y})"><ellipse cx="0" cy="0" rx="3" ry="1.2" fill="${ice}" opacity="0.7"/><ellipse cx="0.5" cy="-0.2" rx="1.2" ry="0.5" fill="#fff" opacity="0.15"/></g>`;
}
function svgIcicle(x, y, c, v) {
  const ice = c.icicle;
  if (v === 1) {
    return `<g transform="translate(${x},${y})"><polygon points="-1.5,-1 -1.2,-1 -1,-3" fill="${ice}" opacity="0.7"/><polygon points="-0.3,-1 0,-1 0.2,-3.5" fill="${ice}" opacity="0.8"/><polygon points="0.8,-1 1.1,-1 1.2,-2.5" fill="${ice}" opacity="0.7"/></g>`;
  }
  if (v === 2) {
    return `<g transform="translate(${x},${y})"><polygon points="-0.5,-1 0.5,-1 0.2,-3.5 -0.2,-3.5" fill="${ice}" opacity="0.8"/><ellipse cx="0" cy="-1" rx="0.6" ry="0.2" fill="${ice}" opacity="0.5"/></g>`;
  }
  return `<g transform="translate(${x},${y})"><polygon points="-0.2,-1 0.2,-1 0,-3" fill="${ice}" opacity="0.8"/></g>`;
}
function svgSled(x, y, c, v) {
  const wood = c.sledWood;
  const runner = c.sledRunner;
  if (v === 1) {
    return `<g transform="translate(${x},${y})"><rect x="-2.5" y="-1" width="5" height="0.5" rx="0.2" fill="${wood}"/><path d="M-2.5,-0.5 Q-3,-0.5 -3,0 L-2.5,0.2" fill="none" stroke="${runner}" stroke-width="0.4"/><path d="M2.5,-0.5 Q3,-0.5 3,0 L2.5,0.2" fill="none" stroke="${runner}" stroke-width="0.4"/><rect x="-1.5" y="-2.2" width="1.5" height="1.2" fill="${c.scarfRed}" rx="0.2"/><rect x="0.3" y="-1.8" width="1" height="0.8" fill="${c.sproutGreen || "#4a8828"}" rx="0.2"/></g>`;
  }
  if (v === 2) {
    return `<g transform="translate(${x},${y})"><rect x="-2.5" y="-1" width="5" height="0.5" rx="0.2" fill="${wood}"/><path d="M-2.5,-0.5 Q-3,-0.5 -3,0 L-2.5,0.2" fill="none" stroke="${runner}" stroke-width="0.4"/><path d="M2.5,-0.5 Q3,-0.5 3,0 L2.5,0.2" fill="none" stroke="${runner}" stroke-width="0.4"/><line x1="-3" y1="0.3" x2="3" y2="0.3" stroke="${runner}" stroke-width="0.15" opacity="0.3"/><line x1="-3" y1="0.5" x2="3" y2="0.5" stroke="${runner}" stroke-width="0.15" opacity="0.2"/></g>`;
  }
  return `<g transform="translate(${x},${y})"><rect x="-2.5" y="-1" width="5" height="0.5" rx="0.2" fill="${wood}"/><path d="M-2.5,-0.5 Q-3,-0.5 -3,0 L-2.5,0.2" fill="none" stroke="${runner}" stroke-width="0.4"/><path d="M2.5,-0.5 Q3,-0.5 3,0 L2.5,0.2" fill="none" stroke="${runner}" stroke-width="0.4"/><line x1="-2" y1="-1" x2="-2" y2="-0.5" stroke="${wood}" stroke-width="0.3"/><line x1="2" y1="-1" x2="2" y2="-0.5" stroke="${wood}" stroke-width="0.3"/></g>`;
}
function svgSnowCoveredRock(x, y, c, v) {
  const rock = c.rock;
  const snow = c.snowCap;
  if (v === 1) {
    return `<g transform="translate(${x},${y})"><ellipse cx="0" cy="0" rx="2.5" ry="1.2" fill="${rock}"/><ellipse cx="0" cy="-0.8" rx="2" ry="0.6" fill="${snow}" opacity="0.7"/></g>`;
  }
  if (v === 2) {
    return `<g transform="translate(${x},${y})"><ellipse cx="0" cy="0" rx="3" ry="1.5" fill="${c.boulder}"/><ellipse cx="-0.5" cy="-0.5" rx="2" ry="1" fill="${rock}"/><ellipse cx="-0.3" cy="-1" rx="2" ry="0.7" fill="${snow}" opacity="0.6"/></g>`;
  }
  return `<g transform="translate(${x},${y})"><ellipse cx="0" cy="0" rx="1.5" ry="0.8" fill="${rock}"/><ellipse cx="0" cy="-0.5" rx="1.2" ry="0.4" fill="${snow}" opacity="0.6"/></g>`;
}
function svgBareBush(x, y, c, v) {
  const branch = c.bareBranch;
  const frost = c.frostWhite;
  if (v === 1) {
    return `<g transform="translate(${x},${y})"><line x1="0" y1="0.5" x2="-2" y2="-2" stroke="${branch}" stroke-width="0.4"/><line x1="0" y1="0.5" x2="2" y2="-1.5" stroke="${branch}" stroke-width="0.4"/><line x1="0" y1="0.5" x2="0" y2="-2.5" stroke="${branch}" stroke-width="0.5"/><line x1="-1" y1="-1.2" x2="-2.5" y2="-2" stroke="${branch}" stroke-width="0.3"/><line x1="1" y1="-0.8" x2="2.5" y2="-1.5" stroke="${branch}" stroke-width="0.3"/><circle cx="-2" cy="-2" r="0.3" fill="${frost}" opacity="0.4"/><circle cx="2" cy="-1.5" r="0.3" fill="${frost}" opacity="0.4"/></g>`;
  }
  if (v === 2) {
    return `<g transform="translate(${x},${y})"><line x1="0" y1="0.5" x2="-1.5" y2="-2" stroke="${branch}" stroke-width="0.4"/><line x1="0" y1="0.5" x2="1.5" y2="-1.8" stroke="${branch}" stroke-width="0.4"/><line x1="0" y1="0.5" x2="0" y2="-2.5" stroke="${branch}" stroke-width="0.5"/><circle cx="-1" cy="-1.8" r="0.25" fill="${c.scarfRed}"/><circle cx="0.5" cy="-2" r="0.25" fill="${c.scarfRed}"/><circle cx="1" cy="-1.2" r="0.25" fill="${c.scarfRed}"/></g>`;
  }
  return `<g transform="translate(${x},${y})"><line x1="0" y1="0.5" x2="-1.5" y2="-1.5" stroke="${branch}" stroke-width="0.4"/><line x1="0" y1="0.5" x2="1.5" y2="-1.5" stroke="${branch}" stroke-width="0.4"/><line x1="0" y1="0.5" x2="0" y2="-2" stroke="${branch}" stroke-width="0.5"/><circle cx="0" cy="-2" r="0.3" fill="${frost}" opacity="0.3"/></g>`;
}
function svgWinterBird(x, y, c, v) {
  if (v === 1) {
    return `<g transform="translate(${x},${y})"><ellipse cx="0" cy="-1" rx="1.2" ry="0.8" fill="${c.winterBirdBrown}"/><circle cx="-0.8" cy="-1.5" r="0.5" fill="${c.winterBirdBrown}"/><circle cx="-1" cy="-1.6" r="0.12" fill="#fff"/><circle cx="-1" cy="-1.6" r="0.06" fill="#222"/><polygon points="-1.3,-1.5 -1.8,-1.4 -1.3,-1.3" fill="${c.snowmanCarrot}"/><ellipse cx="0.3" cy="-0.8" rx="0.6" ry="0.4" fill="${c.scarfRed}" opacity="0.7"/></g>`;
  }
  if (v === 2) {
    return `<g transform="translate(${x},${y})"><ellipse cx="0" cy="-1" rx="1" ry="0.7" fill="${c.winterBirdBrown}" opacity="0.8"/><circle cx="-0.6" cy="-1.4" r="0.45" fill="${c.winterBirdBrown}" opacity="0.9"/><circle cx="-0.8" cy="-1.5" r="0.1" fill="#222"/><polygon points="-1,-1.4 -1.5,-1.3 -1,-1.2" fill="${c.snowmanCarrot}" opacity="0.8"/></g>`;
  }
  return `<g transform="translate(${x},${y})"><ellipse cx="0" cy="-1" rx="1.2" ry="0.8" fill="${c.winterBirdRed}"/><circle cx="-0.8" cy="-1.5" r="0.55" fill="${c.winterBirdRed}"/><polygon points="-0.6,-2 -0.5,-2.5 -0.3,-2" fill="${c.winterBirdRed}"/><circle cx="-1" cy="-1.6" r="0.12" fill="#fff"/><circle cx="-1" cy="-1.6" r="0.06" fill="#222"/><polygon points="-1.3,-1.5 -1.8,-1.4 -1.3,-1.3" fill="${c.snowmanCarrot}"/><circle cx="-0.5" cy="-1.3" r="0.25" fill="#222" opacity="0.5"/></g>`;
}
function svgFirewood(x, y, c, v) {
  const log = c.firewoodLog;
  const snow = c.snowCap;
  if (v === 1) {
    return `<g transform="translate(${x},${y})"><ellipse cx="-0.8" cy="0" rx="0.6" ry="0.35" fill="${log}"/><ellipse cx="0.8" cy="0" rx="0.6" ry="0.35" fill="${log}"/><ellipse cx="0" cy="0" rx="0.6" ry="0.35" fill="${log}"/><ellipse cx="-0.4" cy="-0.6" rx="0.6" ry="0.35" fill="${log}"/><ellipse cx="0.4" cy="-0.6" rx="0.6" ry="0.35" fill="${log}"/><ellipse cx="0" cy="-1.2" rx="0.6" ry="0.35" fill="${log}"/><ellipse cx="0" cy="-1.5" rx="1.5" ry="0.3" fill="${snow}" opacity="0.5"/></g>`;
  }
  if (v === 2) {
    return `<g transform="translate(${x},${y})"><line x1="-2" y1="0.5" x2="-2" y2="-2" stroke="${c.bareBranch}" stroke-width="0.4"/><line x1="2" y1="0.5" x2="2" y2="-2" stroke="${c.bareBranch}" stroke-width="0.4"/><line x1="-2.2" y1="-2" x2="2.2" y2="-2" stroke="${c.bareBranch}" stroke-width="0.5"/><ellipse cx="-0.5" cy="0" rx="0.5" ry="0.3" fill="${log}"/><ellipse cx="0.5" cy="0" rx="0.5" ry="0.3" fill="${log}"/><ellipse cx="0" cy="-0.5" rx="0.5" ry="0.3" fill="${log}"/></g>`;
  }
  return `<g transform="translate(${x},${y})"><ellipse cx="-0.5" cy="0" rx="0.5" ry="0.3" fill="${log}"/><ellipse cx="0.5" cy="0" rx="0.5" ry="0.3" fill="${log}"/><ellipse cx="0" cy="-0.5" rx="0.5" ry="0.3" fill="${log}"/><ellipse cx="0" cy="-0.8" rx="1" ry="0.2" fill="${snow}" opacity="0.4"/></g>`;
}
function svgCherryBlossom(x, y, c, v) {
  const pink = v === 2 ? c.cherryPetalWhite : c.cherryPetalPink;
  const trunk = c.cherryTrunk;
  if (v === 1) {
    return `<g transform="translate(${x},${y})"><rect x="-0.5" y="-1" width="1" height="3" fill="${trunk}"/><line x1="0" y1="-1" x2="-2" y2="-3" stroke="${c.cherryBranch}" stroke-width="0.5"/><line x1="0" y1="-1.5" x2="2" y2="-3.5" stroke="${c.cherryBranch}" stroke-width="0.5"/><circle cx="-2" cy="-3.2" r="1" fill="${pink}" opacity="0.5"/><circle cx="2" cy="-3.7" r="0.8" fill="${pink}" opacity="0.4"/><circle cx="0" cy="-3" r="0.6" fill="${pink}" opacity="0.3"/></g>`;
  }
  return `<g transform="translate(${x},${y})"><rect x="-0.5" y="-1" width="1" height="3" fill="${trunk}"/><line x1="0" y1="-1" x2="-2.5" y2="-3" stroke="${c.cherryBranch}" stroke-width="0.5"/><line x1="0" y1="-1.5" x2="2.5" y2="-3.5" stroke="${c.cherryBranch}" stroke-width="0.5"/><line x1="0" y1="-2" x2="0" y2="-4" stroke="${c.cherryBranch}" stroke-width="0.5"/><circle cx="-2" cy="-3.5" r="1.5" fill="${pink}" opacity="0.7"/><circle cx="2" cy="-4" r="1.3" fill="${pink}" opacity="0.65"/><circle cx="0" cy="-4.5" r="1.4" fill="${pink}" opacity="0.7"/><circle cx="-0.5" cy="-3" r="1" fill="${pink}" opacity="0.5"/><circle cx="1" cy="-3" r="0.8" fill="${pink}" opacity="0.45"/></g>`;
}
function svgCherryBlossomSmall(x, y, c, v) {
  const pink = c.cherryPetalPink;
  const trunk = c.cherryTrunk;
  if (v === 1) {
    return `<g transform="translate(${x},${y})"><rect x="-0.3" y="-0.5" width="0.6" height="2" fill="${trunk}"/><circle cx="0" cy="-1.5" r="1.5" fill="${pink}" opacity="0.6"/><circle cx="-0.5" cy="-1" r="0.8" fill="${pink}" opacity="0.5"/></g>`;
  }
  if (v === 2) {
    return `<g transform="translate(${x},${y})"><rect x="-0.3" y="-0.5" width="0.6" height="2" fill="${trunk}"/><circle cx="0" cy="-2" r="1.2" fill="${pink}" opacity="0.6"/><path d="M-1,-1.5 Q-2,0 -1.5,0.5" stroke="${c.cherryBranch}" fill="none" stroke-width="0.3"/><path d="M1,-1.5 Q2,0 1.5,0.5" stroke="${c.cherryBranch}" fill="none" stroke-width="0.3"/><circle cx="-1.5" cy="0" r="0.5" fill="${pink}" opacity="0.4"/><circle cx="1.5" cy="0" r="0.5" fill="${pink}" opacity="0.4"/></g>`;
  }
  return `<g transform="translate(${x},${y})"><rect x="-0.3" y="-0.5" width="0.6" height="2" fill="${trunk}"/><circle cx="0" cy="-1.5" r="1" fill="${pink}" opacity="0.55"/></g>`;
}
function svgCherryPetals(x, y, c, v) {
  const pink = c.cherryPetalPink;
  if (v === 1) {
    return `<g transform="translate(${x},${y})"><ellipse cx="0" cy="0" rx="2" ry="0.6" fill="${pink}" opacity="0.4"/><ellipse cx="0.5" cy="-0.2" rx="1" ry="0.3" fill="${pink}" opacity="0.5"/></g>`;
  }
  if (v === 2) {
    return `<g transform="translate(${x},${y})"><ellipse cx="-0.5" cy="-0.5" rx="0.3" ry="0.15" fill="${pink}" opacity="0.6" transform="rotate(-20,-0.5,-0.5)"/><ellipse cx="0.8" cy="-1" rx="0.3" ry="0.15" fill="${pink}" opacity="0.5" transform="rotate(30,0.8,-1)"/><ellipse cx="0" cy="-1.5" rx="0.25" ry="0.12" fill="${pink}" opacity="0.55" transform="rotate(-45,0,-1.5)"/><ellipse cx="-0.3" cy="0.2" rx="0.25" ry="0.12" fill="${pink}" opacity="0.4"/></g>`;
  }
  return `<g transform="translate(${x},${y})"><ellipse cx="-1" cy="0" rx="0.3" ry="0.15" fill="${pink}" opacity="0.5"/><ellipse cx="0.5" cy="0.3" rx="0.25" ry="0.12" fill="${pink}" opacity="0.45"/><ellipse cx="1.2" cy="-0.2" rx="0.3" ry="0.15" fill="${pink}" opacity="0.4"/><ellipse cx="-0.3" cy="-0.3" rx="0.2" ry="0.1" fill="${pink}" opacity="0.5"/></g>`;
}
function svgCherryBlossomFull(x, y, c, v) {
  const pink = c.blossomPink || c.cherryPetalPink;
  const white = c.blossomWhite || c.cherryPetalWhite;
  const trunk = c.cherryTrunk;
  if (v === 1) {
    return `<g transform="translate(${x},${y})"><rect x="-0.6" y="-1" width="1.2" height="3.5" fill="${trunk}"/><circle cx="0" cy="-4.5" r="2.5" fill="${white}" opacity="0.7"/><circle cx="-1.8" cy="-3.5" r="1.8" fill="${pink}" opacity="0.65"/><circle cx="1.8" cy="-3.5" r="1.8" fill="${white}" opacity="0.6"/><circle cx="0" cy="-6" r="1.5" fill="${pink}" opacity="0.55"/><circle cx="-1" cy="-5" r="1" fill="${white}" opacity="0.5"/><circle cx="1" cy="-5" r="1" fill="${pink}" opacity="0.5"/></g>`;
  }
  if (v === 2) {
    return `<g transform="translate(${x},${y})"><rect x="-0.6" y="-1" width="1.2" height="3.5" fill="${trunk}"/><circle cx="0" cy="-4" r="2.3" fill="${pink}" opacity="0.7"/><circle cx="-1.5" cy="-3.2" r="1.6" fill="${pink}" opacity="0.65"/><circle cx="1.5" cy="-3.2" r="1.6" fill="${pink}" opacity="0.6"/><circle cx="0" cy="-5.5" r="1.3" fill="${pink}" opacity="0.55"/><ellipse cx="-2" cy="0.5" rx="0.3" ry="0.12" fill="${pink}" opacity="0.5"/><ellipse cx="1.5" cy="0.8" rx="0.25" ry="0.1" fill="${pink}" opacity="0.45"/><ellipse cx="0" cy="0.3" rx="0.2" ry="0.08" fill="${pink}" opacity="0.4"/></g>`;
  }
  return `<g transform="translate(${x},${y})"><rect x="-0.6" y="-1" width="1.2" height="3.5" fill="${trunk}"/><circle cx="0" cy="-4.5" r="2.8" fill="${pink}" opacity="0.7"/><circle cx="-2" cy="-3.5" r="2" fill="${pink}" opacity="0.65"/><circle cx="2" cy="-3.5" r="2" fill="${pink}" opacity="0.6"/><circle cx="0" cy="-6.5" r="1.5" fill="${pink}" opacity="0.55"/><circle cx="-1" cy="-5.5" r="1.2" fill="${pink}" opacity="0.5"/><circle cx="1" cy="-5.5" r="1.2" fill="${pink}" opacity="0.5"/></g>`;
}
function svgCherryBlossomBranch(x, y, c, v) {
  const pink = c.blossomPink || c.cherryPetalPink;
  const branch = c.cherryBranch;
  if (v === 1) {
    return `<g transform="translate(${x},${y})"><path d="M0,0 Q-1.5,-2 -3,-2" stroke="${branch}" fill="none" stroke-width="0.4"/><circle cx="-2.5" cy="-2.2" r="0.8" fill="${pink}" opacity="0.6"/><circle cx="-3.2" cy="-1.8" r="0.6" fill="${pink}" opacity="0.5"/><circle cx="-1.8" cy="-2" r="0.5" fill="${pink}" opacity="0.55"/></g>`;
  }
  return `<g transform="translate(${x},${y})"><path d="M0,0 Q0.5,-1.5 1,-3" stroke="${branch}" fill="none" stroke-width="0.35"/><circle cx="0.8" cy="-2.5" r="0.7" fill="${pink}" opacity="0.6"/><circle cx="1.2" cy="-3.2" r="0.5" fill="${pink}" opacity="0.55"/><circle cx="0.3" cy="-1.5" r="0.4" fill="${pink}" opacity="0.5"/></g>`;
}
function svgPeachBlossom(x, y, c, v) {
  const pink = c.peachPink || "#ffd5cc";
  const trunk = c.cherryTrunk;
  if (v === 1) {
    return `<g transform="translate(${x},${y})"><rect x="-0.4" y="-1" width="0.8" height="3" fill="${trunk}"/><circle cx="0" cy="-3.5" r="2" fill="${pink}" opacity="0.65"/><circle cx="-1.2" cy="-2.8" r="1.2" fill="${pink}" opacity="0.55"/><circle cx="1.2" cy="-2.8" r="1.2" fill="${pink}" opacity="0.5"/><circle cx="0" cy="-4.8" r="0.8" fill="${pink}" opacity="0.5"/></g>`;
  }
  return `<g transform="translate(${x},${y})"><rect x="-0.5" y="-1" width="1" height="3.5" fill="${trunk}"/><circle cx="0" cy="-4" r="2.5" fill="${pink}" opacity="0.65"/><circle cx="-1.5" cy="-3" r="1.5" fill="${pink}" opacity="0.55"/><circle cx="1.5" cy="-3" r="1.5" fill="${pink}" opacity="0.5"/><circle cx="0" cy="-5.5" r="1.2" fill="${pink}" opacity="0.5"/></g>`;
}
function svgFlowerBed(x, y, c, v) {
  const soil = c.gardenSoil;
  const red = c.tulipRed;
  const yellow = c.tulipYellow;
  const purple = c.crocusPurple;
  if (v === 1) {
    return `<g transform="translate(${x},${y})"><rect x="-2" y="-0.3" width="4" height="0.8" rx="0.2" fill="${soil}"/><circle cx="-1.2" cy="-0.8" r="0.35" fill="${red}"/><circle cx="-0.4" cy="-0.9" r="0.3" fill="${yellow}"/><circle cx="0.4" cy="-0.7" r="0.35" fill="${purple}"/><circle cx="1.2" cy="-0.85" r="0.3" fill="${red}"/><line x1="-1.2" y1="-0.5" x2="-1.2" y2="-0.3" stroke="${c.sproutGreen}" stroke-width="0.12"/><line x1="0.4" y1="-0.4" x2="0.4" y2="-0.3" stroke="${c.sproutGreen}" stroke-width="0.12"/></g>`;
  }
  return `<g transform="translate(${x},${y})"><ellipse cx="0" cy="0" rx="1.8" ry="0.7" fill="${soil}"/><circle cx="-0.8" cy="-0.5" r="0.35" fill="${red}"/><circle cx="0" cy="-0.6" r="0.3" fill="${yellow}"/><circle cx="0.8" cy="-0.5" r="0.35" fill="${purple}"/><circle cx="-0.4" cy="-0.3" r="0.25" fill="${yellow}" opacity="0.9"/><circle cx="0.4" cy="-0.35" r="0.25" fill="${red}" opacity="0.9"/></g>`;
}
function svgWateringCan(x, y, c, _v) {
  const metal = c.sledRunner || "#607080";
  const accent = c.sproutGreen;
  return `<g transform="translate(${x},${y})"><ellipse cx="0" cy="0" rx="1" ry="0.5" fill="${metal}"/><rect x="-0.8" y="-1.2" width="1.6" height="1.2" rx="0.2" fill="${metal}"/><path d="M0.6,-0.8 Q1.2,-1.2 1.8,-1" stroke="${metal}" fill="none" stroke-width="0.2"/><line x1="1.8" y1="-1" x2="2.5" y2="-0.5" stroke="${metal}" stroke-width="0.25"/><ellipse cx="2.5" cy="-0.4" rx="0.25" ry="0.15" fill="${metal}"/><path d="M-0.5,-1.2 Q-0.5,-2 0,-2 Q0.5,-2 0.5,-1.2" stroke="${accent}" fill="none" stroke-width="0.15"/></g>`;
}
function svgSeedling(x, y, c, v) {
  const green = c.sproutGreen;
  const soil = c.gardenSoil;
  if (v === 1) {
    return `<g transform="translate(${x},${y})"><ellipse cx="0" cy="0.2" rx="0.6" ry="0.2" fill="${soil}"/><line x1="0" y1="0" x2="0" y2="-1" stroke="${green}" stroke-width="0.12"/><ellipse cx="-0.4" cy="-1.2" rx="0.35" ry="0.2" fill="${green}" transform="rotate(-30,-0.4,-1.2)"/><ellipse cx="0.4" cy="-1.2" rx="0.35" ry="0.2" fill="${green}" transform="rotate(30,0.4,-1.2)"/></g>`;
  }
  return `<g transform="translate(${x},${y})"><ellipse cx="0" cy="0.2" rx="0.5" ry="0.15" fill="${soil}"/><line x1="0" y1="0" x2="0" y2="-0.8" stroke="${green}" stroke-width="0.1"/><ellipse cx="0" cy="-1" rx="0.25" ry="0.4" fill="${green}"/></g>`;
}
function svgRobinBird(x, y, c, v) {
  const brown = c.owl || "#8a7050";
  const red = c.tulipRed;
  const beak = c.tulipYellow;
  if (v === 1) {
    return `<g transform="translate(${x},${y})"><ellipse cx="0" cy="0" rx="0.8" ry="0.5" fill="${brown}"/><ellipse cx="0.2" cy="-0.1" rx="0.4" ry="0.35" fill="${red}"/><circle cx="0.7" cy="-0.3" r="0.35" fill="${brown}"/><polygon points="1,-0.3 1.3,-0.1 1,-0.15" fill="${beak}"/><polygon points="1,-0.3 1.3,-0.4 1,-0.35" fill="${beak}"/><circle cx="0.8" cy="-0.35" r="0.08" fill="#000"/><line x1="-0.6" y1="0.4" x2="-0.6" y2="0.7" stroke="${brown}" stroke-width="0.1"/></g>`;
  }
  return `<g transform="translate(${x},${y})"><ellipse cx="0" cy="0" rx="0.8" ry="0.5" fill="${brown}"/><ellipse cx="0.2" cy="-0.1" rx="0.4" ry="0.35" fill="${red}"/><circle cx="0.7" cy="-0.3" r="0.35" fill="${brown}"/><polygon points="1,-0.3 1.4,-0.25 1,-0.2" fill="${beak}"/><circle cx="0.8" cy="-0.35" r="0.08" fill="#000"/><line x1="-0.5" y1="0.4" x2="-0.5" y2="0.7" stroke="${brown}" stroke-width="0.08"/><line x1="0" y1="0.45" x2="0" y2="0.7" stroke="${brown}" stroke-width="0.08"/></g>`;
}
function svgButterflyGarden(x, y, c, v) {
  const wing1 = c.butterfly;
  const wing2 = c.butterflyWing;
  const wing3 = c.tulipPurple;
  if (v === 1) {
    return `<g transform="translate(${x},${y})"><ellipse cx="-1" cy="-1" rx="0.5" ry="0.25" fill="${wing1}" opacity="0.7"/><ellipse cx="-1.5" cy="-1.2" rx="0.4" ry="0.2" fill="${wing2}" opacity="0.6"/><ellipse cx="0.5" cy="-0.5" rx="0.4" ry="0.2" fill="${wing3}" opacity="0.65"/><ellipse cx="0.1" cy="-0.6" rx="0.3" ry="0.15" fill="${wing2}" opacity="0.55"/><ellipse cx="1" cy="-1.5" rx="0.35" ry="0.18" fill="${wing1}" opacity="0.6"/><ellipse cx="0.7" cy="-1.6" rx="0.25" ry="0.12" fill="${wing3}" opacity="0.5"/></g>`;
  }
  return `<g transform="translate(${x},${y})"><ellipse cx="-0.5" cy="-0.8" rx="0.5" ry="0.25" fill="${wing1}" opacity="0.7"/><ellipse cx="-1" cy="-1" rx="0.4" ry="0.2" fill="${wing2}" opacity="0.6"/><ellipse cx="0.8" cy="-1.2" rx="0.45" ry="0.22" fill="${wing3}" opacity="0.65"/><ellipse cx="0.4" cy="-1.3" rx="0.35" ry="0.17" fill="${wing1}" opacity="0.55"/></g>`;
}
function svgUmbrella(x, y, c, v) {
  const colors = [c.parasolRed, c.parasolBlue, c.parasolYellow];
  const color = colors[v] || c.parasolRed;
  const handle = c.trunk;
  if (v === 2) {
    return `<g transform="translate(${x},${y})"><path d="M-2,0 Q0,-2 2,0" fill="${color}" opacity="0.8"/><line x1="0" y1="0" x2="0" y2="0.8" stroke="${handle}" stroke-width="0.2"/><path d="M0,0.8 Q0.3,1 0.2,1.3" stroke="${handle}" fill="none" stroke-width="0.15"/></g>`;
  }
  return `<g transform="translate(${x},${y})"><line x1="-0.3" y1="1" x2="0.5" y2="-2.5" stroke="${handle}" stroke-width="0.2"/><polygon points="0.4,-2.5 0.7,-2 0.6,-2.5 0.3,-2.5" fill="${color}"/><path d="M0.4,-2.5 L0.5,-1 L0.2,-1 Z" fill="${color}" opacity="0.8"/><path d="M-0.3,1 Q-0.5,1.2 -0.3,1.4" stroke="${handle}" fill="none" stroke-width="0.12"/></g>`;
}
function svgTulip(x, y, c, v) {
  const colors = [c.tulipRed, c.tulipYellow, c.tulipPurple];
  const color = colors[v] || c.tulipRed;
  const stem = c.tulipStem;
  return `<g transform="translate(${x},${y})"><line x1="0" y1="0.5" x2="0" y2="-2" stroke="${stem}" stroke-width="0.4"/><path d="M-0.6,-2 Q0,-3.5 0.6,-2" fill="${color}"/><ellipse cx="0" cy="-2" rx="0.5" ry="0.2" fill="${color}" opacity="0.7"/><path d="M0.5,-0.5 Q1.5,-1 1.2,-0.2" fill="${stem}" opacity="0.6"/></g>`;
}
function svgTulipField(x, y, c, v) {
  const stem = c.tulipStem;
  if (v === 1) {
    const col = c.tulipRed;
    return `<g transform="translate(${x},${y})"><line x1="-1.5" y1="0.5" x2="-1.5" y2="-1.5" stroke="${stem}" stroke-width="0.3"/><path d="M-2,-1.5 Q-1.5,-2.8 -1,-1.5" fill="${col}"/><line x1="0" y1="0.5" x2="0" y2="-1.8" stroke="${stem}" stroke-width="0.3"/><path d="M-0.5,-1.8 Q0,-3 0.5,-1.8" fill="${col}"/><line x1="1.5" y1="0.5" x2="1.5" y2="-1.3" stroke="${stem}" stroke-width="0.3"/><path d="M1,-1.3 Q1.5,-2.5 2,-1.3" fill="${col}"/></g>`;
  }
  if (v === 2) {
    return `<g transform="translate(${x},${y})"><ellipse cx="0" cy="0.3" rx="2.5" ry="0.5" fill="${stem}" opacity="0.3"/><line x1="-1" y1="0.3" x2="-1" y2="-1.5" stroke="${stem}" stroke-width="0.3"/><path d="M-1.4,-1.5 Q-1,-2.5 -0.6,-1.5" fill="${c.tulipYellow}"/><line x1="0.8" y1="0.3" x2="0.8" y2="-1.8" stroke="${stem}" stroke-width="0.3"/><path d="M0.4,-1.8 Q0.8,-3 1.2,-1.8" fill="${c.tulipPurple}"/></g>`;
  }
  return `<g transform="translate(${x},${y})"><line x1="-1.5" y1="0.5" x2="-1.5" y2="-1.5" stroke="${stem}" stroke-width="0.3"/><path d="M-2,-1.5 Q-1.5,-2.8 -1,-1.5" fill="${c.tulipRed}"/><line x1="0" y1="0.5" x2="0" y2="-1.8" stroke="${stem}" stroke-width="0.3"/><path d="M-0.5,-1.8 Q0,-3 0.5,-1.8" fill="${c.tulipYellow}"/><line x1="1.5" y1="0.5" x2="1.5" y2="-1.3" stroke="${stem}" stroke-width="0.3"/><path d="M1,-1.3 Q1.5,-2.5 2,-1.3" fill="${c.tulipPurple}"/></g>`;
}
function svgSprout(x, y, c, v) {
  const green = c.sproutGreen;
  if (v === 1) {
    return `<g transform="translate(${x},${y})"><line x1="-0.5" y1="0.5" x2="-0.5" y2="-0.5" stroke="${green}" stroke-width="0.3"/><path d="M-0.5,-0.5 Q-0.5,-1.2 0,-1" fill="${green}"/><line x1="0.5" y1="0.5" x2="0.5" y2="-0.3" stroke="${green}" stroke-width="0.3"/><path d="M0.5,-0.3 Q0.5,-1 1,-0.8" fill="${green}"/></g>`;
  }
  if (v === 2) {
    return `<g transform="translate(${x},${y})"><line x1="0" y1="0.5" x2="0" y2="-0.8" stroke="${green}" stroke-width="0.3"/><path d="M0,-0.8 Q0,-1.5 0.5,-1.2" fill="${green}"/><path d="M0,-0.3 Q0.5,-0.5 0.3,-0.1" fill="${green}" opacity="0.6"/></g>`;
  }
  return `<g transform="translate(${x},${y})"><line x1="0" y1="0.5" x2="0" y2="-0.5" stroke="${green}" stroke-width="0.3"/><path d="M0,-0.5 Q0,-1.3 0.5,-1" fill="${green}"/></g>`;
}
function svgNest(x, y, c, v) {
  const brown = c.nestBrown;
  const egg1 = c.eggBlue;
  const egg2 = c.eggWhite;
  if (v === 1) {
    return `<g transform="translate(${x},${y})"><ellipse cx="0" cy="0" rx="1.8" ry="0.7" fill="${brown}"/><ellipse cx="0" cy="-0.2" rx="1.3" ry="0.4" fill="${brown}" opacity="0.7"/><ellipse cx="-0.5" cy="-0.4" rx="0.3" ry="0.4" fill="${egg1}"/><ellipse cx="0.2" cy="-0.4" rx="0.3" ry="0.4" fill="${egg1}"/><ellipse cx="0.8" cy="-0.3" rx="0.3" ry="0.35" fill="${egg2}"/></g>`;
  }
  if (v === 2) {
    return `<g transform="translate(${x},${y})"><ellipse cx="0" cy="0" rx="1.8" ry="0.7" fill="${brown}"/><ellipse cx="-0.5" cy="-0.4" rx="0.3" ry="0.4" fill="${egg1}"/><circle cx="0.5" cy="-0.8" r="0.5" fill="${c.winterBirdBrown || "#8a6040"}"/><polygon points="0.5,-0.8 0.9,-0.7 0.5,-0.6" fill="${c.snowmanCarrot || "#e07020"}" opacity="0.8"/><circle cx="0.35" cy="-0.9" r="0.08" fill="#222"/></g>`;
  }
  return `<g transform="translate(${x},${y})"><ellipse cx="0" cy="0" rx="1.5" ry="0.6" fill="${brown}"/><ellipse cx="0" cy="-0.2" rx="1" ry="0.35" fill="${brown}" opacity="0.7"/><ellipse cx="-0.3" cy="-0.4" rx="0.3" ry="0.4" fill="${egg1}"/><ellipse cx="0.3" cy="-0.4" rx="0.3" ry="0.4" fill="${egg2}"/></g>`;
}
function svgLamb(x, y, c, v) {
  const wool = c.lambWool;
  const head = c.winterBirdBrown || "#6a5040";
  if (v === 1) {
    return `<g transform="translate(${x},${y})"><ellipse cx="0" cy="-0.5" rx="1.5" ry="1" fill="${wool}"/><circle cx="-1.2" cy="-1.2" r="0.5" fill="${head}"/><circle cx="-1.4" cy="-1.3" r="0.08" fill="#222"/><line x1="-0.5" y1="0.5" x2="-0.8" y2="1.2" stroke="${head}" stroke-width="0.3"/><line x1="0.5" y1="0.5" x2="0.3" y2="1.2" stroke="${head}" stroke-width="0.3"/></g>`;
  }
  if (v === 2) {
    return `<g transform="translate(${x},${y})"><ellipse cx="2" cy="-0.8" rx="2" ry="1.3" fill="${c.sheep || wool}"/><circle cx="0.5" cy="-1.5" r="0.6" fill="#444"/><ellipse cx="-1.5" cy="-0.3" rx="1.2" ry="0.8" fill="${wool}"/><circle cx="-2.3" cy="-0.8" r="0.4" fill="${head}"/><circle cx="-2.5" cy="-0.9" r="0.06" fill="#222"/></g>`;
  }
  return `<g transform="translate(${x},${y})"><ellipse cx="0" cy="-0.5" rx="1.3" ry="0.9" fill="${wool}"/><circle cx="-1" cy="-1" r="0.45" fill="${head}"/><circle cx="-1.2" cy="-1.1" r="0.07" fill="#222"/><line x1="-0.5" y1="0.3" x2="-0.5" y2="1" stroke="${head}" stroke-width="0.25"/><line x1="0.5" y1="0.3" x2="0.5" y2="1" stroke="${head}" stroke-width="0.25"/></g>`;
}
function svgCrocus(x, y, c, v) {
  const colors = [c.crocusPurple, c.crocusYellow, c.cherryPetalWhite];
  const color = colors[v] || c.crocusPurple;
  return `<g transform="translate(${x},${y})"><line x1="0" y1="0.5" x2="0" y2="-0.5" stroke="${c.tulipStem || "#5a9a40"}" stroke-width="0.3"/><path d="M-0.4,-0.5 Q0,-1.5 0.4,-0.5" fill="${color}"/><line x1="0" y1="-0.8" x2="0" y2="-1.2" stroke="${c.crocusYellow}" stroke-width="0.2"/></g>`;
}
function svgRainPuddle(x, y, c, v) {
  const water = c.poolWater || c.water;
  if (v === 1) {
    return `<g transform="translate(${x},${y})"><ellipse cx="0" cy="0" rx="2" ry="0.8" fill="${water}" opacity="0.4"/><ellipse cx="0.3" cy="-0.1" rx="0.8" ry="0.3" fill="#fff" opacity="0.1"/><circle cx="-0.5" cy="-0.2" r="0.4" fill="${water}" opacity="0.15" stroke="${water}" stroke-width="0.2"/></g>`;
  }
  if (v === 2) {
    return `<g transform="translate(${x},${y})"><ellipse cx="0" cy="0" rx="1.8" ry="0.7" fill="${c.gardenSoil || "#5a4030"}" opacity="0.3"/><ellipse cx="0" cy="0" rx="1.5" ry="0.5" fill="${water}" opacity="0.35"/></g>`;
  }
  return `<g transform="translate(${x},${y})"><ellipse cx="0" cy="0" rx="1.5" ry="0.6" fill="${water}" opacity="0.35"/><ellipse cx="0.2" cy="-0.1" rx="0.6" ry="0.25" fill="#fff" opacity="0.1"/></g>`;
}
function svgBirdhouse(x, y, c, v) {
  const wood = c.birdhouseWood;
  if (v === 1) {
    return `<g transform="translate(${x},${y})"><line x1="0" y1="0.5" x2="0" y2="-2" stroke="${wood}" stroke-width="0.5"/><rect x="-1" y="-3.5" width="2" height="1.5" fill="${c.parasolBlue || "#4080d0"}"/><polygon points="-1.2,-3.5 0,-4.5 1.2,-3.5" fill="${c.tulipRed || "#e04050"}"/><circle cx="0" cy="-3" r="0.3" fill="#333"/><line x1="0" y1="-2.7" x2="0.5" y2="-2.5" stroke="${wood}" stroke-width="0.3"/></g>`;
  }
  if (v === 2) {
    return `<g transform="translate(${x},${y})"><line x1="0" y1="0.5" x2="0" y2="-2" stroke="${wood}" stroke-width="0.5"/><rect x="-1" y="-3.5" width="2" height="1.5" fill="${wood}"/><polygon points="-1.2,-3.5 0,-4.5 1.2,-3.5" fill="${wood}" opacity="0.8"/><circle cx="0" cy="-3" r="0.3" fill="#333"/><circle cx="1.2" cy="-3.8" r="0.4" fill="${c.winterBirdBrown || "#8a6040"}"/><ellipse cx="1.2" cy="-3.5" rx="0.5" ry="0.3" fill="${c.winterBirdBrown || "#8a6040"}"/></g>`;
  }
  return `<g transform="translate(${x},${y})"><line x1="0" y1="0.5" x2="0" y2="-2" stroke="${wood}" stroke-width="0.5"/><rect x="-1" y="-3.5" width="2" height="1.5" fill="${wood}"/><polygon points="-1.2,-3.5 0,-4.5 1.2,-3.5" fill="${wood}" opacity="0.8"/><circle cx="0" cy="-3" r="0.3" fill="#333"/><line x1="0" y1="-2.7" x2="0.5" y2="-2.5" stroke="${wood}" stroke-width="0.3"/></g>`;
}
function svgGardenBed(x, y, c, v) {
  const soil = c.gardenSoil;
  const green = c.sproutGreen;
  if (v === 1) {
    return `<g transform="translate(${x},${y})"><rect x="-2.5" y="-0.3" width="5" height="1" rx="0.3" fill="${soil}"/><line x1="-1.5" y1="-0.3" x2="-1.5" y2="-1" stroke="${green}" stroke-width="0.3"/><line x1="0" y1="-0.3" x2="0" y2="-0.8" stroke="${green}" stroke-width="0.3"/><line x1="1.5" y1="-0.3" x2="1.5" y2="-1.1" stroke="${green}" stroke-width="0.3"/><path d="M-1.5,-1 Q-1.5,-1.5 -1,-1.2" fill="${green}"/><path d="M1.5,-1.1 Q1.5,-1.6 2,-1.3" fill="${green}"/></g>`;
  }
  if (v === 2) {
    return `<g transform="translate(${x},${y})"><rect x="-2.5" y="-0.3" width="5" height="1" rx="0.3" fill="${soil}"/><line x1="-2.5" y1="-0.8" x2="2.5" y2="-0.8" stroke="${c.fence}" stroke-width="0.3"/><line x1="-2" y1="-1.3" x2="-2" y2="0" stroke="${c.fence}" stroke-width="0.3"/><line x1="2" y1="-1.3" x2="2" y2="0" stroke="${c.fence}" stroke-width="0.3"/><line x1="0" y1="-0.3" x2="0" y2="-0.7" stroke="${green}" stroke-width="0.3"/></g>`;
  }
  return `<g transform="translate(${x},${y})"><rect x="-2" y="-0.3" width="4" height="0.8" rx="0.3" fill="${soil}"/><line x1="-1" y1="-0.1" x2="-1" y2="-0.1" stroke="${soil}" stroke-width="0.8"/><line x1="0.5" y1="-0.1" x2="0.5" y2="-0.1" stroke="${soil}" stroke-width="0.8"/></g>`;
}
function svgParasol(x, y, c, v) {
  const colors = [c.parasolRed, c.parasolBlue, c.parasolYellow];
  const color = colors[v] || c.parasolRed;
  return `<g transform="translate(${x},${y})"><line x1="0" y1="0.5" x2="0" y2="-4" stroke="${c.bareBranch || "#6a5a4a"}" stroke-width="0.4"/><path d="M-3,-4 Q0,-6 3,-4 L0,-4.5 Z" fill="${color}"/><path d="M-1.5,-4.2 Q0,-5 1.5,-4.2" fill="${c.parasolStripe}" opacity="0.3"/></g>`;
}
function svgBeachTowel(x, y, c, v) {
  const colors = [c.beachTowelA, c.beachTowelB, c.parasolYellow];
  const color = colors[v] || c.beachTowelA;
  if (v === 2) {
    return `<g transform="translate(${x},${y})"><rect x="-2.5" y="-0.3" width="5" height="1.5" rx="0.3" fill="${color}" opacity="0.8"/><circle cx="-0.3" cy="0.2" r="0.35" fill="#333" opacity="0.6"/><circle cx="0.4" cy="0.2" r="0.35" fill="#333" opacity="0.6"/><line x1="-0.3" y1="0.2" x2="0.4" y2="0.2" stroke="#333" stroke-width="0.15"/></g>`;
  }
  return `<g transform="translate(${x},${y})"><rect x="-2.5" y="-0.3" width="5" height="1.5" rx="0.3" fill="${color}" opacity="0.8"/>` + (v === 0 ? `<line x1="-2.5" y1="0.3" x2="2.5" y2="0.3" stroke="${c.parasolStripe}" stroke-width="0.3" opacity="0.4"/>` : "") + `</g>`;
}
function svgSandcastleSummer(x, y, c, v) {
  const sand = c.sandcastleWall;
  if (v === 1) {
    return `<g transform="translate(${x},${y})"><rect x="-1.5" y="-1" width="3" height="1.5" fill="${sand}"/><rect x="-0.8" y="-2" width="1.6" height="1" fill="${sand}"/><rect x="-0.4" y="-2.8" width="0.8" height="0.8" fill="${sand}"/><line x1="0" y1="-2.8" x2="0" y2="-3.5" stroke="${c.bareBranch || "#6a5a4a"}" stroke-width="0.2"/><polygon points="0,-3.5 0.8,-3.2 0,-2.9" fill="${c.scarfRed || "#cc3030"}"/></g>`;
  }
  if (v === 2) {
    return `<g transform="translate(${x},${y})"><rect x="-2" y="-0.5" width="4" height="1" fill="${sand}"/><rect x="-1.5" y="-1.5" width="1.2" height="1" fill="${sand}"/><rect x="0.3" y="-1.5" width="1.2" height="1" fill="${sand}"/><rect x="-0.5" y="-2.5" width="1" height="1" fill="${sand}"/><polygon points="-1.5,-1.5 -0.9,-2 -0.3,-1.5" fill="${sand}" opacity="0.8"/><polygon points="0.3,-1.5 0.9,-2 1.5,-1.5" fill="${sand}" opacity="0.8"/></g>`;
  }
  return `<g transform="translate(${x},${y})"><rect x="-1.2" y="-0.5" width="2.4" height="1" fill="${sand}"/><rect x="-0.6" y="-1.3" width="1.2" height="0.8" fill="${sand}"/><polygon points="-0.6,-1.3 0,-1.8 0.6,-1.3" fill="${sand}" opacity="0.8"/></g>`;
}
function svgSurfboard(x, y, c, v) {
  const body = c.surfboardBody;
  const stripe = c.surfboardStripe;
  return `<g transform="translate(${x},${y})"><ellipse cx="0" cy="-2" rx="0.8" ry="3" fill="${body}" transform="rotate(${v === 1 ? -10 : v === 2 ? 10 : 5})"/><line x1="0" y1="-3.5" x2="0" y2="-0.5" stroke="${stripe}" stroke-width="0.3" opacity="0.6" transform="rotate(${v === 1 ? -10 : v === 2 ? 10 : 5})"/></g>`;
}
function svgIceCreamCartAsset(x, y, c, v) {
  const cart = c.iceCreamCart;
  const umbrella = c.iceCreamUmbrella;
  return `<g transform="translate(${x},${y})"><rect x="-1.5" y="-1.5" width="3" height="2" rx="0.3" fill="${cart}"/><circle cx="-1" cy="0.8" r="0.4" fill="#555"/><circle cx="1" cy="0.8" r="0.4" fill="#555"/><line x1="0" y1="-1.5" x2="0" y2="-3.5" stroke="${c.bareBranch || "#6a5a4a"}" stroke-width="0.3"/><path d="M-2,-3.5 Q0,-4.5 2,-3.5" fill="${umbrella}"/>` + /* v8 ignore start */
  (v === 1 ? `<polygon points="1.5,-2 2.5,-2.3 1.5,-2.5" fill="${c.scarfRed || "#cc3030"}"/>` : "") + (v === 2 ? `<rect x="-0.5" y="-2.5" width="1" height="0.8" rx="0.2" fill="${c.sunflowerPetal || "#f0c820"}"/>` : "") + /* v8 ignore stop */
  `</g>`;
}
function svgHammock(x, y, c, v) {
  const fabric = c.hammockFabric;
  return `<g transform="translate(${x},${y})"><line x1="-3" y1="0" x2="-3" y2="-3" stroke="${c.bareBranch || "#6a5a4a"}" stroke-width="0.5"/><line x1="3" y1="0" x2="3" y2="-3" stroke="${c.bareBranch || "#6a5a4a"}" stroke-width="0.5"/><path d="M-3,-2.5 Q0,-0.5 3,-2.5" fill="none" stroke="${fabric}" stroke-width="0.8"/><path d="M-2.5,-2.2 Q0,-0.2 2.5,-2.2" fill="${fabric}" opacity="0.5"/>` + /* v8 ignore start */
  (v === 2 ? `<rect x="-1" y="-1.8" width="2" height="1" rx="0.3" fill="${c.beachTowelA || "#e05050"}" opacity="0.4"/>` : "") + /* v8 ignore stop */
  `</g>`;
}
function svgSunflower(x, y, c, v) {
  const petal = c.sunflowerPetal;
  const center = c.sunflowerCenter;
  const stem = c.tulipStem || "#5a9a40";
  const count = v === 2 ? 3 : v === 1 ? 2 : 1;
  const parts = [];
  for (let i = 0; i < count; i++) {
    const ox = i * 1.5 - (count - 1) * 0.75;
    const h = 3 + i * 0.5;
    parts.push(
      `<line x1="${ox}" y1="0.5" x2="${ox}" y2="${-h}" stroke="${stem}" stroke-width="0.4"/>`,
      `<circle cx="${ox}" cy="${-h}" r="0.6" fill="${center}"/>`
    );
    for (let p = 0; p < 8; p++) {
      const angle = p / 8 * Math.PI * 2;
      const px = ox + Math.cos(angle) * 1.2;
      const py = -h + Math.sin(angle) * 1.2;
      parts.push(
        `<ellipse cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" rx="0.5" ry="0.25" fill="${petal}" transform="rotate(${(p * 45).toFixed(0)},${px.toFixed(1)},${py.toFixed(1)})"/>`
      );
    }
  }
  return `<g transform="translate(${x},${y})">${parts.join("")}</g>`;
}
function svgWatermelon(x, y, c, v) {
  const rind = c.watermelonRind;
  const flesh = c.watermelonFlesh;
  const seed = c.watermelonSeed;
  if (v === 0) {
    return `<g transform="translate(${x},${y})"><ellipse cx="0" cy="0" rx="1.5" ry="1" fill="${rind}"/><line x1="-1" y1="0" x2="1" y2="0" stroke="${rind}" stroke-width="0.15" opacity="0.5"/></g>`;
  }
  if (v === 1) {
    return `<g transform="translate(${x},${y})"><path d="M-1.5,0 A1.5,1 0 0 1 1.5,0 Z" fill="${rind}"/><path d="M-1.2,0 A1.2,0.8 0 0 1 1.2,0 Z" fill="${flesh}"/><circle cx="-0.3" cy="-0.2" r="0.12" fill="${seed}"/><circle cx="0.4" cy="-0.3" r="0.12" fill="${seed}"/></g>`;
  }
  return `<g transform="translate(${x},${y})"><path d="M-1,0 Q0,-1.5 1,0 Z" fill="${rind}"/><path d="M-0.8,0 Q0,-1.2 0.8,0 Z" fill="${flesh}"/><circle cx="-0.2" cy="-0.3" r="0.1" fill="${seed}"/><circle cx="0.3" cy="-0.4" r="0.1" fill="${seed}"/></g>`;
}
function svgSprinkler(x, y, c, v) {
  const metal = c.sprinklerMetal;
  const water = c.poolWater || c.water;
  return `<g transform="translate(${x},${y})"><line x1="0" y1="0.5" x2="0" y2="-0.5" stroke="${metal}" stroke-width="0.5"/><circle cx="0" cy="-0.8" r="0.4" fill="${metal}"/><line x1="-1.5" y1="-2" x2="0" y2="-0.8" stroke="${water}" stroke-width="0.2" opacity="0.4"/><line x1="1.5" y1="-2" x2="0" y2="-0.8" stroke="${water}" stroke-width="0.2" opacity="0.4"/><line x1="0" y1="-2.5" x2="0" y2="-0.8" stroke="${water}" stroke-width="0.2" opacity="0.4"/>` + (v === 2 ? `<path d="M-1.5,-2 Q0,-1.5 1.5,-2" fill="none" stroke="${water}" stroke-width="0.15" opacity="0.3"/>` : "") + `</g>`;
}
function svgLemonade(x, y, c, v) {
  const stand = c.lemonadeStand;
  return `<g transform="translate(${x},${y})"><rect x="-2" y="-1.5" width="4" height="2" fill="${stand}"/><line x1="-2" y1="-1.5" x2="-2" y2="0.8" stroke="${c.bareBranch || "#6a5a4a"}" stroke-width="0.4"/><line x1="2" y1="-1.5" x2="2" y2="0.8" stroke="${c.bareBranch || "#6a5a4a"}" stroke-width="0.4"/>` + /* v8 ignore stop */
  (v >= 1 ? `<rect x="-1" y="-2" width="2" height="0.5" rx="0.2" fill="${stand}" opacity="0.8"/>` : "") + /* v8 ignore start */
  `<circle cx="0" cy="-0.8" r="0.4" fill="${c.sunflowerPetal || "#f0c820"}" opacity="0.7"/></g>`;
}
function svgFirefliesAsset(x, y, c, v) {
  const glow = c.lanternGlow || "#ffc840";
  const count = v === 0 ? 3 : v === 1 ? 6 : 1;
  const parts = [];
  if (v === 2) {
    parts.push(
      `<rect x="-0.5" y="-2" width="1" height="1.5" rx="0.2" fill="#fff" opacity="0.15"/>`
    );
    parts.push(`<circle cx="0" cy="-1.5" r="0.2" fill="${glow}" opacity="0.8"/>`);
    parts.push(`<circle cx="-0.2" cy="-1" r="0.15" fill="${glow}" opacity="0.6"/>`);
  } else {
    for (let i = 0; i < count; i++) {
      const fx = (i - count / 2) * 1.5;
      const fy = -1 - i * 0.5;
      parts.push(`<circle cx="${fx}" cy="${fy}" r="0.2" fill="${glow}" opacity="0.7"/>`);
      parts.push(`<circle cx="${fx}" cy="${fy}" r="0.5" fill="${glow}" opacity="0.15"/>`);
    }
  }
  return `<g transform="translate(${x},${y})">${parts.join("")}</g>`;
}
function svgSwimmingPool(x, y, c, v) {
  const water = c.poolWater;
  const edge = c.poolEdge;
  return `<g transform="translate(${x},${y})"><rect x="-3" y="-1" width="6" height="2.5" rx="0.5" fill="${edge}"/><rect x="-2.5" y="-0.5" width="5" height="1.5" rx="0.3" fill="${water}" opacity="0.7"/>` + /* v8 ignore start */
  (v === 1 ? `<ellipse cx="0.5" cy="0" rx="0.8" ry="0.3" fill="${c.parasolYellow || "#e8c820"}" opacity="0.5"/>` : "") + /* v8 ignore stop */
  (v === 2 ? `<line x1="2.5" y1="-1" x2="2.5" y2="-2.5" stroke="${edge}" stroke-width="0.3"/>` : "") + `</g>`;
}
function svgAutumnMaple(x, y, c, v) {
  const trunk = c.trunk;
  if (v === 1) {
    return `<g transform="translate(${x},${y})"><rect x="-0.6" y="-1" width="1.2" height="3.5" fill="${trunk}"/><circle cx="0" cy="-4" r="2.2" fill="${c.autumnGold}" opacity="0.7"/><circle cx="-1.5" cy="-3" r="1.5" fill="${c.mapleOrange}" opacity="0.65"/><circle cx="1.5" cy="-3" r="1.5" fill="${c.autumnRust}" opacity="0.6"/><circle cx="0" cy="-5.5" r="1" fill="${c.autumnBronze}" opacity="0.55"/><circle cx="-0.5" cy="-2.5" r="0.8" fill="${c.autumnGold}" opacity="0.5"/></g>`;
  }
  if (v === 2) {
    return `<g transform="translate(${x},${y})"><rect x="-0.6" y="-1" width="1.2" height="3.5" fill="${trunk}"/><circle cx="0" cy="-3.8" r="2" fill="${c.mapleRed}" opacity="0.65"/><circle cx="-1.2" cy="-3" r="1.3" fill="${c.autumnGold}" opacity="0.6"/><circle cx="1.2" cy="-3" r="1.3" fill="${c.mapleCrimson}" opacity="0.55"/><circle cx="0" cy="-5" r="0.9" fill="${c.autumnBronze}" opacity="0.5"/><ellipse cx="-1.5" cy="0.5" rx="0.4" ry="0.15" fill="${c.mapleRed}" opacity="0.5"/><ellipse cx="1" cy="0.3" rx="0.3" ry="0.12" fill="${c.autumnGold}" opacity="0.45"/><ellipse cx="0" cy="0.6" rx="0.35" ry="0.12" fill="${c.mapleOrange}" opacity="0.4"/></g>`;
  }
  return `<g transform="translate(${x},${y})"><rect x="-0.6" y="-1" width="1.2" height="3.5" fill="${trunk}"/><circle cx="0" cy="-4" r="2.5" fill="${c.mapleRed}" opacity="0.7"/><circle cx="-1.5" cy="-3" r="1.5" fill="${c.mapleCrimson}" opacity="0.6"/><circle cx="1.5" cy="-3" r="1.5" fill="${c.mapleOrange}" opacity="0.55"/><circle cx="0" cy="-5.5" r="1.2" fill="${c.mapleRed}" opacity="0.5"/><circle cx="-0.8" cy="-2.5" r="0.9" fill="${c.mapleCrimson}" opacity="0.45"/></g>`;
}
function svgAutumnOak(x, y, c, v) {
  const trunk = c.trunk;
  if (v === 1) {
    return `<g transform="translate(${x},${y})"><rect x="-0.7" y="-1" width="1.4" height="4" fill="${trunk}"/><circle cx="0" cy="-3.5" r="2.8" fill="${c.autumnBronze}" opacity="0.65"/><circle cx="-1.2" cy="-4.5" r="1.5" fill="${c.autumnOlive}" opacity="0.55"/><circle cx="1.5" cy="-4" r="1.3" fill="${c.oakBrown}" opacity="0.6"/><circle cx="-0.5" cy="-2.5" r="1" fill="${c.autumnBronze}" opacity="0.5"/><circle cx="0.5" cy="-5.5" r="0.8" fill="${c.autumnOlive}" opacity="0.4"/></g>`;
  }
  if (v === 2) {
    return `<g transform="translate(${x},${y})"><rect x="-0.7" y="-1" width="1.4" height="4" fill="${trunk}"/><circle cx="0" cy="-3.5" r="2.6" fill="${c.autumnRust}" opacity="0.65"/><circle cx="-1.4" cy="-4.2" r="1.4" fill="${c.autumnBurgundy}" opacity="0.6"/><circle cx="1.3" cy="-3.8" r="1.5" fill="${c.autumnBronze}" opacity="0.55"/><circle cx="0" cy="-5.5" r="1" fill="${c.autumnRust}" opacity="0.5"/><ellipse cx="0" cy="0.5" rx="1.5" ry="0.3" fill="${c.autumnBurgundy}" opacity="0.3"/></g>`;
  }
  return `<g transform="translate(${x},${y})"><rect x="-0.7" y="-1" width="1.4" height="4" fill="${trunk}"/><circle cx="0" cy="-3.5" r="2.8" fill="${c.oakGold}" opacity="0.7"/><circle cx="-1.2" cy="-4.5" r="1.5" fill="${c.autumnGold}" opacity="0.6"/><circle cx="1.5" cy="-4" r="1.4" fill="${c.autumnBronze}" opacity="0.55"/><circle cx="-0.5" cy="-2.5" r="1" fill="${c.oakGold}" opacity="0.5"/><ellipse cx="0.8" cy="-2" rx="0.25" ry="0.35" fill="${c.acornBody}"/></g>`;
}
function svgAutumnBirch(x, y, c, v) {
  const yellow = c.birchYellow;
  const bark = c.birchBark;
  if (v === 2) {
    return `<g transform="translate(${x},${y})"><rect x="-0.4" y="-1" width="0.8" height="4" fill="${bark}"/><line x1="0" y1="-2" x2="-2" y2="-3.5" stroke="${bark}" stroke-width="0.3"/><line x1="0" y1="-3" x2="1.5" y2="-4" stroke="${bark}" stroke-width="0.3"/><circle cx="-1.5" cy="-3.8" r="1" fill="${yellow}" opacity="0.4"/><circle cx="1" cy="-4.2" r="0.8" fill="${yellow}" opacity="0.35"/></g>`;
  }
  const opacity = v === 1 ? 0.55 : 0.7;
  return `<g transform="translate(${x},${y})"><rect x="-0.4" y="-1" width="0.8" height="4" fill="${bark}"/><circle cx="0" cy="-3" r="2" fill="${yellow}" opacity="${opacity}"/><circle cx="-1" cy="-2" r="1.2" fill="${yellow}" opacity="${opacity * 0.8}"/><circle cx="1" cy="-3.5" r="1" fill="${yellow}" opacity="${opacity * 0.7}"/></g>`;
}
function svgAutumnGinkgo(x, y, c, v) {
  const yellow = c.ginkgoYellow;
  const trunk = c.trunk;
  if (v === 1) {
    return `<g transform="translate(${x},${y})"><rect x="-0.4" y="-1" width="0.8" height="3" fill="${trunk}"/><circle cx="0" cy="-3" r="1.8" fill="${yellow}" opacity="0.55"/><ellipse cx="0" cy="0.5" rx="2" ry="0.4" fill="${yellow}" opacity="0.3"/></g>`;
  }
  if (v === 2) {
    return `<g transform="translate(${x},${y})"><rect x="-0.4" y="-1" width="0.8" height="3" fill="${trunk}"/><circle cx="0" cy="-3" r="1.5" fill="${yellow}" opacity="0.4"/><ellipse cx="0" cy="0.5" rx="3" ry="0.8" fill="${yellow}" opacity="0.35"/></g>`;
  }
  return `<g transform="translate(${x},${y})"><rect x="-0.4" y="-1" width="0.8" height="3" fill="${trunk}"/><circle cx="0" cy="-3.2" r="2" fill="${yellow}" opacity="0.7"/><circle cx="-0.8" cy="-2.5" r="1" fill="${yellow}" opacity="0.5"/><circle cx="0.8" cy="-2.5" r="1" fill="${yellow}" opacity="0.5"/></g>`;
}
function svgFallenLeaves(x, y, c, v) {
  const colors = v === 0 ? [c.fallenLeafRed, c.fallenLeafOrange] : v === 1 ? [c.fallenLeafGold, c.fallenLeafBrown] : [c.fallenLeafRed, c.fallenLeafGold, c.fallenLeafOrange];
  const parts = [];
  for (let i = 0; i < colors.length; i++) {
    const lx = (i - colors.length / 2) * 1.2;
    const ly = i % 2 * 0.3;
    const rot = i * 35 - 20;
    parts.push(
      `<ellipse cx="${lx}" cy="${ly}" rx="0.6" ry="0.25" fill="${colors[i]}" opacity="0.7" transform="rotate(${rot},${lx},${ly})"/>`
    );
  }
  return `<g transform="translate(${x},${y})">${parts.join("")}</g>`;
}
function svgLeafSwirl(x, y, c, v) {
  const colors = v === 1 ? [c.fallenLeafRed, c.mapleRed] : v === 2 ? [c.fallenLeafGold, c.oakGold] : [c.fallenLeafRed, c.fallenLeafOrange, c.fallenLeafGold];
  const parts = [];
  for (let i = 0; i < colors.length; i++) {
    const angle = i / colors.length * Math.PI * 2;
    const radius = 1 + i * 0.3;
    const lx = Math.cos(angle) * radius;
    const ly = -1.5 + Math.sin(angle) * radius * 0.5;
    parts.push(
      `<ellipse cx="${lx.toFixed(1)}" cy="${ly.toFixed(1)}" rx="0.4" ry="0.2" fill="${colors[i]}" opacity="0.65" transform="rotate(${(i * 60).toFixed(0)},${lx.toFixed(1)},${ly.toFixed(1)})"/>`
    );
  }
  return `<g transform="translate(${x},${y})">${parts.join("")}</g>`;
}
function svgAcorn(x, y, c, v) {
  const body = c.acornBody;
  const cap = c.acornCap;
  const count = v === 1 ? 2 : 1;
  const parts = [];
  for (let i = 0; i < count; i++) {
    const ax = i * 1 - (count - 1) * 0.5;
    if (v === 2) {
      parts.push(`<ellipse cx="${ax}" cy="0" rx="0.4" ry="0.5" fill="${body}"/>`);
      parts.push(`<ellipse cx="${ax + 0.5}" cy="0.1" rx="0.4" ry="0.25" fill="${cap}"/>`);
    } else {
      parts.push(`<ellipse cx="${ax}" cy="0" rx="0.4" ry="0.5" fill="${body}"/>`);
      parts.push(`<path d="M${ax - 0.45},-0.15 Q${ax},-0.45 ${ax + 0.45},-0.15" fill="${cap}"/>`);
      parts.push(
        `<line x1="${ax}" y1="-0.35" x2="${ax}" y2="-0.55" stroke="${cap}" stroke-width="0.15"/>`
      );
    }
  }
  return `<g transform="translate(${x},${y})">${parts.join("")}</g>`;
}
function svgPumpkinPatch(x, y, c, v) {
  const pumpkin = c.pumpkin;
  const stem = c.trunk;
  const vine = c.autumnOlive || "#8b8b40";
  if (v === 1) {
    return `<g transform="translate(${x},${y})"><ellipse cx="-1" cy="0" rx="1" ry="0.7" fill="${pumpkin}"/><rect x="-1.15" y="-0.7" width="0.3" height="0.4" fill="${stem}"/><ellipse cx="0.8" cy="0.2" rx="0.8" ry="0.6" fill="${pumpkin}"/><rect x="0.65" y="-0.4" width="0.25" height="0.35" fill="${stem}"/><ellipse cx="0" cy="0.5" rx="0.6" ry="0.45" fill="${pumpkin}" opacity="0.9"/><path d="M-1.5,-0.3 Q-2,-0.8 -1.5,-1.2" stroke="${vine}" fill="none" stroke-width="0.15"/></g>`;
  }
  if (v === 2) {
    return `<g transform="translate(${x},${y})"><ellipse cx="0" cy="0" rx="1.4" ry="1" fill="${pumpkin}"/><line x1="-0.5" y1="-0.9" x2="-0.5" y2="0.9" stroke="${c.autumnRust || "#c05530"}" stroke-width="0.1" opacity="0.3"/><line x1="0.5" y1="-0.9" x2="0.5" y2="0.9" stroke="${c.autumnRust || "#c05530"}" stroke-width="0.1" opacity="0.3"/><rect x="-0.15" y="-1" width="0.3" height="0.5" fill="${stem}"/><path d="M0.1,-0.8 Q0.8,-1.2 1.2,-0.8" stroke="${vine}" fill="none" stroke-width="0.12"/></g>`;
  }
  return `<g transform="translate(${x},${y})"><ellipse cx="-0.6" cy="0" rx="0.9" ry="0.65" fill="${pumpkin}"/><rect x="-0.75" y="-0.65" width="0.25" height="0.35" fill="${stem}"/><ellipse cx="0.7" cy="0.15" rx="0.7" ry="0.5" fill="${pumpkin}" opacity="0.9"/><rect x="0.55" y="-0.35" width="0.22" height="0.3" fill="${stem}"/><path d="M-1,-0.2 Q-1.5,-0.5 -1.3,-1" stroke="${vine}" fill="none" stroke-width="0.12"/></g>`;
}
function svgHayMaze(x, y, c, v) {
  const hay = c.haybale;
  const accent = c.autumnGold || "#d4a84b";
  if (v === 1) {
    return `<g transform="translate(${x},${y})"><rect x="-2" y="-0.8" width="4" height="1.2" rx="0.2" fill="${hay}"/><rect x="-2" y="-2" width="1.2" height="1.3" rx="0.2" fill="${hay}"/><line x1="-1.5" y1="-0.7" x2="-1.5" y2="0.3" stroke="${accent}" stroke-width="0.08"/><line x1="0" y1="-0.7" x2="0" y2="0.3" stroke="${accent}" stroke-width="0.08"/><line x1="1.5" y1="-0.7" x2="1.5" y2="0.3" stroke="${accent}" stroke-width="0.08"/></g>`;
  }
  return `<g transform="translate(${x},${y})"><rect x="-1.5" y="-0.5" width="3" height="1" rx="0.2" fill="${hay}"/><rect x="-1" y="-1.3" width="2" height="0.9" rx="0.2" fill="${hay}" opacity="0.9"/><line x1="-0.8" y1="-0.4" x2="-0.8" y2="0.4" stroke="${accent}" stroke-width="0.08"/><line x1="0.8" y1="-0.4" x2="0.8" y2="0.4" stroke="${accent}" stroke-width="0.08"/></g>`;
}
function svgAppleBasket(x, y, c, v) {
  const basket = c.nestBrown || "#7a5530";
  const apple = c.appleRed || "#c41e3a";
  const green = c.pearGreen || "#d1e231";
  if (v === 1) {
    return `<g transform="translate(${x},${y})"><path d="M-1.2,0 Q-1.5,-1 0,-1 Q1.5,-1 1.2,0 L1,0.3 L-1,0.3 Z" fill="${basket}"/><circle cx="-0.5" cy="-0.8" r="0.4" fill="${apple}"/><circle cx="0.3" cy="-0.9" r="0.35" fill="${apple}"/><circle cx="0" cy="-0.5" r="0.4" fill="${green}"/><circle cx="-0.2" cy="-1.3" r="0.35" fill="${apple}"/><circle cx="0.5" cy="-0.4" r="0.3" fill="${apple}" opacity="0.9"/><path d="M-0.5,0.3 Q0,-0.2 0.5,0.3" stroke="${basket}" fill="none" stroke-width="0.1"/></g>`;
  }
  return `<g transform="translate(${x},${y})"><path d="M-1,0 Q-1.3,-0.8 0,-0.8 Q1.3,-0.8 1,0 L0.8,0.2 L-0.8,0.2 Z" fill="${basket}"/><circle cx="-0.3" cy="-0.5" r="0.35" fill="${apple}"/><circle cx="0.3" cy="-0.6" r="0.3" fill="${apple}"/><circle cx="0" cy="-0.3" r="0.3" fill="${green}"/><path d="M-0.4,0.2 Q0,-0.1 0.4,0.2" stroke="${basket}" fill="none" stroke-width="0.08"/></g>`;
}
function svgRake(x, y, c, v) {
  const handle = c.trunk;
  const metal = c.sledRunner || "#607080";
  const leaf = c.fallenLeafOrange || "#d08030";
  if (v === 1) {
    return `<g transform="translate(${x},${y})"><line x1="-1" y1="1" x2="1.5" y2="-3" stroke="${handle}" stroke-width="0.3"/><rect x="0.8" y="-3.2" width="1.5" height="0.3" fill="${metal}"/><line x1="0.9" y1="-3" x2="0.9" y2="-2.2" stroke="${metal}" stroke-width="0.12"/><line x1="1.3" y1="-3" x2="1.3" y2="-2.2" stroke="${metal}" stroke-width="0.12"/><line x1="1.7" y1="-3" x2="1.7" y2="-2.2" stroke="${metal}" stroke-width="0.12"/><line x1="2.1" y1="-3" x2="2.1" y2="-2.2" stroke="${metal}" stroke-width="0.12"/><ellipse cx="-1.5" cy="0.8" rx="1.2" ry="0.5" fill="${leaf}" opacity="0.6"/><ellipse cx="-1.2" cy="0.5" rx="0.8" ry="0.3" fill="${c.fallenLeafRed || "#c04030"}" opacity="0.5"/></g>`;
  }
  return `<g transform="translate(${x},${y})"><line x1="0" y1="0.5" x2="0" y2="-2.5" stroke="${handle}" stroke-width="0.25"/><rect x="-0.8" y="-2.7" width="1.6" height="0.25" fill="${metal}"/><line x1="-0.6" y1="-2.5" x2="-0.6" y2="-1.8" stroke="${metal}" stroke-width="0.1"/><line x1="-0.2" y1="-2.5" x2="-0.2" y2="-1.8" stroke="${metal}" stroke-width="0.1"/><line x1="0.2" y1="-2.5" x2="0.2" y2="-1.8" stroke="${metal}" stroke-width="0.1"/><line x1="0.6" y1="-2.5" x2="0.6" y2="-1.8" stroke="${metal}" stroke-width="0.1"/></g>`;
}
function svgCornStalkAsset(x, y, c, v) {
  const stalk = c.cornStalkColor;
  const ear = c.cornEar;
  const count = v === 1 ? 3 : 1;
  const parts = [];
  for (let i = 0; i < count; i++) {
    const sx = i * 1.2 - (count - 1) * 0.6;
    parts.push(
      `<line x1="${sx}" y1="0.5" x2="${sx}" y2="-3" stroke="${stalk}" stroke-width="0.4"/>`
    );
    if (v === 2 || v === 0) {
      parts.push(`<ellipse cx="${sx + 0.5}" cy="-1.5" rx="0.3" ry="0.7" fill="${ear}"/>`);
    }
    parts.push(
      `<path d="M${sx},-2 Q${sx + 1.5},-2.5 ${sx + 1},-1" fill="${stalk}" opacity="0.5"/>`
    );
    parts.push(
      `<path d="M${sx},-1.5 Q${sx - 1.5},-2 ${sx - 1},-0.5" fill="${stalk}" opacity="0.5"/>`
    );
  }
  return `<g transform="translate(${x},${y})">${parts.join("")}</g>`;
}
function svgScarecrowAutumn(x, y, c, v) {
  const hat = c.scarecrowHat || "#5a4020";
  const body = c.scarecrow || "#8a7040";
  if (v === 1) {
    return `<g transform="translate(${x},${y})"><line x1="0" y1="1" x2="0" y2="-3" stroke="${body}" stroke-width="0.5"/><line x1="-2" y1="-1.5" x2="2" y2="-1.5" stroke="${body}" stroke-width="0.4"/><circle cx="0" cy="-3.5" r="0.8" fill="${c.lambWool || "#f0ece5"}"/><rect x="-1.2" y="-4.5" width="2.4" height="0.5" fill="${hat}"/><rect x="-0.7" y="-5" width="1.4" height="0.6" fill="${hat}"/><circle cx="1.8" cy="-2" r="0.4" fill="#333"/><polygon points="1.8,-2 2.5,-2.1 1.8,-1.8" fill="#333"/></g>`;
  }
  if (v === 2) {
    return `<g transform="translate(${x},${y})"><line x1="0" y1="1" x2="0" y2="-3" stroke="${body}" stroke-width="0.5"/><line x1="-2" y1="-1.5" x2="2" y2="-1.5" stroke="${body}" stroke-width="0.4"/><circle cx="0" cy="-3.8" r="1" fill="${c.pumpkin || "#d07020"}"/><polygon points="-0.3,-3.8 0,-4.3 0.3,-3.8" fill="#333"/><polygon points="0,-3.5 0.5,-3.3 0,-3.2" fill="#333"/></g>`;
  }
  return `<g transform="translate(${x},${y})"><line x1="0" y1="1" x2="0" y2="-3" stroke="${body}" stroke-width="0.5"/><line x1="-2" y1="-1.5" x2="2" y2="-1.5" stroke="${body}" stroke-width="0.4"/><circle cx="0" cy="-3.5" r="0.8" fill="${c.lambWool || "#f0ece5"}"/><rect x="-1.2" y="-4.5" width="2.4" height="0.5" fill="${hat}"/><rect x="-0.7" y="-5" width="1.4" height="0.6" fill="${hat}"/><ellipse cx="0" cy="-1" rx="1.2" ry="1.5" fill="${body}" opacity="0.5"/><ellipse cx="-1" cy="-1.8" rx="0.4" ry="0.2" fill="${c.fallenLeafRed || "#c04030"}"/></g>`;
}
function svgHarvestBasket(x, y, c, v) {
  const basket = c.oakBrown || "#8a6030";
  const contents = v === 0 ? [c.harvestApple, c.harvestApple] : v === 1 ? (
    /* v8 ignore start */
    [c.sproutGreen || "#80d050", c.harvestApple, c.sunflowerPetal || "#f0c820"]
  ) : (
    /* v8 ignore stop */
    [c.harvestGrape, c.harvestGrape]
  );
  return `<g transform="translate(${x},${y})"><path d="M-1.5,0 Q-1.8,-1 -1,-1.5 Q0,-1.8 1,-1.5 Q1.8,-1 1.5,0 Z" fill="${basket}"/><path d="M-1,-1.3 Q0,-2 1,-1.3" fill="none" stroke="${basket}" stroke-width="0.3"/>` + contents.map(
    (col, i) => `<circle cx="${(i - (contents.length - 1) / 2) * 0.6}" cy="-1" r="0.35" fill="${col}"/>`
  ).join("") + `</g>`;
}
function svgHotDrink(x, y, c, v) {
  const mug = c.hotDrinkMug;
  const steam = c.hotDrinkSteam;
  return `<g transform="translate(${x},${y})"><rect x="-0.6" y="-1" width="1.2" height="1.2" rx="0.2" fill="${mug}"/><path d="M0.6,-0.5 Q1.2,-0.5 1.2,-0.1 Q1.2,0.2 0.6,0.2" fill="none" stroke="${mug}" stroke-width="0.2"/><path d="M-0.3,-1.2 Q-0.3,-1.8 0,-1.5 Q0.3,-1.8 0.3,-1.2" fill="none" stroke="${steam}" stroke-width="0.2" opacity="0.5"/>` + (v >= 1 ? `<path d="M0,-1.5 Q0.2,-2 0,-2.2" fill="none" stroke="${steam}" stroke-width="0.15" opacity="0.4"/>` : "") + `</g>`;
}
function svgAutumnWreath(x, y, c, v) {
  const green = c.wreathGreen;
  const berry = c.wreathBerry;
  return `<g transform="translate(${x},${y})"><circle cx="0" cy="-1.5" r="1.5" fill="none" stroke="${green}" stroke-width="0.8"/><circle cx="0" cy="-1.5" r="1.2" fill="none" stroke="${green}" stroke-width="0.4" opacity="0.5"/>` + (v >= 1 ? `<circle cx="0.8" cy="-0.8" r="0.2" fill="${berry}"/><circle cx="1" cy="-1" r="0.2" fill="${berry}"/>` : "") + /* v8 ignore start */
  (v === 2 ? `<path d="M-0.3,-0.2 Q0,0.2 0.3,-0.2" fill="${c.scarfRed || "#cc3030"}" opacity="0.7"/>` : "") + /* v8 ignore stop */
  `</g>`;
}
var RENDERERS = {
  // Water
  whale: svgWhale,
  fish: svgFish,
  fishSchool: svgFishSchool,
  boat: svgBoat,
  seagull: svgSeagull,
  dock: svgDock,
  waves: svgWaves,
  kelp: svgKelp,
  coral: svgCoral,
  jellyfish: svgJellyfish,
  turtle: svgTurtle,
  buoy: svgBuoy,
  sailboat: svgSailboat,
  lighthouse: svgLighthouse,
  crab: svgCrab,
  // Shore/Wetland
  rock: svgRock,
  boulder: svgBoulder,
  flower: svgFlower,
  bush: svgBush,
  driftwood: svgDriftwood,
  sandcastle: svgSandcastle,
  tidePools: svgTidePools,
  heron: svgHeron,
  shellfish: svgShellfish,
  cattail: svgCattail,
  frog: svgFrog,
  lily: svgLily,
  // Grassland
  pine: svgPine,
  deciduous: svgDeciduous,
  mushroom: svgMushroom,
  stump: svgStump,
  deer: svgDeer,
  rabbit: svgRabbit,
  fox: svgFox,
  butterfly: svgButterfly,
  beehive: svgBeehive,
  wildflowerPatch: svgWildflowerPatch,
  tallGrass: svgTallGrass,
  birch: svgBirch,
  haybale: svgHaybale,
  // Forest
  willow: svgWillow,
  palm: svgPalm,
  bird: svgBird,
  owl: svgOwl,
  squirrel: svgSquirrel,
  moss: svgMoss,
  fern: svgFern,
  deadTree: svgDeadTree,
  log: svgLog,
  berryBush: svgBerryBush,
  spider: svgSpider,
  // Farm
  wheat: svgWheat,
  fence: svgFence,
  scarecrow: svgScarecrow,
  barn: svgBarn,
  sheep: svgSheep,
  cow: svgCow,
  chicken: svgChicken,
  horse: svgHorse,
  donkey: svgDonkey,
  goat: svgGoat,
  ricePaddy: svgRicePaddy,
  silo: svgSilo,
  pigpen: svgPigpen,
  trough: svgTrough,
  haystack: svgHaystack,
  orchard: svgOrchard,
  appleTree: svgAppleTree,
  oliveTree: svgOliveTree,
  lemonTree: svgLemonTree,
  orangeTree: svgOrangeTree,
  pearTree: svgPearTree,
  peachTree: svgPeachTree,
  beeFarm: svgBeeFarm,
  pumpkin: svgPumpkin,
  // Village
  tent: svgTent,
  hut: svgHut,
  house: svgHouse,
  houseB: svgHouseB,
  church: svgChurch,
  windmill: svgWindmill,
  well: svgWell,
  tavern: svgTavern,
  bakery: svgBakery,
  stable: svgStable,
  garden: svgGarden,
  laundry: svgLaundry,
  doghouse: svgDoghouse,
  shrine: svgShrine,
  wagon: svgWagon,
  // Town/City
  market: svgMarket,
  inn: svgInn,
  blacksmith: svgBlacksmith,
  castle: svgCastle,
  tower: svgTower,
  bridge: svgBridge,
  cathedral: svgCathedral,
  library: svgLibrary,
  clocktower: svgClocktower,
  statue: svgStatue,
  park: svgPark,
  warehouse: svgWarehouse,
  gatehouse: svgGatehouse,
  manor: svgManor,
  // Biome blend
  reeds: svgReeds,
  fountain: svgFountain,
  canal: svgCanal,
  watermill: svgWatermill,
  gardenTree: svgGardenTree,
  pondLily: svgPondLily,
  // Cross-level
  cart: svgCart,
  barrel: svgBarrel,
  torch: svgTorch,
  flag: svgFlag,
  cobblePath: svgCobblePath,
  smoke: svgSmoke,
  signpost: svgSignpost,
  lantern: svgLantern,
  woodpile: svgWoodpile,
  puddle: svgPuddle,
  campfire: svgCampfire,
  // Seasonal: Winter
  snowPine: svgSnowPine,
  snowDeciduous: svgSnowDeciduous,
  snowman: svgSnowman,
  snowdrift: svgSnowdrift,
  igloo: svgIgloo,
  frozenPond: svgFrozenPond,
  icicle: svgIcicle,
  sled: svgSled,
  snowCoveredRock: svgSnowCoveredRock,
  bareBush: svgBareBush,
  winterBird: svgWinterBird,
  firewood: svgFirewood,
  houseWinter: svgHouseWinter,
  houseBWinter: svgHouseBWinter,
  barnWinter: svgBarnWinter,
  churchWinter: svgChurchWinter,
  christmasTree: svgChristmasTree,
  winterLantern: svgWinterLantern,
  frozenFountain: svgFrozenFountain,
  // Seasonal: Spring
  cherryBlossom: svgCherryBlossom,
  cherryBlossomSmall: svgCherryBlossomSmall,
  cherryPetals: svgCherryPetals,
  tulip: svgTulip,
  tulipField: svgTulipField,
  sprout: svgSprout,
  nest: svgNest,
  lamb: svgLamb,
  crocus: svgCrocus,
  rainPuddle: svgRainPuddle,
  birdhouse: svgBirdhouse,
  gardenBed: svgGardenBed,
  cherryBlossomFull: svgCherryBlossomFull,
  cherryBlossomBranch: svgCherryBlossomBranch,
  peachBlossom: svgPeachBlossom,
  flowerBed: svgFlowerBed,
  wateringCan: svgWateringCan,
  seedling: svgSeedling,
  robinBird: svgRobinBird,
  butterflyGarden: svgButterflyGarden,
  umbrella: svgUmbrella,
  // Seasonal: Summer
  parasol: svgParasol,
  beachTowel: svgBeachTowel,
  sandcastleSummer: svgSandcastleSummer,
  surfboard: svgSurfboard,
  iceCreamCart: svgIceCreamCartAsset,
  hammock: svgHammock,
  sunflower: svgSunflower,
  watermelon: svgWatermelon,
  sprinkler: svgSprinkler,
  lemonade: svgLemonade,
  fireflies: svgFirefliesAsset,
  swimmingPool: svgSwimmingPool,
  // Seasonal: Autumn
  autumnMaple: svgAutumnMaple,
  autumnOak: svgAutumnOak,
  autumnBirch: svgAutumnBirch,
  autumnGinkgo: svgAutumnGinkgo,
  fallenLeaves: svgFallenLeaves,
  leafSwirl: svgLeafSwirl,
  acorn: svgAcorn,
  cornStalk: svgCornStalkAsset,
  scarecrowAutumn: svgScarecrowAutumn,
  harvestBasket: svgHarvestBasket,
  hotDrink: svgHotDrink,
  autumnWreath: svgAutumnWreath,
  pumpkinPatch: svgPumpkinPatch,
  hayMaze: svgHayMaze,
  appleBasket: svgAppleBasket,
  rake: svgRake
};
function renderSeasonalTerrainAssets(isoCells, seed, weekPalettes, variantSeed, biomeMap, seasonRotation, density = 5, excludeCells) {
  const placed = selectAssets(
    isoCells,
    seed,
    variantSeed,
    biomeMap,
    seasonRotation,
    density,
    excludeCells
  );
  const svgParts = placed.map((a) => {
    const weekIdx = Math.min(a.cell.week, weekPalettes.length - 1);
    const palette = weekPalettes[weekIdx];
    const c = palette.assets;
    const renderer = RENDERERS[a.type];
    return renderer(a.cx + a.ox, a.cy + a.oy, c, a.variant);
  });
  return `<g class="terrain-assets">${svgParts.join("")}</g>`;
}
function renderAssetCSS() {
  return [
    `@keyframes tree-sway { 0% { transform: rotate(-1.5deg); } 50% { transform: rotate(1.5deg); } 100% { transform: rotate(-1.5deg); } }`
  ].join("\n");
}

// src/themes/terrain/epics.ts
var TIER_CONFIG = {
  rare: {
    minLevel: 88,
    minRichness: 0.45,
    baseChance: 0.018,
    glowColor: "#FFD700",
    statsGate: (s) => s.total >= 200 || s.longestStreak >= 7
  },
  epic: {
    minLevel: 93,
    minRichness: 0.55,
    baseChance: 8e-3,
    glowColor: "#9B59B6",
    statsGate: (s) => s.total >= 500 && s.longestStreak >= 14
  },
  legendary: {
    minLevel: 97,
    minRichness: 0.65,
    baseChance: 3e-3,
    glowColor: "#00CED1",
    statsGate: (s) => s.total >= 1e3 && s.longestStreak >= 30
  }
};
var EPIC_BUILDINGS = [
  // Rare (14) — 9 natural, 5 landmark
  { type: "mountFuji", tier: "rare" },
  { type: "colosseum", tier: "rare" },
  { type: "giantSequoia", tier: "rare" },
  { type: "coralReef", tier: "rare" },
  { type: "pagoda", tier: "rare" },
  { type: "torii", tier: "rare" },
  { type: "geyser", tier: "rare" },
  { type: "hotSpring", tier: "rare" },
  { type: "eiffelTower", tier: "rare" },
  { type: "grandCanyon", tier: "rare" },
  { type: "windmillGrand", tier: "rare" },
  { type: "oasis", tier: "rare" },
  { type: "volcano", tier: "rare" },
  { type: "giantMushroom", tier: "rare" },
  // Epic (10) — 7 natural, 3 landmark
  { type: "aurora", tier: "epic" },
  { type: "tajMahal", tier: "epic" },
  { type: "giantWaterfall", tier: "epic" },
  { type: "stBasils", tier: "epic" },
  { type: "bambooGrove", tier: "epic" },
  { type: "operaHouse", tier: "epic" },
  { type: "glacierPeak", tier: "epic" },
  { type: "bioluminescentPool", tier: "epic" },
  { type: "meteorCrater", tier: "epic" },
  { type: "bonsaiGiant", tier: "epic" },
  // Legendary (6) — 5 natural, 1 structure
  { type: "floatingIsland", tier: "legendary" },
  { type: "crystalSpire", tier: "legendary" },
  { type: "dragonNest", tier: "legendary" },
  { type: "worldTree", tier: "legendary" },
  { type: "sakuraEternal", tier: "legendary" },
  { type: "ancientPortal", tier: "legendary" }
];
var MAX_EPIC_BUDGET = 3;
var MIN_MANHATTAN_DISTANCE = 3;
function manhattanDistance(a, w, d) {
  return Math.abs(a.week - w) + Math.abs(a.day - d);
}
function selectEpicBuildings(isoCells, seed, stats, biomeMap) {
  const epicSeed = hash(String(seed) + "epic");
  const rng = seededRandom(epicSeed);
  const placed = [];
  const epicCells = /* @__PURE__ */ new Set();
  const cellMap = /* @__PURE__ */ new Map();
  for (const cell of isoCells) {
    cellMap.set(`${cell.week},${cell.day}`, cell);
  }
  const passedTiers = /* @__PURE__ */ new Set();
  for (const tier of ["legendary", "epic", "rare"]) {
    if (TIER_CONFIG[tier].statsGate(stats)) {
      passedTiers.add(tier);
    }
  }
  const eligibleBuildings = EPIC_BUILDINGS.filter((b) => passedTiers.has(b.tier));
  if (eligibleBuildings.length === 0) return { placed, epicCells };
  let streakMultiplier = 1;
  if (stats.currentStreak >= 30) streakMultiplier = 1.44;
  else if (stats.currentStreak >= 7) streakMultiplier = 1.15;
  const shuffled = [...isoCells];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  for (const cell of shuffled) {
    if (placed.length >= MAX_EPIC_BUDGET) break;
    const key = `${cell.week},${cell.day}`;
    const biome = biomeMap?.get(key);
    if (biome?.isRiver || biome?.isPond) continue;
    const tooClose = placed.some(
      (p) => manhattanDistance(p, cell.week, cell.day) < MIN_MANHATTAN_DISTANCE
    );
    if (tooClose) continue;
    const richness = computeRichness(cell, cellMap);
    for (const tier of ["legendary", "epic", "rare"]) {
      if (!passedTiers.has(tier)) continue;
      const config = TIER_CONFIG[tier];
      if (cell.level100 < config.minLevel) continue;
      if (richness < config.minRichness) continue;
      const richnessExcess = richness - config.minRichness;
      const richnessBonus = 1 + Math.min(richnessExcess * 2, 0.5);
      const finalChance = config.baseChance * richnessBonus * streakMultiplier;
      if (rng() < finalChance) {
        const tierBuildings = eligibleBuildings.filter((b) => b.tier === tier);
        const building = tierBuildings[Math.floor(rng() * tierBuildings.length)];
        placed.push({
          type: building.type,
          tier,
          week: cell.week,
          day: cell.day,
          cx: cell.isoX,
          cy: cell.isoY
        });
        epicCells.add(key);
        break;
      }
      break;
    }
  }
  return { placed, epicCells };
}
function renderMountFuji(x, y, c) {
  return `<g transform="translate(${x},${y})"><ellipse cx="0" cy="0.2" rx="5" ry="1" fill="${c.shadow}" opacity="0.15"/><polygon points="-7,0 0,-13 7,0" fill="${c.boulder}"/><polygon points="0,-13 7,0 0,0" fill="${c.rock}" opacity="0.6"/><line x1="-4" y1="-4" x2="4" y2="-4" stroke="${c.rock}" stroke-width="0.3" opacity="0.4"/><line x1="-3" y1="-7" x2="3" y2="-7" stroke="${c.rock}" stroke-width="0.25" opacity="0.35"/><polygon points="-3,-9 0,-13 3,-9" fill="${c.snowCap}"/><polygon points="0,-13 3,-9 0,-9" fill="${c.snowGround}" opacity="0.7"/><path d="M-3,-9 Q-2,-8 -1,-8.6 Q0,-8 1,-8.6 Q2,-8 3,-9" fill="${c.snowCap}" opacity="0.5"/><circle cx="-4" cy="-2" r="0.8" fill="${c.epicJade}" opacity="0.5"/><circle cx="-2.5" cy="-2.5" r="0.7" fill="${c.epicJade}" opacity="0.45"/><circle cx="3" cy="-2" r="0.7" fill="${c.epicJade}" opacity="0.4"/></g>`;
}
function renderGiantSequoia(x, y, c) {
  return `<g transform="translate(${x},${y})"><ellipse cx="0" cy="0.2" rx="3.5" ry="0.8" fill="${c.shadow}" opacity="0.15"/><path d="M-2.5,0 Q-2.2,-0.8 -1.8,-1" stroke="${c.trunk}" stroke-width="0.6" fill="none"/><path d="M2.5,0 Q2.2,-0.8 1.8,-1" stroke="${c.trunk}" stroke-width="0.6" fill="none"/><rect x="-1.8" y="-7" width="3.6" height="7" fill="${c.trunk}" rx="0.6"/><rect x="-0.5" y="-7" width="1" height="7" fill="${c.trunk}" opacity="0.5"/><line x1="-1.8" y1="-4" x2="-2.8" y2="-4.5" stroke="${c.trunk}" stroke-width="0.5"/><line x1="1.8" y1="-5" x2="2.6" y2="-5.5" stroke="${c.trunk}" stroke-width="0.4"/><ellipse cx="0" cy="-9" rx="5.5" ry="3.5" fill="${c.bushDark}"/><ellipse cx="0" cy="-9" rx="5" ry="3.2" fill="${c.epicJade}"/><ellipse cx="-1.5" cy="-11" rx="3.5" ry="2.5" fill="${c.epicJade}" opacity="0.85"/><ellipse cx="1.5" cy="-11" rx="3" ry="2.2" fill="${c.leaf}" opacity="0.6"/><ellipse cx="0" cy="-12.5" rx="2.5" ry="1.8" fill="${c.leafLight}" opacity="0.5"/></g>`;
}
function renderCoralReef(x, y, c) {
  return `<g transform="translate(${x},${y})"><ellipse cx="0" cy="0.3" rx="5.5" ry="1.2" fill="${c.shadow}" opacity="0.12"/><ellipse cx="0" cy="0" rx="5" ry="1.5" fill="${c.coral}" opacity="0.3"/><path d="M-3,0 L-3,-4 L-4,-5.5 M-3,-3 L-2,-5" stroke="${c.coral}" stroke-width="0.8" fill="none"/><path d="M1,0 L1,-5 L0,-7 M1,-3 L2.2,-5.5" stroke="${c.epicMagic}" stroke-width="0.7" fill="none"/><path d="M3.5,0 Q3,-2 4.5,-4 Q5,-3 5.5,-4 Q5,-1.5 3.5,0" fill="${c.epicPortal}" opacity="0.5"/><circle cx="-4" cy="-5.8" r="1" fill="${c.coral}"/><circle cx="-2" cy="-5.3" r="0.7" fill="${c.coral}" opacity="0.8"/><circle cx="0" cy="-7.2" r="1.1" fill="${c.epicMagic}"/><circle cx="2.2" cy="-5.8" r="0.8" fill="${c.epicMagic}" opacity="0.8"/><path d="M-1,-3 L0.2,-3.4 L-1,-3.8 Z" fill="${c.epicGold}" opacity="0.7"/><path d="M-1.3,-3.2 L-1,-3.4 L-1.3,-3.6" fill="${c.epicGold}" opacity="0.5"/><circle cx="1.5" cy="-6" r="0.2" fill="${c.epicCrystal}" opacity="0.3"/><circle cx="0.5" cy="-8" r="0.15" fill="${c.epicCrystal}" opacity="0.25"/></g>`;
}
function renderGeyser(x, y, c) {
  return `<g transform="translate(${x},${y})"><ellipse cx="0" cy="0.2" rx="3.5" ry="0.8" fill="${c.shadow}" opacity="0.15"/><ellipse cx="0" cy="0" rx="3.5" ry="1.4" fill="${c.rock}"/><ellipse cx="0" cy="-0.3" rx="2.5" ry="1" fill="${c.boulder}"/><ellipse cx="0" cy="-0.2" rx="1.5" ry="0.5" fill="${c.epicGold}" opacity="0.2"/><path d="M-1,-1 Q-0.6,-5 0,-9 Q0.6,-5 1,-1" fill="${c.epicCrystal}" opacity="0.45"/><path d="M-0.5,-1 Q0,-6 0.5,-1" fill="${c.epicCrystal}" opacity="0.25"/><circle cx="-1.5" cy="-9" r="0.6" fill="${c.epicCrystal}" opacity="0.3"/><circle cx="1.2" cy="-9.5" r="0.5" fill="${c.epicCrystal}" opacity="0.25"/><circle cx="0" cy="-10.5" r="0.7" fill="${c.epicCrystal}" opacity="0.2"/><circle cx="-0.8" cy="-11" r="0.4" fill="${c.epicCrystal}" opacity="0.15"/><path d="M-2,-7 Q-2.5,-8.5 -1.5,-9.5" stroke="${c.epicCrystal}" stroke-width="0.3" fill="none" opacity="0.2"/><path d="M1.5,-8 Q2,-9.5 1,-10" stroke="${c.epicCrystal}" stroke-width="0.25" fill="none" opacity="0.18"/></g>`;
}
function renderHotSpring(x, y, c) {
  return `<g transform="translate(${x},${y})"><ellipse cx="0" cy="0.3" rx="5" ry="1.2" fill="${c.shadow}" opacity="0.12"/><ellipse cx="0" cy="0" rx="5" ry="2.2" fill="${c.rock}"/><circle cx="-3.5" cy="-0.5" r="1" fill="${c.boulder}" opacity="0.6"/><circle cx="3.5" cy="-0.3" r="0.9" fill="${c.boulder}" opacity="0.55"/><circle cx="0" cy="-1.8" r="0.7" fill="${c.boulder}" opacity="0.5"/><ellipse cx="0" cy="-0.3" rx="3.8" ry="1.6" fill="none" stroke="${c.epicGold}" stroke-width="0.3" opacity="0.2"/><ellipse cx="0" cy="-0.3" rx="3.5" ry="1.5" fill="${c.epicCrystal}" opacity="0.45"/><ellipse cx="0" cy="-0.5" rx="2" ry="0.8" fill="${c.epicPortal}" opacity="0.25"/><path d="M-1.5,-1 Q-2,-3 -1,-4.5" stroke="${c.epicCrystal}" stroke-width="0.3" fill="none" opacity="0.35"/><path d="M0.5,-1 Q0,-3.5 1,-5" stroke="${c.epicCrystal}" stroke-width="0.3" fill="none" opacity="0.3"/><path d="M2,-0.8 Q2.5,-2.5 2,-4" stroke="${c.epicCrystal}" stroke-width="0.25" fill="none" opacity="0.25"/></g>`;
}
function renderGrandCanyon(x, y, c) {
  return `<g transform="translate(${x},${y})"><ellipse cx="0" cy="0.3" rx="6" ry="1" fill="${c.shadow}" opacity="0.12"/><polygon points="-6,0 -5,-7 -3,-6 -2,-8 -1,-4" fill="${c.boulder}"/><polygon points="-6,0 -5,-5 -3,-4 -1,-4 -1,0" fill="${c.rock}" opacity="0.7"/><line x1="-5.5" y1="-2" x2="-1.5" y2="-2" stroke="${c.epicGold}" stroke-width="0.3" opacity="0.3"/><line x1="-5" y1="-4" x2="-2" y2="-4" stroke="${c.rock}" stroke-width="0.25" opacity="0.4"/><polygon points="1,-4 2,-8 3,-6 5,-7 6,0" fill="${c.boulder}"/><polygon points="1,-4 1,0 6,0 5,-5 3,-4" fill="${c.rock}" opacity="0.7"/><line x1="1.5" y1="-2" x2="5.5" y2="-2" stroke="${c.epicGold}" stroke-width="0.3" opacity="0.3"/><line x1="2" y1="-4" x2="5" y2="-4" stroke="${c.rock}" stroke-width="0.25" opacity="0.4"/><path d="M-0.8,0 Q0,-0.3 0.8,0" fill="${c.epicCrystal}" opacity="0.4"/><circle cx="-5" cy="-7.3" r="0.5" fill="${c.epicJade}" opacity="0.4"/><circle cx="4.5" cy="-7.3" r="0.4" fill="${c.epicJade}" opacity="0.35"/></g>`;
}
function renderOasis(x, y, c) {
  return `<g transform="translate(${x},${y})"><ellipse cx="0" cy="0.3" rx="5" ry="1.2" fill="${c.shadow}" opacity="0.12"/><ellipse cx="0" cy="0.2" rx="5.5" ry="2" fill="${c.epicGold}" opacity="0.15"/><ellipse cx="0" cy="0" rx="4" ry="1.5" fill="${c.epicCrystal}" opacity="0.5"/><ellipse cx="0" cy="-0.2" rx="3" ry="1" fill="${c.epicCrystal}" opacity="0.3"/><path d="M-2.5,0 Q-2.8,-3 -2.2,-6" stroke="${c.trunk}" stroke-width="0.7" fill="none"/><path d="M-2.2,-6 Q-4.5,-5.5 -5.5,-4.5" stroke="${c.palm}" stroke-width="0.5" fill="none"/><path d="M-2.2,-6 Q-0.5,-5.5 0.5,-5.5" stroke="${c.palm}" stroke-width="0.5" fill="none"/><path d="M-2.2,-6 Q-3.5,-5 -4,-3.5" stroke="${c.palm}" stroke-width="0.4" fill="none"/><path d="M-2.2,-6 Q-1,-7 0,-7" stroke="${c.palm}" stroke-width="0.4" fill="none"/><path d="M2,0 Q2.3,-2.5 1.8,-5" stroke="${c.trunk}" stroke-width="0.6" fill="none"/><path d="M1.8,-5 Q4,-4.5 4.5,-3.5" stroke="${c.palm}" stroke-width="0.45" fill="none"/><path d="M1.8,-5 Q0,-4.5 -0.8,-4.5" stroke="${c.palm}" stroke-width="0.45" fill="none"/><path d="M1.8,-5 Q3,-3.5 3.5,-2.5" stroke="${c.palm}" stroke-width="0.35" fill="none"/></g>`;
}
function renderColosseum(x, y, c) {
  return `<g transform="translate(${x},${y})"><ellipse cx="0" cy="0.3" rx="5.5" ry="1.2" fill="${c.shadow}" opacity="0.15"/><ellipse cx="0" cy="-2" rx="5.5" ry="3.2" fill="${c.epicMarble}"/><ellipse cx="0" cy="-2.5" rx="3.5" ry="1.8" fill="${c.wallShade}" opacity="0.5"/><line x1="-4" y1="-5" x2="-4" y2="-2" stroke="${c.wall}" stroke-width="0.4"/><line x1="-2" y1="-5.5" x2="-2" y2="-2.5" stroke="${c.wall}" stroke-width="0.4"/><line x1="0" y1="-5.5" x2="0" y2="-2.5" stroke="${c.wall}" stroke-width="0.4"/><line x1="2" y1="-5.5" x2="2" y2="-2.5" stroke="${c.wall}" stroke-width="0.4"/><line x1="4" y1="-5" x2="4" y2="-2" stroke="${c.wall}" stroke-width="0.4"/><path d="M-4,-4.5 Q-3,-5.5 -2,-4.8" fill="none" stroke="${c.wall}" stroke-width="0.3"/><path d="M-2,-5 Q-1,-5.8 0,-5" fill="none" stroke="${c.wall}" stroke-width="0.3"/><path d="M0,-5 Q1,-5.8 2,-5" fill="none" stroke="${c.wall}" stroke-width="0.3"/><path d="M2,-4.8 Q3,-5.5 4,-4.5" fill="none" stroke="${c.wall}" stroke-width="0.3"/></g>`;
}
function renderPagoda(x, y, c) {
  return `<g transform="translate(${x},${y})"><ellipse cx="0" cy="0.2" rx="3" ry="0.6" fill="${c.shadow}" opacity="0.15"/><rect x="-2.5" y="-3" width="5" height="3" fill="${c.epicMarble}"/><rect x="-2.5" y="-3" width="2.5" height="3" fill="${c.wallShade}" opacity="0.2"/><path d="M-4.5,-3 Q-3,-4 0,-4.5 Q3,-4 4.5,-3" fill="${c.roofA}"/><rect x="-1.8" y="-7" width="3.6" height="2.5" fill="${c.epicMarble}"/><path d="M-3.5,-7 Q-2,-8 0,-8.2 Q2,-8 3.5,-7" fill="${c.roofA}"/><rect x="-1.2" y="-10.5" width="2.4" height="2.3" fill="${c.epicMarble}"/><path d="M-2.5,-10.5 Q-1,-11.5 0,-11.8 Q1,-11.5 2.5,-10.5" fill="${c.roofA}"/><line x1="0" y1="-11.8" x2="0" y2="-13.5" stroke="${c.epicGold}" stroke-width="0.4"/><circle cx="0" cy="-13.7" r="0.3" fill="${c.epicGold}"/><circle cx="0" cy="-2" r="0.4" fill="${c.wallShade}" opacity="0.5"/><circle cx="0" cy="-6" r="0.3" fill="${c.wallShade}" opacity="0.4"/></g>`;
}
function renderTorii(x, y, c) {
  return `<g transform="translate(${x},${y})"><ellipse cx="0" cy="0.2" rx="4" ry="0.7" fill="${c.shadow}" opacity="0.15"/><rect x="-4.5" y="-0.5" width="1.5" height="0.5" fill="${c.rock}" rx="0.2"/><rect x="3" y="-0.5" width="1.5" height="0.5" fill="${c.rock}" rx="0.2"/><path d="M-4.2,-0.5 L-3.8,-8 L-3.3,-8 L-3.5,-0.5 Z" fill="${c.roofA}"/><path d="M3.5,-0.5 L3.3,-8 L3.8,-8 L4.2,-0.5 Z" fill="${c.roofA}"/><path d="M-5.5,-7.5 Q0,-9.5 5.5,-7.5" stroke="${c.roofA}" stroke-width="1" fill="none"/><path d="M-5.5,-7.5 Q0,-9 5.5,-7.5" fill="${c.roofA}"/><rect x="-4.2" y="-6.5" width="8.4" height="0.5" fill="${c.roofA}"/><rect x="-0.8" y="-7.5" width="1.6" height="1.5" fill="${c.epicGold}" opacity="0.3" rx="0.1"/></g>`;
}
function renderEiffelTower(x, y, c) {
  return `<g transform="translate(${x},${y})"><ellipse cx="0" cy="0.2" rx="2.5" ry="0.5" fill="${c.shadow}" opacity="0.15"/><path d="M-3.5,0 Q-1.75,-2 0,0" fill="none" stroke="${c.boulder}" stroke-width="0.4"/><path d="M0,0 Q1.75,-2 3.5,0" fill="none" stroke="${c.boulder}" stroke-width="0.4"/><line x1="-3.5" y1="0" x2="-0.6" y2="-10" stroke="${c.boulder}" stroke-width="0.5"/><line x1="3.5" y1="0" x2="0.6" y2="-10" stroke="${c.boulder}" stroke-width="0.5"/><line x1="-2.5" y1="-3" x2="2.5" y2="-3" stroke="${c.boulder}" stroke-width="0.3"/><line x1="-1.8" y1="-5.5" x2="1.8" y2="-5.5" stroke="${c.boulder}" stroke-width="0.3"/><line x1="-2.5" y1="-3" x2="1.8" y2="-5.5" stroke="${c.boulder}" stroke-width="0.15" opacity="0.5"/><line x1="2.5" y1="-3" x2="-1.8" y2="-5.5" stroke="${c.boulder}" stroke-width="0.15" opacity="0.5"/><rect x="-2" y="-5.8" width="4" height="0.5" fill="${c.boulder}"/><line x1="0" y1="-10" x2="0" y2="-14" stroke="${c.boulder}" stroke-width="0.4"/><rect x="-0.8" y="-10.3" width="1.6" height="0.5" fill="${c.boulder}"/><line x1="0" y1="-14" x2="0" y2="-14.5" stroke="${c.epicGold}" stroke-width="0.2"/></g>`;
}
function renderWindmillGrand(x, y, c) {
  return `<g transform="translate(${x},${y})"><ellipse cx="0" cy="0.2" rx="2.5" ry="0.5" fill="${c.shadow}" opacity="0.15"/><polygon points="-2.5,0 -1.5,-8 1.5,-8 2.5,0" fill="${c.windmill}"/><polygon points="-2.5,0 -1.5,-8 0,-8 0,0" fill="${c.wallShade}" opacity="0.15"/><polygon points="-2,-8 0,-10.5 2,-8" fill="${c.roofA}"/><rect x="-0.6" y="-1.5" width="1.2" height="1.5" fill="${c.wallShade}" opacity="0.4" rx="0.6" ry="0"/><circle cx="0" cy="-5" r="0.5" fill="${c.wallShade}" opacity="0.3"/><g transform="translate(0,-7.5)"><g><polygon points="-0.4,0 -0.2,-6 0.2,-6 0.4,0" fill="${c.windBlade}" opacity="0.85"/><polygon points="0,-0.4 6,-0.2 6,0.2 0,0.4" fill="${c.windBlade}" opacity="0.85"/><polygon points="-0.4,0 -0.2,6 0.2,6 0.4,0" fill="${c.windBlade}" opacity="0.85"/><polygon points="0,-0.4 -6,-0.2 -6,0.2 0,0.4" fill="${c.windBlade}" opacity="0.85"/><animateTransform attributeName="transform" type="rotate" values="0;360" dur="6s" repeatCount="indefinite"/></g></g><circle cx="0" cy="-7.5" r="0.6" fill="${c.boulder}"/></g>`;
}
function renderVolcano(x, y, c) {
  return `<g transform="translate(${x},${y})"><ellipse cx="0" cy="0.3" rx="5.5" ry="1.2" fill="${c.shadow}" opacity="0.15"/><polygon points="-6,0 -1.8,-9 1.8,-9 6,0" fill="${c.boulder}"/><polygon points="0,-9 1.8,-9 6,0 0,0" fill="${c.rock}" opacity="0.5"/><line x1="-4" y1="-3" x2="4" y2="-3" stroke="${c.rock}" stroke-width="0.25" opacity="0.3"/><ellipse cx="0" cy="-9" rx="2" ry="0.8" fill="#ff4500"/><ellipse cx="0" cy="-9" rx="1.2" ry="0.5" fill="#ff8c00"/><ellipse cx="0" cy="-9" rx="0.6" ry="0.25" fill="#ffcc00" opacity="0.7"/><path d="M0.5,-9 Q1,-7 0.8,-5" stroke="#ff4500" stroke-width="0.4" fill="none" opacity="0.6"/><circle cx="-0.5" cy="-10.5" r="0.5" fill="${c.rock}" opacity="0.3"/><circle cx="0.5" cy="-11.5" r="0.6" fill="${c.rock}" opacity="0.25"/><circle cx="-0.2" cy="-12.5" r="0.4" fill="${c.rock}" opacity="0.2"/></g>`;
}
function renderGiantMushroom(x, y, c) {
  return `<g transform="translate(${x},${y})"><ellipse cx="0" cy="0.2" rx="3" ry="0.6" fill="${c.shadow}" opacity="0.15"/><rect x="-1.2" y="-5" width="2.4" height="5" fill="${c.mushroom}" rx="0.4"/><ellipse cx="0" cy="-2" rx="1.3" ry="0.3" fill="${c.mushroom}" opacity="0.5"/><ellipse cx="0" cy="-5" rx="5" ry="1.2" fill="${c.mushroom}" opacity="0.6"/><line x1="-3" y1="-5" x2="-1" y2="-5" stroke="${c.mushroom}" stroke-width="0.15" opacity="0.4"/><line x1="1" y1="-5" x2="3" y2="-5" stroke="${c.mushroom}" stroke-width="0.15" opacity="0.4"/><ellipse cx="0" cy="-6.5" rx="5" ry="3.2" fill="${c.mushroomCap}"/><ellipse cx="-1" cy="-7.5" rx="2" ry="1" fill="${c.mushroomCap}" opacity="0.4"/><circle cx="-2.5" cy="-7" r="0.7" fill="${c.mushroom}" opacity="0.5"/><circle cx="1.8" cy="-6.5" r="0.6" fill="${c.mushroom}" opacity="0.45"/><circle cx="0" cy="-8.5" r="0.5" fill="${c.mushroom}" opacity="0.4"/><circle cx="-1" cy="-5.5" r="0.4" fill="${c.mushroom}" opacity="0.35"/></g>`;
}
function renderAurora(x, y, c) {
  return `<g transform="translate(${x},${y})"><ellipse cx="0" cy="0" rx="5" ry="1.5" fill="${c.snowGround}" opacity="0.3"/><path d="M-6,-2 Q-3,-8 0,-5 Q3,-9 6,-3" stroke="${c.epicJade}" stroke-width="1.5" fill="none" opacity="0.4" class="epic-glow-pulse"/><path d="M-5,-3 Q-2,-10 1,-6 Q4,-11 6,-4" stroke="${c.epicPortal}" stroke-width="1" fill="none" opacity="0.35" class="epic-glow-pulse"/><path d="M-6,-1 Q-3,-6 0,-4 Q3,-7 5,-2" stroke="${c.epicMagic}" stroke-width="0.8" fill="none" opacity="0.3"/><path d="M-4,-4 Q-1,-11 2,-7 Q5,-12 6,-5" stroke="${c.epicCrystal}" stroke-width="0.6" fill="none" opacity="0.25" class="epic-glow-pulse"/><polygon points="-4,0 -3.5,-2 -3,0" fill="${c.epicJade}" opacity="0.4"/><polygon points="-2,0 -1.5,-2.5 -1,0" fill="${c.epicJade}" opacity="0.35"/><polygon points="2.5,0 3,-1.8 3.5,0" fill="${c.epicJade}" opacity="0.35"/><circle cx="-3" cy="-10" r="0.2" fill="${c.epicCrystal}" opacity="0.5"/><circle cx="2" cy="-11" r="0.15" fill="${c.epicCrystal}" opacity="0.4"/><circle cx="4.5" cy="-9" r="0.18" fill="${c.epicCrystal}" opacity="0.45"/></g>`;
}
function renderGiantWaterfall(x, y, c) {
  return `<g transform="translate(${x},${y})"><ellipse cx="0" cy="0.5" rx="5" ry="1" fill="${c.shadow}" opacity="0.12"/><rect x="-5.5" y="-10" width="4" height="10" fill="${c.boulder}"/><rect x="-5.5" y="-10" width="2" height="10" fill="${c.rock}" opacity="0.3"/><rect x="1.5" y="-10" width="4" height="10" fill="${c.rock}"/><rect x="3.5" y="-10" width="2" height="10" fill="${c.boulder}" opacity="0.3"/><rect x="-1.5" y="-10" width="3" height="10" fill="${c.epicCrystal}" opacity="0.45"/><rect x="-0.6" y="-10" width="1.2" height="10" fill="${c.epicCrystal}" opacity="0.25"/><line x1="-1" y1="-4" x2="1" y2="-4" stroke="${c.epicCrystal}" stroke-width="0.2" opacity="0.3"/><line x1="-0.8" y1="-7" x2="0.8" y2="-7" stroke="${c.epicCrystal}" stroke-width="0.15" opacity="0.25"/><ellipse cx="0" cy="-10.5" rx="6" ry="1.5" fill="${c.epicJade}"/><ellipse cx="-1" cy="0.5" rx="2.5" ry="0.8" fill="${c.epicCrystal}" opacity="0.2"/><ellipse cx="1" cy="0.3" rx="2" ry="0.6" fill="${c.epicCrystal}" opacity="0.15"/><circle cx="-3" cy="0" r="0.6" fill="${c.boulder}" opacity="0.5"/><circle cx="3.5" cy="0.2" r="0.5" fill="${c.rock}" opacity="0.4"/></g>`;
}
function renderBambooGrove(x, y, c) {
  return `<g transform="translate(${x},${y})"><ellipse cx="0" cy="0.2" rx="3.5" ry="0.7" fill="${c.shadow}" opacity="0.12"/><line x1="-3" y1="0" x2="-3" y2="-11" stroke="${c.epicJade}" stroke-width="0.7"/><line x1="-1.5" y1="0" x2="-1.5" y2="-13" stroke="${c.epicJade}" stroke-width="0.6"/><line x1="0" y1="0" x2="0" y2="-12" stroke="${c.epicJade}" stroke-width="0.7"/><line x1="1.5" y1="0" x2="1.5" y2="-11.5" stroke="${c.epicJade}" stroke-width="0.6"/><line x1="3" y1="0" x2="3" y2="-10" stroke="${c.epicJade}" stroke-width="0.65"/><line x1="-3.4" y1="-4" x2="-2.6" y2="-4" stroke="${c.leaf}" stroke-width="0.3"/><line x1="-3.4" y1="-7" x2="-2.6" y2="-7" stroke="${c.leaf}" stroke-width="0.3"/><line x1="-1.9" y1="-5" x2="-1.1" y2="-5" stroke="${c.leaf}" stroke-width="0.3"/><line x1="-1.9" y1="-9" x2="-1.1" y2="-9" stroke="${c.leaf}" stroke-width="0.3"/><line x1="-0.4" y1="-6" x2="0.4" y2="-6" stroke="${c.leaf}" stroke-width="0.3"/><line x1="1.1" y1="-4.5" x2="1.9" y2="-4.5" stroke="${c.leaf}" stroke-width="0.3"/><line x1="2.6" y1="-5" x2="3.4" y2="-5" stroke="${c.leaf}" stroke-width="0.3"/><path d="M-3,-7 Q-4.5,-7 -5.5,-6.5" stroke="${c.leaf}" stroke-width="0.35" fill="none"/><path d="M-1.5,-9 Q-3,-9 -4,-8.5" stroke="${c.leaf}" stroke-width="0.3" fill="none"/><path d="M0,-6 Q1.5,-6 2.5,-5.5" stroke="${c.leaf}" stroke-width="0.3" fill="none"/><path d="M1.5,-4.5 Q3,-4.5 4,-4" stroke="${c.leaf}" stroke-width="0.3" fill="none"/><path d="M3,-5 Q4.5,-5 5,-4.5" stroke="${c.leaf}" stroke-width="0.25" fill="none"/></g>`;
}
function renderGlacierPeak(x, y, c) {
  return `<g transform="translate(${x},${y})"><ellipse cx="0" cy="0.3" rx="5" ry="1" fill="${c.shadow}" opacity="0.12"/><polygon points="-6,0 -1,-10 1,-10 6,0" fill="${c.ice}"/><polygon points="0,-10 1,-10 6,0 0,0" fill="${c.snowGround}" opacity="0.5"/><polygon points="-1,-10 0,-13.5 1,-10" fill="${c.snowCap}"/><polygon points="-3.5,-5 -2.5,-8 -1.5,-5" fill="${c.icicle}" opacity="0.5"/><polygon points="2,-4 3,-7.5 4,-4" fill="${c.icicle}" opacity="0.45"/><path d="M-5,-2 Q-3,-3 -1,-2 Q1,-3 3,-2 Q5,-3 6,0" fill="${c.snowCap}" opacity="0.25"/><line x1="-2" y1="-3" x2="-1" y2="-5.5" stroke="${c.epicCrystal}" stroke-width="0.25" opacity="0.4"/><line x1="1.5" y1="-2" x2="2" y2="-4" stroke="${c.epicCrystal}" stroke-width="0.2" opacity="0.35"/><line x1="-3" y1="-1" x2="-3.2" y2="0" stroke="${c.icicle}" stroke-width="0.3" opacity="0.4"/><line x1="3.5" y1="-1" x2="3.7" y2="0" stroke="${c.icicle}" stroke-width="0.25" opacity="0.35"/></g>`;
}
function renderBioluminescentPool(x, y, c) {
  return `<g transform="translate(${x},${y})"><ellipse cx="0" cy="0.3" rx="5.5" ry="1.2" fill="${c.shadow}" opacity="0.1"/><ellipse cx="0" cy="0" rx="5.5" ry="2.2" fill="${c.boulder}"/><circle cx="-4" cy="-0.5" r="0.8" fill="${c.rock}" opacity="0.5"/><circle cx="4" cy="-0.3" r="0.7" fill="${c.rock}" opacity="0.45"/><ellipse cx="0" cy="-0.3" rx="4" ry="1.5" fill="${c.epicPortal}" opacity="0.4" class="epic-glow-pulse"/><ellipse cx="0" cy="-0.5" rx="2.5" ry="0.9" fill="${c.epicPortal}" opacity="0.3" class="epic-glow-pulse"/><circle cx="-1.5" cy="-0.3" r="0.3" fill="${c.epicPortal}" opacity="0.6" class="epic-glow-pulse"/><circle cx="1.2" cy="-0.5" r="0.25" fill="${c.epicCrystal}" opacity="0.5" class="epic-glow-pulse"/><circle cx="0" cy="0.2" r="0.2" fill="${c.epicPortal}" opacity="0.4"/><line x1="-3" y1="-1" x2="-3" y2="-2" stroke="${c.epicPortal}" stroke-width="0.2"/><ellipse cx="-3" cy="-2.2" rx="0.4" ry="0.25" fill="${c.epicPortal}" opacity="0.5" class="epic-glow-pulse"/><line x1="3.5" y1="-0.8" x2="3.5" y2="-1.8" stroke="${c.epicPortal}" stroke-width="0.2"/><ellipse cx="3.5" cy="-2" rx="0.35" ry="0.2" fill="${c.epicCrystal}" opacity="0.45" class="epic-glow-pulse"/></g>`;
}
function renderMeteorCrater(x, y, c) {
  return `<g transform="translate(${x},${y})"><ellipse cx="0" cy="0.3" rx="5.5" ry="1.2" fill="${c.shadow}" opacity="0.12"/><ellipse cx="0" cy="0" rx="5.5" ry="2.8" fill="${c.rock}"/><ellipse cx="0" cy="-0.3" rx="4" ry="1.8" fill="${c.boulder}" opacity="0.7"/><ellipse cx="0" cy="-0.2" rx="2.2" ry="0.9" fill="${c.shadow}" opacity="0.5"/><polygon points="-0.5,-0.5 0.2,-1.2 0.8,-0.3 0.3,0.2" fill="${c.rock}"/><polygon points="-0.5,-0.5 0.2,-1.2 0.8,-0.3 0.3,0.2" fill="${c.epicGold}" opacity="0.3"/><circle cx="0.1" cy="-0.4" r="1" fill="${c.epicGold}" opacity="0.15"/><circle cx="-4.5" cy="-1" r="0.5" fill="${c.rock}" opacity="0.5"/><circle cx="4" cy="0.5" r="0.6" fill="${c.rock}" opacity="0.45"/><circle cx="-2.5" cy="1.2" r="0.35" fill="${c.boulder}" opacity="0.4"/><circle cx="2.5" cy="-1.5" r="0.4" fill="${c.boulder}" opacity="0.35"/><line x1="0" y1="-0.5" x2="-3" y2="-1.5" stroke="${c.shadow}" stroke-width="0.2" opacity="0.3"/><line x1="0" y1="-0.5" x2="2.5" y2="0.5" stroke="${c.shadow}" stroke-width="0.2" opacity="0.25"/></g>`;
}
function renderTajMahal(x, y, c) {
  return `<g transform="translate(${x},${y})"><ellipse cx="0" cy="0.3" rx="5" ry="1" fill="${c.shadow}" opacity="0.15"/><rect x="-5" y="-1" width="10" height="1" fill="${c.epicMarble}" opacity="0.8"/><rect x="-3.5" y="-5" width="7" height="4" fill="${c.epicMarble}"/><rect x="0" y="-5" width="3.5" height="4" fill="${c.wallShade}" opacity="0.1"/><path d="M-1.2,-1 L-1.2,-3.5 Q0,-4.5 1.2,-3.5 L1.2,-1" fill="${c.wallShade}" opacity="0.3"/><path d="M-2.5,-5 Q-2.5,-8 0,-10.5 Q2.5,-8 2.5,-5" fill="${c.epicMarble}"/><line x1="0" y1="-10.5" x2="0" y2="-11.5" stroke="${c.epicGold}" stroke-width="0.3"/><circle cx="0" cy="-11.7" r="0.3" fill="${c.epicGold}"/><rect x="-5.5" y="-8" width="0.8" height="7" fill="${c.epicMarble}"/><circle cx="-5.1" cy="-8.3" r="0.4" fill="${c.epicGold}"/><rect x="4.7" y="-8" width="0.8" height="7" fill="${c.epicMarble}"/><circle cx="5.1" cy="-8.3" r="0.4" fill="${c.epicGold}"/><line x1="-3.5" y1="-3" x2="3.5" y2="-3" stroke="${c.epicGold}" stroke-width="0.2" opacity="0.4"/></g>`;
}
function renderStBasils(x, y, c) {
  return `<g transform="translate(${x},${y})"><ellipse cx="0" cy="0.3" rx="4" ry="0.8" fill="${c.shadow}" opacity="0.15"/><rect x="-3.5" y="-4" width="7" height="4" fill="${c.epicMarble}"/><rect x="-3.5" y="-4" width="3.5" height="4" fill="${c.wallShade}" opacity="0.1"/><rect x="-0.8" y="-7" width="1.6" height="3" fill="${c.epicMarble}"/><path d="M-3,-4 Q-3,-6 -3,-7 Q-3.8,-6 -3.8,-5 Q-3.8,-4.5 -3,-4" fill="${c.roofA}"/><circle cx="-3" cy="-7.3" r="0.25" fill="${c.epicGold}"/><path d="M-0.8,-7 Q-0.8,-9.5 0,-10.5 Q0.8,-9.5 0.8,-7" fill="${c.epicJade}"/><circle cx="0" cy="-10.8" r="0.3" fill="${c.epicGold}"/><path d="M3,-4 Q3,-6 3,-7 Q3.8,-6 3.8,-5 Q3.8,-4.5 3,-4" fill="${c.epicMagic}"/><circle cx="3" cy="-7.3" r="0.25" fill="${c.epicGold}"/><line x1="-3" y1="-5.5" x2="-3" y2="-6.5" stroke="${c.epicGold}" stroke-width="0.15" opacity="0.4"/><line x1="0" y1="-8" x2="0" y2="-9.5" stroke="${c.epicGold}" stroke-width="0.15" opacity="0.4"/><path d="M-0.4,-4.5 Q0,-5.2 0.4,-4.5" fill="${c.wallShade}" opacity="0.4"/></g>`;
}
function renderOperaHouse(x, y, c) {
  return `<g transform="translate(${x},${y})"><ellipse cx="0" cy="0.3" rx="5.5" ry="1" fill="${c.shadow}" opacity="0.15"/><rect x="-5.5" y="-0.5" width="11" height="0.8" fill="${c.epicMarble}" opacity="0.8"/><rect x="-5" y="-1" width="10" height="0.5" fill="${c.epicMarble}"/><path d="M-5,-1 Q-3.5,-7 -2,-1" fill="${c.epicMarble}"/><path d="M-2.5,-1 Q-0.5,-9 1.5,-1" fill="${c.epicMarble}"/><path d="M0.5,-1 Q2.5,-7.5 4,-1" fill="${c.epicMarble}"/><path d="M3,-1 Q4.2,-5 5,-1" fill="${c.epicMarble}"/><path d="M-5,-1 Q-3.5,-7 -2,-1" fill="none" stroke="${c.wall}" stroke-width="0.2" opacity="0.3"/><path d="M-2.5,-1 Q-0.5,-9 1.5,-1" fill="none" stroke="${c.wall}" stroke-width="0.2" opacity="0.3"/><ellipse cx="0" cy="0.8" rx="4" ry="0.5" fill="${c.epicCrystal}" opacity="0.15"/></g>`;
}
function renderBonsaiGiant(x, y, c) {
  return `<g transform="translate(${x},${y})"><ellipse cx="0" cy="0.2" rx="3" ry="0.6" fill="${c.shadow}" opacity="0.15"/><ellipse cx="0" cy="0" rx="2.5" ry="0.8" fill="${c.rock}" opacity="0.5"/><path d="M-0.5,0 Q-1.5,-2 -2,-3.5 Q-2.5,-4.5 -2,-5.5" stroke="${c.trunk}" stroke-width="1.3" fill="none"/><path d="M-1.5,-3 Q0,-4 1.5,-4.5 Q2,-5 2,-6" stroke="${c.trunk}" stroke-width="0.9" fill="none"/><path d="M-2,-5.5 Q-3,-6 -3.5,-6.5" stroke="${c.trunk}" stroke-width="0.5" fill="none"/><ellipse cx="-2.5" cy="-7" rx="2" ry="1.3" fill="${c.bushDark}"/><ellipse cx="-2.5" cy="-7" rx="1.8" ry="1.1" fill="${c.epicJade}"/><ellipse cx="2" cy="-6.5" rx="2.2" ry="1.5" fill="${c.bushDark}"/><ellipse cx="2" cy="-6.5" rx="2" ry="1.3" fill="${c.epicJade}"/><ellipse cx="-0.5" cy="-8.5" rx="1.5" ry="1" fill="${c.bushDark}"/><ellipse cx="-0.5" cy="-8.5" rx="1.3" ry="0.8" fill="${c.epicJade}"/><ellipse cx="-1" cy="-9" rx="0.6" ry="0.4" fill="${c.leafLight}" opacity="0.4"/></g>`;
}
function renderFloatingIsland(x, y, c) {
  return `<g transform="translate(${x},${y})"><polygon points="-3.5,3 -2,1 0,0.5 2,1 3.5,3 1,4.5 -1,4.5" fill="${c.boulder}" opacity="0.7"/><polygon points="-2,1 0,0.5 2,1 1,4 -1,4" fill="${c.rock}" opacity="0.5"/><path d="M-1,3 Q-1.5,5 -1,6" stroke="${c.trunk}" stroke-width="0.3" fill="none" opacity="0.5"/><path d="M0.5,3.5 Q0,5.5 0.5,7" stroke="${c.trunk}" stroke-width="0.25" fill="none" opacity="0.4"/><ellipse cx="0" cy="-1" rx="4.5" ry="1.8" fill="${c.leaf}"/><ellipse cx="0" cy="-1.3" rx="3.5" ry="1.2" fill="${c.epicJade}" opacity="0.5"/><rect x="-0.3" y="-4.5" width="0.6" height="3" fill="${c.trunk}"/><ellipse cx="0" cy="-5.5" rx="2" ry="1.5" fill="${c.bushDark}"/><ellipse cx="0" cy="-5.5" rx="1.8" ry="1.3" fill="${c.epicJade}"/><circle cx="2.5" cy="-1.5" r="0.8" fill="${c.epicJade}" opacity="0.7"/><ellipse cx="-3" cy="0" rx="1.2" ry="0.4" fill="${c.epicCrystal}" opacity="0.15"/><ellipse cx="3.5" cy="1" rx="1" ry="0.3" fill="${c.epicCrystal}" opacity="0.12"/></g>`;
}
function renderCrystalSpire(x, y, c) {
  return `<g transform="translate(${x},${y})"><ellipse cx="0" cy="0.3" rx="3" ry="0.6" fill="${c.shadow}" opacity="0.12"/><polygon points="-3.5,0 -3,-3 -2.5,0" fill="${c.epicCrystal}" opacity="0.4"/><polygon points="3,0 3.5,-2.5 4,0" fill="${c.epicCrystal}" opacity="0.35"/><polygon points="-4.5,0 -4,-2 -3.5,0" fill="${c.epicCrystal}" opacity="0.3"/><polygon points="-2,0 -0.5,-10 0,-13 0,0" fill="${c.epicCrystal}" opacity="0.7"/><polygon points="0,0 0,-13 0.5,-10 2,0" fill="${c.epicCrystal}" opacity="0.5"/><polygon points="-0.5,-3 0,-13 0.5,-3" fill="${c.epicCrystal}" opacity="0.3"/><polygon points="-2.5,0 -1.5,-6 -0.5,0" fill="${c.epicCrystal}" opacity="0.45"/><polygon points="1,0 2,-5 3,0" fill="${c.epicCrystal}" opacity="0.4"/><line x1="-0.3" y1="-8" x2="0.3" y2="-7" stroke="${c.epicCrystal}" stroke-width="0.3" opacity="0.6"/><line x1="-0.5" y1="-5" x2="0.2" y2="-4.5" stroke="${c.epicCrystal}" stroke-width="0.2" opacity="0.5"/><circle cx="0" cy="-13" r="0.4" fill="${c.epicCrystal}" opacity="0.4"/></g>`;
}
function renderDragonNest(x, y, c) {
  return `<g transform="translate(${x},${y})"><ellipse cx="0" cy="0.3" rx="5" ry="1.2" fill="${c.shadow}" opacity="0.15"/><ellipse cx="0" cy="-0.5" rx="5" ry="2" fill="${c.trunk}"/><path d="M-4,-0.5 Q-2,-1.5 0,-0.5 Q2,-1.5 4,-0.5" fill="none" stroke="${c.trunk}" stroke-width="0.5" opacity="0.5"/><path d="M-3.5,0 Q-1.5,-1 0.5,0 Q2.5,-1 4.5,0" fill="none" stroke="${c.trunk}" stroke-width="0.4" opacity="0.4"/><ellipse cx="0" cy="-1" rx="3.5" ry="1.2" fill="${c.trunk}" opacity="0.6"/><ellipse cx="-1.2" cy="-1.5" rx="0.8" ry="1" fill="${c.epicGold}"/><ellipse cx="0.5" cy="-1.5" rx="0.8" ry="1" fill="${c.epicGold}"/><ellipse cx="-0.3" cy="-2" rx="0.7" ry="0.9" fill="${c.epicCrystal}"/><ellipse cx="-1" cy="-1.8" rx="0.2" ry="0.3" fill="${c.epicGold}" opacity="0.3"/><ellipse cx="0.7" cy="-1.8" rx="0.2" ry="0.3" fill="${c.epicGold}" opacity="0.3"/><path d="M3.5,-1 Q4,-3 4.5,-4 Q5.5,-5 5,-6 Q4.5,-5.5 4.5,-5" fill="${c.epicJade}" opacity="0.6"/><path d="M4,-4 Q5.5,-6 6,-4.5 Q5,-3.5 4,-4" fill="${c.epicJade}" opacity="0.4"/><circle cx="4.7" cy="-5.5" r="0.15" fill="${c.epicGold}"/></g>`;
}
function renderWorldTree(x, y, c) {
  return `<g transform="translate(${x},${y})"><ellipse cx="0" cy="0.3" rx="4" ry="0.8" fill="${c.shadow}" opacity="0.15"/><path d="M-1.5,0 Q-3,0.5 -4,0" stroke="${c.trunk}" stroke-width="0.5" fill="none"/><path d="M1.5,0 Q3,0.5 4,0" stroke="${c.trunk}" stroke-width="0.5" fill="none"/><rect x="-2" y="-7" width="4" height="7" fill="${c.trunk}" rx="0.8"/><line x1="-0.5" y1="0" x2="-0.5" y2="-7" stroke="${c.trunk}" stroke-width="0.5" opacity="0.3"/><line x1="1" y1="0" x2="1" y2="-7" stroke="${c.trunk}" stroke-width="0.4" opacity="0.25"/><ellipse cx="0" cy="-9" rx="6" ry="4.5" fill="${c.bushDark}"/><ellipse cx="0" cy="-9" rx="5.5" ry="4" fill="${c.epicJade}"/><ellipse cx="-2" cy="-11" rx="3.5" ry="2.8" fill="${c.epicJade}" opacity="0.85"/><ellipse cx="2" cy="-11" rx="3.5" ry="2.8" fill="${c.epicJade}" opacity="0.8"/><ellipse cx="0" cy="-13" rx="3" ry="2" fill="${c.leaf}" opacity="0.6"/><ellipse cx="-1" cy="-13.5" rx="1.5" ry="0.8" fill="${c.leafLight}" opacity="0.4"/><circle cx="-4" cy="-9" r="0.3" fill="${c.epicGold}" class="epic-glow-pulse"/><circle cx="3" cy="-11" r="0.3" fill="${c.epicGold}" class="epic-glow-pulse"/><circle cx="0" cy="-7.5" r="0.25" fill="${c.epicGold}" class="epic-glow-pulse"/><circle cx="-2" cy="-13" r="0.2" fill="${c.epicGold}" class="epic-glow-pulse"/><circle cx="1.5" cy="-8" r="0.2" fill="${c.epicGold}" class="epic-glow-pulse"/></g>`;
}
function renderSakuraEternal(x, y, c) {
  return `<g transform="translate(${x},${y})"><ellipse cx="0" cy="0.3" rx="4" ry="0.8" fill="${c.shadow}" opacity="0.15"/><path d="M0,0 Q-0.5,-2 -1,-3.5 Q-1.5,-4.5 -1,-5.5" stroke="${c.trunk}" stroke-width="1.8" fill="none"/><path d="M-1,-5 Q-3,-6 -3.5,-7" stroke="${c.trunk}" stroke-width="1" fill="none"/><path d="M-0.8,-4.5 Q1.5,-6 2.5,-7" stroke="${c.trunk}" stroke-width="0.9" fill="none"/><path d="M-1,-5.5 Q-0.5,-7 0,-8" stroke="${c.trunk}" stroke-width="0.6" fill="none"/><ellipse cx="0" cy="-9.5" rx="5.5" ry="3.8" fill="${c.cherryPetalPink}" opacity="0.9"/><ellipse cx="-2" cy="-11" rx="3.5" ry="2.2" fill="${c.cherryPetalPink}" opacity="0.8"/><ellipse cx="2" cy="-11" rx="3" ry="2" fill="${c.cherryPetalWhite}" opacity="0.65"/><ellipse cx="0" cy="-12.5" rx="2.5" ry="1.5" fill="${c.cherryPetalPink}" opacity="0.6"/><ellipse cx="1" cy="-12" rx="1.2" ry="0.6" fill="${c.cherryPetalWhite}" opacity="0.4"/><circle cx="-5" cy="-5" r="0.3" fill="${c.cherryPetalPink}" opacity="0.6" class="epic-glow-pulse"/><circle cx="4" cy="-4" r="0.25" fill="${c.cherryPetalWhite}" opacity="0.5" class="epic-glow-pulse"/><circle cx="-3" cy="-2" r="0.2" fill="${c.cherryPetalPink}" opacity="0.45" class="epic-glow-pulse"/><circle cx="2" cy="-1" r="0.2" fill="${c.cherryPetalWhite}" opacity="0.4" class="epic-glow-pulse"/><circle cx="-1" cy="0.5" r="0.18" fill="${c.cherryPetalPink}" opacity="0.35"/></g>`;
}
function renderAncientPortal(x, y, c) {
  return `<g transform="translate(${x},${y})"><ellipse cx="0" cy="0.3" rx="4" ry="0.8" fill="${c.shadow}" opacity="0.15"/><rect x="-4.5" y="-9" width="2.2" height="9" fill="${c.rock}" rx="0.3"/><rect x="-4.5" y="-9" width="1.1" height="9" fill="${c.boulder}" opacity="0.3"/><rect x="2.3" y="-9" width="2.2" height="9" fill="${c.rock}" rx="0.3"/><rect x="3.4" y="-9" width="1.1" height="9" fill="${c.boulder}" opacity="0.3"/><path d="M-3.5,-9 Q0,-13 3.5,-9" fill="${c.rock}"/><path d="M-2.5,-9 Q0,-12 2.5,-9" fill="${c.boulder}" opacity="0.3"/><line x1="-3.5" y1="-3" x2="-3.5" y2="-4.5" stroke="${c.epicPortal}" stroke-width="0.3" opacity="0.4"/><circle cx="-3.5" cy="-6" r="0.3" fill="none" stroke="${c.epicPortal}" stroke-width="0.2" opacity="0.35"/><line x1="3.4" y1="-3" x2="3.4" y2="-4.5" stroke="${c.epicPortal}" stroke-width="0.3" opacity="0.4"/><circle cx="3.4" cy="-6" r="0.3" fill="none" stroke="${c.epicPortal}" stroke-width="0.2" opacity="0.35"/><ellipse cx="0" cy="-4.5" rx="2.5" ry="3.5" fill="${c.epicPortal}" opacity="0.35" class="epic-portal-swirl"/><ellipse cx="0" cy="-4.5" rx="1.5" ry="2.5" fill="${c.epicPortal}" opacity="0.25" class="epic-portal-swirl"/><ellipse cx="0" cy="-4.5" rx="0.6" ry="1" fill="${c.epicCrystal}" opacity="0.3" class="epic-portal-swirl"/><circle cx="0" cy="-11.5" r="0.4" fill="${c.epicPortal}" opacity="0.4" class="epic-glow-pulse"/></g>`;
}
var EPIC_RENDERERS = {
  // Rare — Natural
  mountFuji: renderMountFuji,
  giantSequoia: renderGiantSequoia,
  coralReef: renderCoralReef,
  geyser: renderGeyser,
  hotSpring: renderHotSpring,
  grandCanyon: renderGrandCanyon,
  oasis: renderOasis,
  volcano: renderVolcano,
  giantMushroom: renderGiantMushroom,
  // Rare — Landmarks
  colosseum: renderColosseum,
  pagoda: renderPagoda,
  torii: renderTorii,
  eiffelTower: renderEiffelTower,
  windmillGrand: renderWindmillGrand,
  // Epic — Natural
  aurora: renderAurora,
  giantWaterfall: renderGiantWaterfall,
  bambooGrove: renderBambooGrove,
  glacierPeak: renderGlacierPeak,
  bioluminescentPool: renderBioluminescentPool,
  meteorCrater: renderMeteorCrater,
  bonsaiGiant: renderBonsaiGiant,
  // Epic — Landmarks
  tajMahal: renderTajMahal,
  stBasils: renderStBasils,
  operaHouse: renderOperaHouse,
  // Legendary
  floatingIsland: renderFloatingIsland,
  crystalSpire: renderCrystalSpire,
  dragonNest: renderDragonNest,
  worldTree: renderWorldTree,
  sakuraEternal: renderSakuraEternal,
  ancientPortal: renderAncientPortal
};
function renderEpicGlowDefs(mode) {
  const tiers = [
    { id: "epic-glow-rare", color: "#FFD700", darkOuter: 0, lightOuter: 0 },
    { id: "epic-glow-epic", color: "#9B59B6", darkOuter: 0, lightOuter: 0 },
    { id: "epic-glow-legendary", color: "#00CED1", darkOuter: 0, lightOuter: 0 }
  ];
  return tiers.map(
    (t) => `<radialGradient id="${t.id}"><stop offset="0%" stop-color="${t.color}" stop-opacity="${mode === "dark" ? 0.4 : 0.3}"/><stop offset="100%" stop-color="${t.color}" stop-opacity="0"/></radialGradient>`
  ).join("");
}
function renderEpicCSS() {
  return [
    `@keyframes epic-pulse { 0%,100% { opacity: 0.4; } 50% { opacity: 0.9; } }`,
    `.epic-glow-pulse { animation: epic-pulse 3s ease-in-out infinite; }`,
    `@keyframes epic-swirl { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`,
    `.epic-portal-swirl { animation: epic-swirl 8s linear infinite; transform-origin: center; }`
  ].join("\n");
}
function renderEpicBuildings(placed, weekPalettes) {
  if (placed.length === 0) return "";
  const parts = placed.map((epic) => {
    const weekIdx = Math.min(epic.week, weekPalettes.length - 1);
    const palette = weekPalettes[weekIdx];
    const c = palette.assets;
    const renderer = EPIC_RENDERERS[epic.type];
    const glowId = `epic-glow-${epic.tier}`;
    const glow = `<ellipse cx="${epic.cx}" cy="${epic.cy}" rx="8" ry="4" fill="url(#${glowId})" opacity="0.6"/>`;
    const building = renderer(epic.cx, epic.cy, c);
    return glow + building;
  });
  return `<g class="epic-buildings">${parts.join("")}</g>`;
}

// src/themes/terrain/biomes.ts
function generateBiomeMap(weeks, days, seed) {
  const rng = seededRandom(seed);
  const map = /* @__PURE__ */ new Map();
  for (let w = 0; w < weeks; w++) {
    for (let d = 0; d < days; d++) {
      map.set(`${w},${d}`, {
        isRiver: false,
        isPond: false,
        nearWater: false,
        forestDensity: 0
      });
    }
  }
  const NUM_RIVERS = 2;
  const riverBends = [];
  for (let r = 0; r < NUM_RIVERS; r++) {
    let day = r === 0 ? Math.floor(rng() * Math.floor(days / 2)) : Math.floor(days / 2) + Math.floor(rng() * Math.ceil(days / 2));
    for (let week = 0; week < weeks; week++) {
      const ctx = map.get(`${week},${day}`);
      if (ctx) ctx.isRiver = true;
      const drift = rng();
      const prevDay = day;
      if (drift < 0.2) day = Math.max(0, day - 1);
      else if (drift > 0.8) day = Math.min(days - 1, day + 1);
      if (day !== prevDay) {
        riverBends.push({ w: week, d: day });
      }
    }
  }
  const numPonds = Math.min(riverBends.length, 1 + Math.floor(rng() * 2));
  const shuffledBends = riverBends.map((b) => ({ b, sort: rng() })).sort((a, b) => a.sort - b.sort).map((x) => x.b);
  for (let p = 0; p < numPonds; p++) {
    const center = shuffledBends[p];
    if (!center) break;
    const pondSize = 2 + Math.floor(rng() * 3);
    const pondCells = [center];
    for (let i = 0; i < pondSize; i++) {
      const base = pondCells[Math.floor(rng() * pondCells.length)];
      const dw = Math.floor(rng() * 3) - 1;
      const dd = Math.floor(rng() * 3) - 1;
      const nw = base.w + dw;
      const nd = base.d + dd;
      if (nw >= 0 && nw < weeks && nd >= 0 && nd < days) {
        pondCells.push({ w: nw, d: nd });
      }
    }
    for (const pc of pondCells) {
      const ctx = map.get(`${pc.w},${pc.d}`);
      if (ctx) ctx.isPond = true;
    }
  }
  for (let w = 0; w < weeks; w++) {
    for (let d = 0; d < days; d++) {
      const ctx = map.get(`${w},${d}`);
      if (ctx.isRiver || ctx.isPond) continue;
      const neighbors = [
        map.get(`${w - 1},${d}`),
        map.get(`${w + 1},${d}`),
        map.get(`${w},${d - 1}`),
        map.get(`${w},${d + 1}`)
      ];
      if (neighbors.some((n) => n && (n.isRiver || n.isPond))) {
        ctx.nearWater = true;
      }
    }
  }
  const numForests = 4 + Math.floor(rng() * 3);
  const nuclei = [];
  for (let f = 0; f < numForests; f++) {
    nuclei.push({
      w: Math.floor(rng() * weeks),
      d: Math.floor(rng() * days),
      radius: 2 + rng() * 3
    });
  }
  for (let w = 0; w < weeks; w++) {
    for (let d = 0; d < days; d++) {
      const ctx = map.get(`${w},${d}`);
      let maxDensity = 0;
      for (const nucleus of nuclei) {
        const dist = Math.sqrt((w - nucleus.w) ** 2 + (d - nucleus.d) ** 2);
        if (dist < nucleus.radius) {
          const density = 1 - dist / nucleus.radius;
          if (density > maxDensity) maxDensity = density;
        }
      }
      ctx.forestDensity = maxDensity;
    }
  }
  return map;
}

// src/themes/terrain/index.ts
var terrainTheme = {
  name: "terrain",
  displayName: "Terrain",
  description: "Your contributions build a living world \u2014 more code, richer civilization",
  render(data, options) {
    const stats = computeStats(data.weeks);
    const dataWithStats = { ...data, stats };
    return {
      dark: renderMode(dataWithStats, options, "dark"),
      light: renderMode(dataWithStats, options, "light")
    };
  }
};
function renderMode(data, options, mode) {
  const hemisphere = options.hemisphere || "north";
  const density = options.density ?? 5;
  const oldestDate = new Date(data.weeks[0]?.days[0]?.date || /* @__PURE__ */ new Date());
  const seasonRotation = computeSeasonRotation(oldestDate, hemisphere);
  const seed = hash(data.username + mode);
  const variantSeed = hash(data.username + String(data.year));
  const weekPalettes = [];
  for (let w = 0; w < 52; w++) {
    weekPalettes.push(getSeasonalPalette100(mode, w, seasonRotation));
  }
  const palette = weekPalettes[26];
  const cells = contributionGrid(data, {
    cellSize: 11,
    gap: 2,
    offsetX: 24,
    offsetY: 42
  });
  const cells100 = enrichGridCells100(cells, data);
  const originX = 405;
  const originY = 6;
  const isoCells = getIsoCells(cells100, palette, originX, originY);
  const biomeMap = generateBiomeMap(52, 7, seed + 7919);
  const epicSeed = hash(data.username + "epic" + String(data.year));
  const { placed: epicPlaced, epicCells } = selectEpicBuildings(
    isoCells,
    epicSeed,
    data.stats,
    biomeMap
  );
  const terrainCSS = renderTerrainCSS(isoCells, biomeMap);
  const assetCSS = renderAssetCSS();
  const epicCSS = renderEpicCSS();
  const css = terrainCSS + "\n" + assetCSS + "\n" + epicCSS;
  const isDark = mode === "dark";
  const celestials = renderCelestials(seed, palette, isDark);
  const clouds = renderClouds(seed, palette);
  const blocks = renderSeasonalTerrainBlocks(
    cells100,
    weekPalettes,
    originX,
    originY,
    seasonRotation,
    biomeMap
  );
  const waterOverlays = renderWaterOverlays(isoCells, palette, biomeMap);
  const waterRipples = renderWaterRipples(isoCells, palette, biomeMap);
  const assets = renderSeasonalTerrainAssets(
    isoCells,
    seed,
    weekPalettes,
    variantSeed,
    biomeMap,
    seasonRotation,
    density,
    epicCells
  );
  const epicBuildings = renderEpicBuildings(epicPlaced, weekPalettes);
  const snowParticles = renderSnowParticles(isoCells, seed, seasonRotation);
  const fallingPetals = renderFallingPetals(isoCells, seed, palette, seasonRotation);
  const fallingLeaves = renderFallingLeaves(isoCells, seed, palette, seasonRotation);
  const overlays = renderAnimatedOverlays(isoCells, palette);
  const anchorLevels = [0, 20, 45, 70, 95];
  const levelColors = anchorLevels.map(
    (l) => ({
      hex: palette.getElevation(l).top,
      opacity: l === 0 ? 0.5 : 1
    })
  );
  const themePalette = {
    text: palette.text,
    contribution: { levels: levelColors },
    background: palette.bg
  };
  const title = renderTitle(options.title, themePalette);
  const statsBar = renderStatsBar(data.stats, themePalette);
  const epicDefs = epicPlaced.length > 0 ? `<defs>${renderEpicGlowDefs(mode)}</defs>` : "";
  const content = [
    svgStyle(css),
    epicDefs,
    celestials,
    clouds,
    blocks,
    waterOverlays,
    waterRipples,
    assets,
    epicBuildings,
    snowParticles,
    fallingPetals,
    fallingLeaves,
    overlays,
    title,
    statsBar
  ].join("\n");
  return svgRoot({ width: options.width, height: options.height }, content);
}
registerTheme(terrainTheme);

// src/index.ts
var program = new Command();
program.name("maeul-sky").description("Transform GitHub contributions into animated terrain SVGs").version("1.0.0").requiredOption("-u, --user <username>", "GitHub username").option("-t, --theme <name>", "Theme name", getDefaultTheme()).option("--title <text>", "Custom title text").option("-o, --output <dir>", "Output directory", "./").option("-y, --year <number>", "Year to visualize (omit for rolling 52 weeks)").option("--token <token>", "GitHub personal access token (or use GITHUB_TOKEN env)").option("--hemisphere <hemisphere>", "Hemisphere for seasonal terrain (north or south)", "north").option("--density <number>", "Building density 1-10 (higher = buildings at lower activity)", "5").action(async (opts) => {
  const hemisphere = opts.hemisphere === "south" ? "south" : "north";
  const density = Math.max(1, Math.min(10, parseInt(opts.density, 10) || 5));
  const options = {
    user: opts.user,
    theme: opts.theme,
    title: opts.title || `@${opts.user}`,
    output: opts.output,
    year: opts.year ? parseInt(opts.year, 10) : void 0,
    token: opts.token || process.env.GITHUB_TOKEN,
    hemisphere,
    density
  };
  const theme = getTheme(options.theme);
  if (!theme) {
    console.error(`Error: Unknown theme "${options.theme}"`);
    console.error(`Available themes: ${listThemes().join(", ")}`);
    process.exit(1);
  }
  try {
    const yearLabel = options.year ?? "last 52 weeks";
    console.log(`Fetching contributions for @${options.user} (${yearLabel})...`);
    const data = await fetchContributions(options.user, options.year, options.token);
    const stats = computeStats(data.weeks);
    const fullData = { ...data, stats };
    console.log(`Rendering with ${theme.displayName} theme...`);
    const output = theme.render(fullData, {
      title: options.title,
      width: 840,
      height: 240,
      hemisphere: options.hemisphere,
      density: options.density
    });
    const darkPath = join(options.output, `maeul-in-the-sky-dark.svg`);
    const lightPath = join(options.output, `maeul-in-the-sky-light.svg`);
    await writeFile(darkPath, output.dark, "utf-8");
    await writeFile(lightPath, output.light, "utf-8");
    console.log(`Written: ${darkPath}`);
    console.log(`Written: ${lightPath}`);
  } catch (error) {
    if (error instanceof Error) {
      console.error(`Error: ${error.message}`);
    } else {
      console.error(`Error: ${String(error)}`);
    }
    process.exit(1);
  }
});
program.parse();
//# sourceMappingURL=index.js.map