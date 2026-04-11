import type {
  AuthLoginRequest,
  AuthTokenResponse,
  AdminClaimsResponse,
  AdminClaimFullResponse,
  AdminBulkReviewRequest,
  AdminBulkReviewResponse,
  AdminReviewRequest,
  AnalysisArtifacts,
  AnalysisResult,
  AnalyzeResponse,
  Claim,
  ClaimsListResponse,
  CreateClaimRequest,
  DashboardHomeSignals,
  DashboardSummary,
  FarmerNotesRequest,
  FarmLookupRequest,
  FarmOptionsRequest,
  FarmOptionsResponse,
  FarmProfile,
  FarmsListResponse,
  JobStatusResponse,
  FarmerLoginRequest,
  ReportMetadata,
  WeatherCurrent,
  WeatherForecast,
  WeatherAlerts,
  CommoditiesResponse,
  TrendingCommoditiesResponse,
  MandiDataResponse,
  AdvisoryChatRequest,
  AdvisoryChatResponse,
  ForumPost,
  ForumPostCreateRequest,
  ForumPostsResponse,
  ForumReply,
  ForumReplyCreateRequest,
  ForumRepliesResponse,
  ForumSearchResponse,
  DiseaseDetectRequest,
  DiseaseDetectResponse,
  CropPredictRequest,
  CropPredictResponse,
  FinancialSummaryResponse,
} from '@/types/api';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') ?? 'http://localhost:8000';
const API_PREFIX = '/api/v1';

function getAuthHeader(): Record<string, string> {
  if (typeof window === 'undefined') {
    return {};
  }
  const token = window.localStorage.getItem('cropshield_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public body?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function apiFetch<T>(
  path: string,
  options: RequestInit & { skipAuthRedirect?: boolean } = {},
): Promise<T> {
  const url = `${BASE_URL}${API_PREFIX}${path}`;
  const hasBody = options.body !== undefined && options.body !== null;
  const { skipAuthRedirect, ...requestOptions } = options;
  const timeoutMs = 30_000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  // Preserve caller-provided abort semantics while enforcing a request timeout.
  if (requestOptions.signal) {
    requestOptions.signal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  let res: Response;
  try {
    res = await fetch(url, {
      headers: {
        Accept: 'application/json',
        ...getAuthHeader(),
        ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
        ...(requestOptions.headers ?? {}),
      },
      ...requestOptions,
      signal: controller.signal,
    });
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ApiError(408, 'Request timed out after 30 seconds');
    }
    throw error;
  }
  clearTimeout(timeoutId);

  if (!res.ok) {
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      body = undefined;
    }
    if (res.status === 401 && typeof window !== 'undefined' && !skipAuthRedirect) {
      window.localStorage.removeItem('cropshield_token');
      window.location.replace('/login');
    }
    throw new ApiError(res.status, `API error ${res.status}: ${res.statusText}`, body);
  }

  const text = await res.text();
  return text ? (JSON.parse(text) as T) : ({} as T);
}

export async function createFarmProfile(payload: FarmLookupRequest): Promise<FarmProfile> {
  return apiFetch<FarmProfile>('/farms/lookup', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function loginAdmin(payload: AuthLoginRequest): Promise<AuthTokenResponse> {
  return apiFetch<AuthTokenResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
    skipAuthRedirect: true,
  });
}

export async function loginFarmerWithGoogleCredential(
  payload: FarmerLoginRequest,
): Promise<AuthTokenResponse> {
  return apiFetch<AuthTokenResponse>('/auth/farmer-login', {
    method: 'POST',
    body: JSON.stringify(payload),
    skipAuthRedirect: true,
  });
}

export async function loginDemoFarmer(username: string): Promise<AuthTokenResponse> {
  return apiFetch<AuthTokenResponse>('/auth/demo-farmer-login', {
    method: 'POST',
    body: JSON.stringify({ username, password: 'not-used' }),
    skipAuthRedirect: true,
  });
}

