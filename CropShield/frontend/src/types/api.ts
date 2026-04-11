export type ClaimStatus =
  | 'created'
  | 'analysis_running'
  | 'analysis_completed'
  | 'failed'
  | 'approved_by_admin'
  | 'rejected_by_admin'
  | 'needs_more_info'
  | 'pending_admin_review';

export type JobStatus = 'queued' | 'running' | 'completed' | 'failed';

export interface AuthLoginRequest {
  username: string;
  password: string;
}

export interface FarmerLoginRequest {
  id_token: string;
}

export interface AuthTokenResponse {
  access_token: string;
  token_type: string;
}

export interface AuthUserClaims {
  sub: string;
  role: 'admin' | 'farmer';
  farmer_id?: number | null;
  name?: string | null;
  email?: string | null;
  picture?: string | null;
  exp?: number;
  iat?: number;
}

export interface FarmLookupRequest {
  farmer_name: string;
  state_index: number;
  category_index: number;
  district_index: number;
  taluka_index: number;
  village_index: number;
  plot_index: number;
  headless?: boolean;
}

export interface FarmOptionsRequest {
  state_index?: number;
  category_index?: number;
  district_index?: number;
  taluka_index?: number;
  village_index?: number;
  headless?: boolean;
}

export interface FarmDropdownOption {
  index: number;
  label: string;
}

export interface FarmOptionsResponse {
  state: FarmDropdownOption[];
  category: FarmDropdownOption[];
  district: FarmDropdownOption[];
  taluka: FarmDropdownOption[];
  village: FarmDropdownOption[];
  plot: FarmDropdownOption[];
  selected: {
    state_index: number;
    category_index: number;
    district_index: number;
    taluka_index: number;
    village_index: number;
    plot_index: number;
  };
}

export interface FarmProfile {
  id: number;
  farmer_name: string;
  owner_names: string[];
  survey_numbers: string[];
  area_values: string[];
  farm_area_hectares: number;
  extent: number[];
  polygon: number[][];
  centroid_latitude: number;
  centroid_longitude: number;
  state_index: number;
  category_index: number;
  district_index: number;
  taluka_index: number;
  village_index: number;
  plot_index: number;
  state_name?: string | null;
  category_name?: string | null;
  district_name?: string | null;
  taluka_name?: string | null;
  village_name?: string | null;
  plot_name?: string | null;
  screenshot_data_url?: string | null;
  screenshot_path?: string | null;
  automation_source: string;
  automation_status_message?: string | null;
  created_at: string;
  updated_at: string;
}

export interface FarmsListResponse {
  items: FarmProfile[];
  limit: number;
  offset: number;
}

export interface CreateClaimRequest {
  farm_profile_id?: number;
  farmer_name?: string;
  crop_type: string;
  farm_area_hectares?: number;
  latitude?: number;
  longitude?: number;
  damage_date: string;
}

