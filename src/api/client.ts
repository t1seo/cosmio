/**
 * GitHub GraphQL API client for fetching contribution data
 */

import type { ContributionData, ContributionWeek, ContributionDay } from '../core/types.js';
import { CONTRIBUTIONS_QUERY } from './queries.js';

/** GitHub GraphQL API endpoint */
const GITHUB_API_ENDPOINT = 'https://api.github.com/graphql';

/** GitHub's contribution level enum values */
type GitHubContributionLevel =
  | 'NONE'
  | 'FIRST_QUARTILE'
  | 'SECOND_QUARTILE'
  | 'THIRD_QUARTILE'
  | 'FOURTH_QUARTILE';

/** GraphQL API response structure */
interface GitHubApiResponse {
  data?: {
    user?: {
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
  errors?: Array<{
    type?: string;
    message: string;
  }>;
}

/**
 * Map GitHub's contribution level string to numeric 0-4
 */
function mapContributionLevel(level: GitHubContributionLevel): 0 | 1 | 2 | 3 | 4 {
  switch (level) {
    case 'NONE':
      return 0;
    case 'FIRST_QUARTILE':
      return 1;
    case 'SECOND_QUARTILE':
      return 2;
    case 'THIRD_QUARTILE':
      return 3;
    case 'FOURTH_QUARTILE':
      return 4;
    default:
      return 0;
  }
}

/**
 * Sleep for a specified number of milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Make a GraphQL request with retry logic
 */
async function makeGraphQLRequest(
  query: string,
  variables: Record<string, unknown>,
  token?: string,
): Promise<GitHubApiResponse> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    'User-Agent': 'maeul-in-the-sky',
  };

  if (token) {
    headers['Authorization'] = `bearer ${token}`;
  }

  const body = JSON.stringify({ query, variables });

  // Retry with exponential backoff: 1s, 2s, 4s
  const delays = [1000, 2000, 4000];

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(GITHUB_API_ENDPOINT, {
        method: 'POST',
        headers,
        body,
      });

      // Parse JSON response
      const data = (await response.json()) as GitHubApiResponse;

      // Check for GraphQL errors
      if (data.errors && data.errors.length > 0) {
        const error = data.errors[0];

        // Check if user not found
        if (error.type === 'NOT_FOUND' || error.message.includes('Could not resolve to a User')) {
          throw new Error(`GitHub user not found`);
        }

        // Check for rate limiting
        if (response.status === 403 || error.message.includes('rate limit')) {
          throw new Error(`GitHub API rate limit exceeded`);
        }

        throw new Error(`GitHub API error: ${error.message}`);
      }

      // Check for HTTP errors
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error(`Authentication failed: invalid GitHub token`);
        }
        if (response.status === 403) {
          throw new Error(`GitHub API rate limit exceeded`);
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Check if user data exists
      if (!data.data?.user) {
        throw new Error(`GitHub user not found`);
      }

      return data;
    } catch (error) {
      const isLastAttempt = attempt === 2;

      // Don't retry on user not found or authentication errors
      if (
        error instanceof Error &&
        (error.message.includes('not found') || error.message.includes('Authentication failed'))
      ) {
        throw error;
      }

      // If last attempt, throw the error
      if (isLastAttempt) {
        if (error instanceof Error) {
          throw new Error(`Network failure: ${error.message}`);
        }
        throw new Error(`Network failure: ${String(error)}`);
      }

      // Wait before retrying
      await sleep(delays[attempt]);
    }
  }

  // This should never be reached, but TypeScript needs it
  /* v8 ignore start */
  throw new Error('Network failure: maximum retry attempts exceeded');
  /* v8 ignore stop */
}

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
export async function fetchContributions(
  username: string,
  year?: number,
  token?: string,
): Promise<ContributionData> {
  let from: string;
  let to: string;
  let effectiveYear: number;

  if (year != null) {
    // Fixed calendar year
    from = `${year}-01-01T00:00:00Z`;
    to = `${year}-12-31T23:59:59Z`;
    effectiveYear = year;
  } else {
    // Rolling 52-week window ending today
    const now = new Date();
    const oneYearAgo = new Date(now);
    oneYearAgo.setFullYear(now.getFullYear() - 1);
    from = oneYearAgo.toISOString();
    to = now.toISOString();
    effectiveYear = now.getFullYear();
  }

  // Make the GraphQL request
  const response = await makeGraphQLRequest(CONTRIBUTIONS_QUERY, { username, from, to }, token);

  // Extract contribution calendar data
  const calendar = response.data!.user!.contributionsCollection.contributionCalendar;

  // Transform GitHub API response to ContributionWeek format
  const weeks: ContributionWeek[] = calendar.weeks.map((week) => {
    const days: ContributionDay[] = week.contributionDays.map((day) => ({
      date: day.date,
      count: day.contributionCount,
      level: mapContributionLevel(day.contributionLevel),
    }));

    return {
      days,
      firstDay: days[0].date,
    };
  });

  // Return contribution data with placeholder stats
  // Stats will be computed by the stats module
  return {
    weeks,
    stats: {
      total: calendar.totalContributions,
      longestStreak: 0,
      currentStreak: 0,
      mostActiveDay: '',
    },
    year: effectiveYear,
    username,
  };
}