export async function getFarmOptions(params?: FarmOptionsRequest): Promise<FarmOptionsResponse> {
  const qs = new URLSearchParams();
  if (params?.state_index !== undefined) qs.set('state_index', String(params.state_index));
  if (params?.category_index !== undefined) qs.set('category_index', String(params.category_index));
  if (params?.district_index !== undefined) qs.set('district_index', String(params.district_index));
  if (params?.taluka_index !== undefined) qs.set('taluka_index', String(params.taluka_index));
  if (params?.village_index !== undefined) qs.set('village_index', String(params.village_index));
  qs.set('headless', String(params?.headless ?? true));
  const query = qs.toString();
  return apiFetch<FarmOptionsResponse>(`/farms/options${query ? `?${query}` : ''}`);
}

export async function getFarmProfile(farmId: number | string): Promise<FarmProfile> {
  return apiFetch<FarmProfile>(`/farms/${farmId}`);
}

export async function getFarms(params?: { limit?: number; offset?: number }): Promise<FarmsListResponse> {
  const limit = params?.limit ?? 20;
  const offset = params?.offset ?? 0;
  return apiFetch<FarmsListResponse>(`/farms?limit=${limit}&offset=${offset}`);
}

export async function createClaim(payload: CreateClaimRequest): Promise<Claim> {
  return apiFetch<Claim>('/claims', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function getClaims(params?: { limit?: number; offset?: number }): Promise<ClaimsListResponse> {
  const limit = params?.limit ?? 20;
  const offset = params?.offset ?? 0;
  return apiFetch<ClaimsListResponse>(`/claims?limit=${limit}&offset=${offset}`);
}

export async function getClaim(claimId: number | string): Promise<Claim> {
  return apiFetch<Claim>(`/claims/${claimId}`);
}

export async function analyzeClaim(
  claimId: number | string,
  params?: {
    gap_before?: number;
    gap_after?: number;
    window_days?: number;
    max_cloud_threshold?: number;
    upscale_factor?: number;
  },
): Promise<AnalyzeResponse> {
  return apiFetch<AnalyzeResponse>(`/claims/${claimId}/analyze`, {
    method: 'POST',
    body: JSON.stringify({
      gap_before: params?.gap_before ?? 5,
      gap_after: params?.gap_after ?? 5,
      window_days: params?.window_days ?? 10,
      max_cloud_threshold: params?.max_cloud_threshold ?? 100,
      upscale_factor: params?.upscale_factor ?? 3,
    }),
  });
}

export async function submitFarmerNotes(
  claimId: number | string,
  payload: FarmerNotesRequest,
): Promise<Claim> {
  return apiFetch<Claim>(`/claims/${claimId}/farmer-notes`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function getAnalysis(claimId: number | string): Promise<AnalysisResult> {
  return apiFetch<AnalysisResult>(`/claims/${claimId}/analysis`);
}

export async function getAnalysisArtifacts(claimId: number | string): Promise<AnalysisArtifacts> {
  return apiFetch<AnalysisArtifacts>(`/claims/${claimId}/analysis/artifacts`);
}

export async function triggerReport(
  claimId: number | string,
  analysisRunId?: number,
): Promise<AnalyzeResponse> {
  return apiFetch<AnalyzeResponse>(`/claims/${claimId}/report`, {
    method: 'POST',
    body: JSON.stringify({ analysis_run_id: analysisRunId ?? null }),
  });
}

export async function getReport(claimId: number | string): Promise<ReportMetadata> {
  return apiFetch<ReportMetadata>(`/claims/${claimId}/report`);
}

export function getReportDownloadUrl(claimId: number | string): string {
  return `${BASE_URL}${API_PREFIX}/claims/${claimId}/report?download=true`;
}

export async function downloadReportPdf(claimId: number | string): Promise<void> {
  const url = getReportDownloadUrl(claimId);
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      ...getAuthHeader(),
    },
  });
  if (!res.ok) {
    throw new ApiError(res.status, `API error ${res.status}: ${res.statusText}`);
  }

  const blob = await res.blob();
  const objectUrl = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = `cropshield-claim-${claimId}-report.pdf`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(objectUrl);
}

export async function getJob(jobId: string): Promise<JobStatusResponse> {
  return apiFetch<JobStatusResponse>(`/jobs/${jobId}`);
}

async function pollJobUntilTerminal(
  jobId: string,
  {
    timeoutMs,
    pollIntervalMs,
    onUpdate,
  }: {
    timeoutMs: number;
    pollIntervalMs: number;
    onUpdate?: (job: JobStatusResponse) => void;
  },
): Promise<JobStatusResponse> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const latest = await getJob(jobId);
    onUpdate?.(latest);
    if (latest.status === 'completed' || latest.status === 'failed') {
      return latest;
    }
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }
  throw new Error('Analysis timed out');
}

