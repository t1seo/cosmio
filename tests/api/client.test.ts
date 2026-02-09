import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchContributions } from '../../src/api/client.js';
import { CONTRIBUTIONS_QUERY } from '../../src/api/queries.js';
import { createMockApiResponse } from '../fixtures/contribution-data.js';

// ── Helpers ─────────────────────────────────────────────────────

/** Build a minimal successful Response-like object */
function mockResponse(body: unknown, status = 200, statusText = 'OK'): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    json: () => Promise.resolve(body),
    headers: new Headers(),
    redirected: false,
    type: 'basic' as ResponseType,
    url: '',
    clone: () => mockResponse(body, status, statusText),
    body: null,
    bodyUsed: false,
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    blob: () => Promise.resolve(new Blob()),
    formData: () => Promise.resolve(new FormData()),
    text: () => Promise.resolve(JSON.stringify(body)),
    bytes: () => Promise.resolve(new Uint8Array()),
  } as Response;
}

// ── Test Suite ──────────────────────────────────────────────────

describe('fetchContributions', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Speed up retry delays so tests don't wait seconds
    vi.useFakeTimers({ shouldAdvanceTime: true });
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  // ── Successful fetch ────────────────────────────────────────

  it('should fetch and parse contribution data successfully', async () => {
    const apiResponse = createMockApiResponse(1234);
    fetchMock.mockResolvedValueOnce(mockResponse(apiResponse));

    const result = await fetchContributions('testuser', 2025, 'ghp_faketoken');

    expect(result.username).toBe('testuser');
    expect(result.year).toBe(2025);
    expect(result.stats.total).toBe(1234);
    expect(result.weeks).toHaveLength(52);
    expect(result.weeks[0].days).toHaveLength(7);
  });

  // ── Token authentication header ─────────────────────────────

  it('should include bearer token in authorization header', async () => {
    const apiResponse = createMockApiResponse();
    fetchMock.mockResolvedValueOnce(mockResponse(apiResponse));

    await fetchContributions('testuser', 2025, 'ghp_secret123');

    const [, requestInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = requestInit.headers as Record<string, string>;
    expect(headers['Authorization']).toBe('bearer ghp_secret123');
  });

  it('should not include authorization header when no token provided', async () => {
    const apiResponse = createMockApiResponse();
    fetchMock.mockResolvedValueOnce(mockResponse(apiResponse));

    await fetchContributions('testuser', 2025);

    const [, requestInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = requestInit.headers as Record<string, string>;
    expect(headers['Authorization']).toBeUndefined();
  });

  // ── Year parameter / date range construction ────────────────

  it('should construct correct date range for the given year', async () => {
    const apiResponse = createMockApiResponse();
    fetchMock.mockResolvedValueOnce(mockResponse(apiResponse));

    await fetchContributions('testuser', 2023, 'ghp_token');

    const [, requestInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(requestInit.body as string) as {
      query: string;
      variables: { username: string; from: string; to: string };
    };

    expect(body.variables.username).toBe('testuser');
    expect(body.variables.from).toBe('2023-01-01T00:00:00Z');
    expect(body.variables.to).toBe('2023-12-31T23:59:59Z');
    expect(body.query).toBe(CONTRIBUTIONS_QUERY);
  });

  // ── Level parsing ───────────────────────────────────────────

  it('should parse GitHub contribution levels to numeric values', async () => {
    const apiResponse = {
      data: {
        user: {
          contributionsCollection: {
            contributionCalendar: {
              totalContributions: 10,
              weeks: [
                {
                  contributionDays: [
                    { date: '2025-01-05', contributionCount: 0, contributionLevel: 'NONE' },
                    {
                      date: '2025-01-06',
                      contributionCount: 1,
                      contributionLevel: 'FIRST_QUARTILE',
                    },
                    {
                      date: '2025-01-07',
                      contributionCount: 4,
                      contributionLevel: 'SECOND_QUARTILE',
                    },
                    {
                      date: '2025-01-08',
                      contributionCount: 8,
                      contributionLevel: 'THIRD_QUARTILE',
                    },
                    {
                      date: '2025-01-09',
                      contributionCount: 15,
                      contributionLevel: 'FOURTH_QUARTILE',
                    },
                    { date: '2025-01-10', contributionCount: 0, contributionLevel: 'NONE' },
                    { date: '2025-01-11', contributionCount: 0, contributionLevel: 'NONE' },
                  ],
                },
              ],
            },
          },
        },
      },
    };

    fetchMock.mockResolvedValueOnce(mockResponse(apiResponse));
    const result = await fetchContributions('testuser', 2025, 'ghp_token');

    const days = result.weeks[0].days;
    expect(days[0].level).toBe(0); // NONE
    expect(days[1].level).toBe(1); // FIRST_QUARTILE
    expect(days[2].level).toBe(2); // SECOND_QUARTILE
    expect(days[3].level).toBe(3); // THIRD_QUARTILE
    expect(days[4].level).toBe(4); // FOURTH_QUARTILE
  });

  // ── Response shape ──────────────────────────────────────────

  it('should parse response into correct ContributionData shape', async () => {
    const apiResponse = createMockApiResponse(500);
    fetchMock.mockResolvedValueOnce(mockResponse(apiResponse));

    const result = await fetchContributions('testuser', 2025, 'ghp_token');

    // Top-level fields
    expect(result).toHaveProperty('weeks');
    expect(result).toHaveProperty('stats');
    expect(result).toHaveProperty('year');
    expect(result).toHaveProperty('username');

    // Stats shape
    expect(result.stats).toHaveProperty('total');
    expect(result.stats).toHaveProperty('longestStreak');
    expect(result.stats).toHaveProperty('currentStreak');
    expect(result.stats).toHaveProperty('mostActiveDay');

    // Week shape
    const week = result.weeks[0];
    expect(week).toHaveProperty('firstDay');
    expect(week).toHaveProperty('days');
    expect(week.firstDay).toBe(week.days[0].date);

    // Day shape
    const day = week.days[0];
    expect(day).toHaveProperty('date');
    expect(day).toHaveProperty('count');
    expect(day).toHaveProperty('level');
    expect(typeof day.date).toBe('string');
    expect(typeof day.count).toBe('number');
    expect([0, 1, 2, 3, 4]).toContain(day.level);
  });

  // ── User not found ──────────────────────────────────────────

  it('should throw on user not found (GraphQL error)', async () => {
    const errorResponse = {
      errors: [
        { type: 'NOT_FOUND', message: 'Could not resolve to a User with the login of "ghost"' },
      ],
    };

    fetchMock.mockResolvedValueOnce(mockResponse(errorResponse));

    await expect(fetchContributions('ghost', 2025, 'ghp_token')).rejects.toThrow(
      'GitHub user not found',
    );

    // Should NOT retry on user-not-found
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('should throw on user not found (null user in data)', async () => {
    const nullUserResponse = { data: { user: null } };

    fetchMock.mockResolvedValueOnce(mockResponse(nullUserResponse));

    await expect(fetchContributions('ghost', 2025, 'ghp_token')).rejects.toThrow(
      'GitHub user not found',
    );
  });

  // ── Rate limiting (403) with retry ──────────────────────────

  it('should retry on 403 rate limit and eventually succeed', async () => {
    const rateLimitResponse = {
      errors: [{ message: 'API rate limit exceeded' }],
    };
    const apiResponse = createMockApiResponse();

    // Fail twice with rate limit, succeed on third attempt
    fetchMock
      .mockResolvedValueOnce(mockResponse(rateLimitResponse, 403))
      .mockResolvedValueOnce(mockResponse(rateLimitResponse, 403))
      .mockResolvedValueOnce(mockResponse(apiResponse));

    const resultPromise = fetchContributions('testuser', 2025, 'ghp_token');

    // Advance timers past retry delays (1s + 2s)
    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(2000);

    const result = await resultPromise;
    expect(result.username).toBe('testuser');
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('should throw after exhausting retries on persistent rate limit', async () => {
    const rateLimitResponse = {
      errors: [{ message: 'API rate limit exceeded' }],
    };

    fetchMock
      .mockResolvedValueOnce(mockResponse(rateLimitResponse, 403))
      .mockResolvedValueOnce(mockResponse(rateLimitResponse, 403))
      .mockResolvedValueOnce(mockResponse(rateLimitResponse, 403));

    const resultPromise = fetchContributions('testuser', 2025, 'ghp_token');

    // Eagerly attach a catch handler so the rejection is never "unhandled"
    let caughtError: Error | undefined;
    const settled = resultPromise.catch((err: Error) => {
      caughtError = err;
    });

    // Advance past all retry delays (1s + 2s + 4s)
    await vi.advanceTimersByTimeAsync(8000);
    await settled;

    expect(caughtError).toBeDefined();
    expect(caughtError!.message).toMatch(/Network failure/);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  // ── Network error ───────────────────────────────────────────

  it('should retry on network errors and throw after max attempts', async () => {
    fetchMock
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockRejectedValueOnce(new TypeError('fetch failed'));

    const resultPromise = fetchContributions('testuser', 2025, 'ghp_token');

    // Eagerly attach a catch handler so the rejection is never "unhandled"
    let caughtError: Error | undefined;
    const settled = resultPromise.catch((err: Error) => {
      caughtError = err;
    });

    // Advance past all retry delays (1s + 2s + 4s)
    await vi.advanceTimersByTimeAsync(8000);
    await settled;

    expect(caughtError).toBeDefined();
    expect(caughtError!.message).toMatch(/Network failure/);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('should recover from transient network error on retry', async () => {
    const apiResponse = createMockApiResponse();

    fetchMock
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockResolvedValueOnce(mockResponse(apiResponse));

    const resultPromise = fetchContributions('testuser', 2025, 'ghp_token');

    await vi.advanceTimersByTimeAsync(1000);

    const result = await resultPromise;
    expect(result.username).toBe('testuser');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  // ── Authentication error (no retry) ─────────────────────────

  it('should throw immediately on 401 authentication failure', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse({}, 401, 'Unauthorized'));

    await expect(fetchContributions('testuser', 2025, 'bad_token')).rejects.toThrow(
      'Authentication failed',
    );

    // Should NOT retry on auth failure
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  // ── Unknown contribution level (default case) ──────────────

  it('should map unknown contribution levels to 0', async () => {
    const apiResponse = {
      data: {
        user: {
          contributionsCollection: {
            contributionCalendar: {
              totalContributions: 1,
              weeks: [
                {
                  contributionDays: [
                    {
                      date: '2025-01-05',
                      contributionCount: 3,
                      contributionLevel: 'UNKNOWN_LEVEL',
                    },
                  ],
                },
              ],
            },
          },
        },
      },
    };

    fetchMock.mockResolvedValueOnce(mockResponse(apiResponse));
    const result = await fetchContributions('testuser', 2025, 'ghp_token');

    expect(result.weeks[0].days[0].level).toBe(0);
    expect(result.weeks[0].days[0].count).toBe(3);
  });

  // ── Generic GraphQL error (not NOT_FOUND, not rate limit) ──

  it('should throw on generic GraphQL error after retries', async () => {
    const genericError = {
      errors: [{ type: 'SOME_ERROR', message: 'Something went wrong' }],
    };

    fetchMock
      .mockResolvedValueOnce(mockResponse(genericError))
      .mockResolvedValueOnce(mockResponse(genericError))
      .mockResolvedValueOnce(mockResponse(genericError));

    const resultPromise = fetchContributions('testuser', 2025, 'ghp_token');
    let caughtError: Error | undefined;
    const settled = resultPromise.catch((err: Error) => {
      caughtError = err;
    });

    await vi.advanceTimersByTimeAsync(8000);
    await settled;

    expect(caughtError).toBeDefined();
    expect(caughtError!.message).toMatch(/Network failure/);
  });

  // ── HTTP 403 without GraphQL errors ───────────────────────

  it('should throw rate limit on HTTP 403 without error body', async () => {
    fetchMock
      .mockResolvedValueOnce(mockResponse({ data: null }, 403, 'Forbidden'))
      .mockResolvedValueOnce(mockResponse({ data: null }, 403, 'Forbidden'))
      .mockResolvedValueOnce(mockResponse({ data: null }, 403, 'Forbidden'));

    const resultPromise = fetchContributions('testuser', 2025, 'ghp_token');
    let caughtError: Error | undefined;
    const settled = resultPromise.catch((err: Error) => {
      caughtError = err;
    });

    await vi.advanceTimersByTimeAsync(8000);
    await settled;

    expect(caughtError).toBeDefined();
    expect(caughtError!.message).toMatch(/Network failure/);
  });

  // ── Generic HTTP error (500) ──────────────────────────────

  it('should throw on generic HTTP error (500)', async () => {
    fetchMock
      .mockResolvedValueOnce(mockResponse({ data: null }, 500, 'Internal Server Error'))
      .mockResolvedValueOnce(mockResponse({ data: null }, 500, 'Internal Server Error'))
      .mockResolvedValueOnce(mockResponse({ data: null }, 500, 'Internal Server Error'));

    const resultPromise = fetchContributions('testuser', 2025, 'ghp_token');
    let caughtError: Error | undefined;
    const settled = resultPromise.catch((err: Error) => {
      caughtError = err;
    });

    await vi.advanceTimersByTimeAsync(8000);
    await settled;

    expect(caughtError).toBeDefined();
    expect(caughtError!.message).toMatch(/Network failure/);
  });

  // ── Non-Error thrown by fetch ─────────────────────────────

  it('should handle non-Error thrown by fetch', async () => {
    fetchMock
      .mockRejectedValueOnce('string error')
      .mockRejectedValueOnce('string error')
      .mockRejectedValueOnce('string error');

    const resultPromise = fetchContributions('testuser', 2025, 'ghp_token');
    let caughtError: Error | undefined;
    const settled = resultPromise.catch((err: Error) => {
      caughtError = err;
    });

    await vi.advanceTimersByTimeAsync(8000);
    await settled;

    expect(caughtError).toBeDefined();
    expect(caughtError!.message).toMatch(/Network failure: string error/);
  });

  // ── Rolling window (no year parameter) ─────────────────────

  it('should use rolling 52-week window when year is omitted', async () => {
    const apiResponse = createMockApiResponse(42);
    fetchMock.mockResolvedValueOnce(mockResponse(apiResponse));

    const result = await fetchContributions('testuser', undefined, 'ghp_token');

    // Verify the request used ISO date strings (rolling window format)
    const [, requestInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(requestInit.body as string) as {
      variables: { from: string; to: string };
    };

    // Rolling window dates should be full ISO strings (contain 'T'), not fixed-year format
    expect(body.variables.from).toMatch(/T/);
    expect(body.variables.to).toMatch(/T/);

    // The effective year should be the current year
    expect(result.year).toBe(new Date().getFullYear());
    expect(result.username).toBe('testuser');
  });
});