export interface Claim {
  id: number;
  farm_profile_id?: number | null;
  farmer_name: string;
  crop_type: string;
  farm_area_hectares: number;
  latitude: number;
  longitude: number;
  damage_date: string;
  status: ClaimStatus | string;
  admin_status: string;
  admin_notes?: string | null;
  farmer_notes?: string | null;
  reviewed_by?: string | null;
  recommended_insurance_amount?: number | null;
  pmfby_reference_url: string;
  reviewed_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClaimsListResponse {
  items: Claim[];
  limit: number;
  offset: number;
}

export interface AnalyzeResponse {
  job_id: string;
  status: JobStatus;
}

export interface FarmerNotesRequest {
  notes: string;
}

export interface ReportMetadata {
  id: number;
  claim_id: number;
  analysis_run_id: number;
  file_path_or_object_key: string;
  mime_type: string;
  generated_at: string;
}

export interface AnalysisResult {
  claim_id: number;
  analysis: null | {
    id: number;
    claim_id: number;
    status: JobStatus | string;
    status_message?: string | null;
    gap_before: number;
    gap_after: number;
    window_days: number;
    max_cloud_threshold: number;
    before_scene_date?: string | null;
    after_scene_date?: string | null;
    before_scene_source?: string | null;
    after_scene_source?: string | null;
    started_at?: string | null;
    completed_at?: string | null;
    created_at: string;
    metrics?: {
      ndvi_before: number;
      ndvi_after: number;
      ndwi_before: number;
      ndwi_after: number;
      evi_before: number;
      evi_after: number;
      damage_percentage: number;
    } | null;
    ai_prediction?: {
      model_version: string;
      predicted_class: string;
      damage_probability: number;
      damaged_area_percentage: number;
      class_probabilities?: Record<string, number> | null;
    } | null;
    decision?: {
      decision: string;
      confidence: number;
      rationale: string;
      rules_version: string;
      fused_damage: number;
      ndvi_damage: number;
      ndwi_damage: number;
      evi_damage: number;
      ai_damage: number;
      area_score: number;
    } | null;
    farmer_assessment?: {
      possible_damage_percentage: number;
      risk_level: string;
      summary: string;
    } | null;
  };
}

export interface AnalysisArtifacts {
  claim_id: number;
  analysis_run_id: number;
  before_rgb_data_url: string;
  after_rgb_data_url: string;
  ndvi_before_data_url: string;
  ndvi_after_data_url: string;
  ndwi_before_data_url: string;
  ndwi_after_data_url: string;
  evi_before_data_url: string;
  evi_after_data_url: string;
}

export interface JobStatusResponse {
  id: string;
  job_type: string;
  resource_type: string;
  resource_id: number;
  status: JobStatus | string;
  progress: number;
  payload_json?: Record<string, unknown> | null;
  error_message?: string | null;
  created_at: string;
  updated_at: string;
}

export interface DashboardSummary {
  total_claims: number;
  approved_claims: number;
  average_damage_percentage: number;
  average_decision_confidence: number;
}

export interface DashboardHomeSignals {
  summary: DashboardSummary;
  weather_current: WeatherCurrent;
  weather_forecast: WeatherForecast;
  weather_alerts: WeatherAlerts;
  market_commodities: CommoditiesResponse;
  market_trending: TrendingCommoditiesResponse;
  market_mandi_data: MandiDataResponse;
}

export interface WeatherCurrent {
  location: string;
  temperature_c: number;
  condition: string;
  humidity_percent: number;
  wind_kph: number;
  observed_at: string;
}

export interface WeatherForecastDay {
  date: string;
  min_temp_c: number;
  max_temp_c: number;
  condition: string;
}

export interface WeatherForecast {
  location: string;
  days: WeatherForecastDay[];
}

export interface WeatherAlert {
  title: string;
  severity: string;
  description: string;
}

export interface WeatherAlerts {
  location: string;
  alerts: WeatherAlert[];
}

export interface CommodityPrice {
  commodity: string;
  market: string;
  unit: string;
  price: number;
  currency: string;
}

export interface CommoditiesResponse {
  items: CommodityPrice[];
}

export interface TrendingCommodity {
  commodity: string;
  change_percent: number;
}

export interface TrendingCommoditiesResponse {
  items: TrendingCommodity[];
}

export interface MandiData {
  mandi: string;
  commodity: string;
  min_price: number;
  max_price: number;
  modal_price: number;
}

export interface MandiDataResponse {
  items: MandiData[];
}

export interface FinancialSummaryResponse {
  estimated_revenue_inr: number;
  estimated_cost_inr: number;
  estimated_profit_inr: number;
  margin_percent: number;
  recommendation: string;
}

export interface AdvisoryChatRequest {
  message: string;
  language: string;
}

export interface AdvisoryChatResponse {
  provider: string;
  reply: string;
  fallback_used: boolean;
}

export interface CropPredictRequest {
  crop_type: string;
  soil_type: string;
  rainfall_mm: number;
  temperature_c: number;
}

export interface CropPredictResponse {
  expected_yield_tph: number;
  risk_level: string;
  recommendation: string;
}

export interface DiseaseDetectRequest {
  image_name: string;
  crop_type?: string;
}

export interface DiseaseDetectResponse {
  predicted_disease: string;
  confidence: number;
  recommendation: string;
}

export interface ForumPost {
  id: number;
  title: string;
  content: string;
  author: string;
  like_count: number;
  created_at: string;
}

export interface ForumReply {
  id: number;
  post_id: number;
  content: string;
  author: string;
  created_at: string;
}

export interface ForumPostCreateRequest {
  title: string;
  content: string;
}

export interface ForumReplyCreateRequest {
  content: string;
}

export interface ForumPostsResponse {
  items: ForumPost[];
}

export interface ForumRepliesResponse {
  items: ForumReply[];
}

export interface ForumSearchResponse {
  query: string;
  items: ForumPost[];
}

export interface AdminClaim {
  claim_id: number;
  farm_profile_id?: number | null;
  farmer_name: string;
  crop_type: string;
  damage_date: string;
  status: string;
  admin_status: string;
  recommended_insurance_amount?: number | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  pmfby_reference_url: string;
  extent?: number[] | null;
  polygon?: number[][] | null;
  owner_names: string[];
  area_values: string[];
  screenshot_data_url?: string | null;
  latest_damage_percentage?: number | null;
  latest_ai_damage_probability?: number | null;
  latest_risk_label?: string | null;
}

export interface AdminClaimsResponse {
  items: AdminClaim[];
  limit: number;
  offset: number;
  total_count: number;
}

export interface AdminReviewRequest {
  admin_status: 'pending_review' | 'approved' | 'rejected' | 'needs_more_info';
  reviewed_by: string;
  admin_notes?: string;
  recommended_insurance_amount?: number;
}

export interface ClaimAuditLog {
  id: number;
  claim_id: number;
  actor: string;
  action: string;
  old_status?: string | null;
  new_status?: string | null;
  notes?: string | null;
  created_at: string;
}

export interface AdminClaimFullResponse {
  claim: AdminClaim;
  admin_notes?: string | null;
  farmer_notes?: string | null;
  latest_analysis: AnalysisResult['analysis'];
  audit_logs: ClaimAuditLog[];
}

export interface AdminBulkReviewRequest {
  claim_ids: number[];
  admin_status: 'pending_review' | 'approved' | 'rejected' | 'needs_more_info';
  reviewed_by: string;
  admin_notes?: string;
  recommended_insurance_amount?: number;
}

export interface AdminBulkReviewResponse {
  updated_claim_ids: number[];
}