export async function waitForJobCompletion(
  jobId: string,
  options?: {
    timeoutMs?: number;
    pollIntervalMs?: number;
    onUpdate?: (job: JobStatusResponse) => void;
  },
): Promise<JobStatusResponse> {
  const timeoutMs = options?.timeoutMs ?? 10 * 60_000;
  const pollIntervalMs = options?.pollIntervalMs ?? 2000;
  const onUpdate = options?.onUpdate;

  if (typeof window === 'undefined' || typeof EventSource === 'undefined') {
    return pollJobUntilTerminal(jobId, { timeoutMs, pollIntervalMs, onUpdate });
  }

  const streamUrl = `${BASE_URL}${API_PREFIX}/jobs/${jobId}/events`;

  try {
    const result = await new Promise<JobStatusResponse>((resolve, reject) => {
      let settled = false;
      const source = new EventSource(streamUrl);
      const timer = window.setTimeout(() => {
        if (settled) return;
        settled = true;
        source.close();
        reject(new Error('Analysis timed out'));
      }, timeoutMs);

      const finish = (resolver: (value: JobStatusResponse) => void, value: JobStatusResponse) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        source.close();
        resolver(value);
      };

      const emit = (job: JobStatusResponse) => {
        onUpdate?.(job);
        if (job.status === 'completed' || job.status === 'failed') {
          finish(resolve, job);
        }
      };

      const parseAndEmit = (event: MessageEvent<string>) => {
        try {
          emit(JSON.parse(event.data) as JobStatusResponse);
        } catch {
          // Ignore malformed SSE payload and continue streaming.
        }
      };

      source.addEventListener('snapshot', parseAndEmit as EventListener);
      source.addEventListener('job', parseAndEmit as EventListener);
      source.addEventListener('completed', parseAndEmit as EventListener);
      source.addEventListener('failed', parseAndEmit as EventListener);

      source.onerror = async () => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        source.close();
        try {
          const fallback = await pollJobUntilTerminal(jobId, { timeoutMs, pollIntervalMs, onUpdate });
          resolve(fallback);
        } catch (err) {
          reject(err instanceof Error ? err : new Error(String(err)));
        }
      };
    });
    return result;
  } catch {
    return pollJobUntilTerminal(jobId, { timeoutMs, pollIntervalMs, onUpdate });
  }
}

export async function getDashboardSummary(): Promise<DashboardSummary> {
  return apiFetch<DashboardSummary>('/dashboard/summary');
}

export async function getDashboardHomeSignals(location = 'Pune', days = 3): Promise<DashboardHomeSignals> {
  const query = new URLSearchParams({ location, days: String(days) });
  return apiFetch<DashboardHomeSignals>(`/dashboard/home-signals?${query.toString()}`);
}

export async function getWeatherCurrent(location = 'Unknown'): Promise<WeatherCurrent> {
  const query = new URLSearchParams({ location });
  return apiFetch<WeatherCurrent>(`/weather/current?${query.toString()}`);
}

export async function getWeatherForecast(location = 'Unknown', days = 5): Promise<WeatherForecast> {
  const query = new URLSearchParams({ location, days: String(days) });
  return apiFetch<WeatherForecast>(`/weather/forecast?${query.toString()}`);
}

export async function getWeatherAlerts(location = 'Unknown'): Promise<WeatherAlerts> {
  const query = new URLSearchParams({ location });
  return apiFetch<WeatherAlerts>(`/weather/alerts?${query.toString()}`);
}

export async function getMarketCommodities(): Promise<CommoditiesResponse> {
  return apiFetch<CommoditiesResponse>('/market/commodities');
}

export async function getTrendingCommodities(): Promise<TrendingCommoditiesResponse> {
  return apiFetch<TrendingCommoditiesResponse>('/market/trending');
}

export async function getMandiData(): Promise<MandiDataResponse> {
  return apiFetch<MandiDataResponse>('/market/mandi-data');
}

export async function getFinancialSummary(): Promise<FinancialSummaryResponse> {
  return apiFetch<FinancialSummaryResponse>('/market/financial-summary');
}

export async function advisoryChat(payload: AdvisoryChatRequest): Promise<AdvisoryChatResponse> {
  return apiFetch<AdvisoryChatResponse>('/advisory/chat', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function cropPredict(payload: CropPredictRequest): Promise<CropPredictResponse> {
  return apiFetch<CropPredictResponse>('/advisory/crop-predict', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function listForumPosts(): Promise<ForumPostsResponse> {
  return apiFetch<ForumPostsResponse>('/forum/posts');
}

export async function createForumPost(payload: ForumPostCreateRequest): Promise<ForumPost> {
  return apiFetch<ForumPost>('/forum/posts', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function listForumReplies(postId: number): Promise<ForumRepliesResponse> {
  return apiFetch<ForumRepliesResponse>(`/forum/posts/${postId}/replies`);
}

export async function createForumReply(postId: number, payload: ForumReplyCreateRequest): Promise<ForumReply> {
  return apiFetch<ForumReply>(`/forum/posts/${postId}/replies`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function likeForumPost(postId: number): Promise<ForumPost> {
  return apiFetch<ForumPost>(`/forum/posts/${postId}/like`, { method: 'POST' });
}

export async function searchForumPosts(query: string): Promise<ForumSearchResponse> {
  const qs = new URLSearchParams({ query });
  return apiFetch<ForumSearchResponse>(`/forum/search?${qs.toString()}`);
}

export async function detectDisease(payload: DiseaseDetectRequest): Promise<DiseaseDetectResponse> {
  return apiFetch<DiseaseDetectResponse>('/disease/detect', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function getAdminClaims(params?: {
  limit?: number;
  offset?: number;
  status?: string;
  admin_status?: string;
  crop_type?: string;
  damage_date_from?: string;
  damage_date_to?: string;
  search?: string;
}): Promise<AdminClaimsResponse> {
  const limit = params?.limit ?? 25;
  const offset = params?.offset ?? 0;
  const qs = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  if (params?.status) qs.set('status', params.status);
  if (params?.admin_status) qs.set('admin_status', params.admin_status);
  if (params?.crop_type) qs.set('crop_type', params.crop_type);
  if (params?.damage_date_from) qs.set('damage_date_from', params.damage_date_from);
  if (params?.damage_date_to) qs.set('damage_date_to', params.damage_date_to);
  if (params?.search) qs.set('search', params.search);
  return apiFetch<AdminClaimsResponse>(`/admin/claims?${qs.toString()}`);
}

export async function getAdminClaimFull(claimId: number | string): Promise<AdminClaimFullResponse> {
  return apiFetch<AdminClaimFullResponse>(`/admin/claims/${claimId}/full`);
}

export async function reviewAdminClaim(
  claimId: number | string,
  payload: AdminReviewRequest,
) {
  return apiFetch(`/admin/claims/${claimId}/review`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function bulkReviewAdminClaims(payload: AdminBulkReviewRequest): Promise<AdminBulkReviewResponse> {
  return apiFetch<AdminBulkReviewResponse>('/admin/claims/bulk-review', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function getAdminReportDownloadUrl(claimId: number | string): string {
  return `${BASE_URL}${API_PREFIX}/admin/claims/${claimId}/report?download=true`;
}

export async function downloadAdminReportPdf(claimId: number | string): Promise<void> {
  const url = getAdminReportDownloadUrl(claimId);
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      ...getAuthHeader(),
    },
  });

  if (!res.ok) {
    throw new ApiError(res.status, `API error ${res.status}: ${res.statusText}`);
  }

  const blob = await res.blob();
  const objectUrl = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = `cropshield-admin-claim-${claimId}-report.pdf`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(objectUrl);
}
