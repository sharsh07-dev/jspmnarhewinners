'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { 
  AlertTriangle, 
  CheckCircle2, 
  ChevronLeft, 
  ExternalLink, 
  Loader2, 
  Lock, 
  MapPinned, 
  RefreshCw, 
  Satellite, 
  ShieldCheck, 
  XCircle,
  Map as MapIcon,
  ChevronRight,
  ClipboardList,
  Layers,
  ArrowRight
} from 'lucide-react';
import ErrorBanner from '@/components/ErrorBanner';
import FarmBoundaryMap from '@/components/FarmBoundaryMap';
import { useClaims } from '@/hooks/useApi';
import { ApiError, analyzeClaim, createClaim, createFarmProfile, getAnalysis, getFarmOptions, submitFarmerNotes, waitForJobCompletion } from '@/lib/api';
import type { Claim, FarmOptionsResponse, FarmProfile, JobStatusResponse } from '@/types/api';

type Step = 1 | 2 | 3 | 4;
type EntryMode = 'automation' | 'manual';
type ViewMode = 'new' | 'status';

function canViewDetailedReport(claim: Claim): boolean {
  return (
    claim.admin_status === 'approved' || 
    claim.status === 'analysis_completed' || 
    claim.status === 'pending_admin_review'
  );
}

function getStatusDescriptor(claim: Claim): { label: string; tone: string; icon?: any; spinner?: boolean; retry?: boolean } {
  if (claim.admin_status === 'approved') {
    return { label: 'Decision Sealed', tone: 'bg-emerald-50 text-emerald-700 border-emerald-100', icon: CheckCircle2 };
  }
  if (claim.admin_status === 'rejected') {
    return { label: 'Denial Record', tone: 'bg-rose-50 text-rose-700 border-rose-100', icon: XCircle };
  }
  if (claim.admin_status === 'needs_more_info') {
    return { label: 'Action Required', tone: 'bg-amber-50 text-amber-700 border-amber-100', icon: AlertTriangle };
  }
  if (claim.status === 'analysis_running') {
    return { label: 'Matrix Running', tone: 'bg-blue-50 text-blue-700 border-blue-100', spinner: true };
  }
  if (claim.status === 'analysis_completed' || claim.status === 'pending_admin_review') {
    return { label: 'Escalated to Admin', tone: 'bg-indigo-50 text-indigo-700 border-indigo-100', icon: ShieldCheck };
  }
  if (claim.status === 'failed') {
    return { label: 'Signal Fault', tone: 'bg-orange-50 text-orange-700 border-orange-100', retry: true, icon: AlertTriangle };
  }
  return { label: 'Queue Sync', tone: 'bg-gray-100 text-gray-700 border-gray-200', icon: RefreshCw };
}

function ClaimStatusBadge({ claim }: { claim: Claim }) {
  const descriptor = getStatusDescriptor(claim);
  const Icon = descriptor.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-wider ${descriptor.tone}`}>
      {descriptor.spinner ? <Loader2 size={10} className="animate-spin" /> : Icon ? <Icon size={10} /> : null}
      {descriptor.label}
    </span>
  );
}

function normalizeFailureReason(message?: string | null): string {
  if (!message) {
    return 'Satellite imagery failed to resolve current spatial query. Modify date range or adjust cloud threshold.';
  }
  const withoutAttemptDetails = message.replace(/expanded attempts:\s*[^)]*\)/i, '').trim();
  return withoutAttemptDetails.replace(/\s+/g, ' ');
}

function calculateAnalysisParams(
  damageDate: string,
  startDate: string,
  endDate: string,
  maxCloudThreshold: number,
  upscaleFactor: number,
) {
  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  const damage = new Date(`${damageDate}T00:00:00`);
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);

  const gapBefore = Math.max(1, Math.ceil((damage.getTime() - start.getTime()) / MS_PER_DAY));
  const gapAfter = Math.max(1, Math.ceil((end.getTime() - damage.getTime()) / MS_PER_DAY));
  const windowDays = Math.max(7, Math.min(45, Math.ceil((end.getTime() - start.getTime()) / MS_PER_DAY) + 1));

  return {
    gap_before: gapBefore,
    gap_after: gapAfter,
    window_days: windowDays,
    max_cloud_threshold: maxCloudThreshold,
    upscale_factor: upscaleFactor,
  };
}

export default function FarmerRequestsPage() {
  const [view, setView] = useState<ViewMode>('new');
  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<{
    landFarmerName?: string;
    manualFarmerName?: string;
    manualArea?: string;
    manualLatitude?: string;
    manualLongitude?: string;
    analysisDateRange?: string;
  }>({});
  const [farm, setFarm] = useState<FarmProfile | null>(null);
  const [farmConfirmed, setFarmConfirmed] = useState(false);
  const [jobInfo, setJobInfo] = useState<string>('Initializing link...');
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [entryMode, setEntryMode] = useState<EntryMode>('automation');
  const [submittedClaimId, setSubmittedClaimId] = useState<number | null>(null);
  const [jobProgress, setJobProgress] = useState(0);
  const [retryClaimId, setRetryClaimId] = useState<number | null>(null);
  const [retryStartDate, setRetryStartDate] = useState(new Date(Date.now() - (10 * 24 * 60 * 60 * 1000)).toISOString().slice(0, 10));
  const [retryEndDate, setRetryEndDate] = useState(new Date().toISOString().slice(0, 10));
  const [retryFailureReason, setRetryFailureReason] = useState('');
  const [retryBusy, setRetryBusy] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);
  const [retryJob, setRetryJob] = useState<JobStatusResponse | null>(null);
  const [farmerNotesDraft, setFarmerNotesDraft] = useState<Record<number, string>>({});
  const [farmerNotesBusyId, setFarmerNotesBusyId] = useState<number | null>(null);
  const [farmerNotesErrorById, setFarmerNotesErrorById] = useState<Record<number, string>>({});
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string | null>(null);

  const claimsQuery = useClaims({ limit: 100, offset: 0 });
  const claims = claimsQuery.data?.items ?? [];

  const refreshRequests = () => {
    setLastRefreshedAt(new Date().toLocaleTimeString());
    claimsQuery.refetch();
  };

  useEffect(() => {
    if (view !== 'status') return;
    const timer = window.setInterval(() => {
      claimsQuery.refetch();
    }, 10000);
    return () => window.clearInterval(timer);
  }, [view, claimsQuery]);

  const [landOptions, setLandOptions] = useState<FarmOptionsResponse>({
    state: [],
    category: [],
    district: [],
    taluka: [],
    village: [],
    plot: [],
    selected: {
      state_index: 0,
      category_index: 0,
      district_index: 0,
      taluka_index: 0,
      village_index: 0,
      plot_index: 0,
    },
  });

  const [landForm, setLandForm] = useState({
    farmer_name: '',
    state_index: 0,
    category_index: 0,
    district_index: 0,
    taluka_index: 0,
    village_index: 0,
    plot_index: 0,
    headless: true,
  });

  const [manualForm, setManualForm] = useState({
    farmer_name: '',
    latitude: 18.5204,
    longitude: 73.8567,
    farm_area_hectares: 2.5,
  });

  const DEFAULT_STATE_INDEX = 0;

  const getReadableLabel = (label: string) => {
    return label.replace(/^\s*\d+\s*[-.)]?\s*/, '').trim() || label;
  };

  const loadLandOptions = async (next: {
    state_index?: number;
    category_index?: number;
    district_index?: number;
    taluka_index?: number;
    village_index?: number;
  }) => {
    setOptionsLoading(true);
    setError(null);
    try {
      const resolvedStateIndex = next.state_index ?? DEFAULT_STATE_INDEX;
      const options = await getFarmOptions({
        state_index: resolvedStateIndex,
        category_index: next.category_index,
        district_index: next.district_index,
        taluka_index: next.taluka_index,
        village_index: next.village_index,
        headless: true,
      });
      setLandOptions(options);
      setLandForm((prev) => ({
        ...prev,
        state_index: DEFAULT_STATE_INDEX,
        category_index: options.selected.category_index,
        district_index: options.selected.district_index,
        taluka_index: options.selected.taluka_index,
        village_index: options.selected.village_index,
        plot_index: options.selected.plot_index,
      }));
    } catch (err) {
      if (err instanceof ApiError) {
        setError(`Link synchronization fault (${err.status}).`);
      } else {
        setError(`Secure link failed: ${String(err)}`);
      }
    } finally {
      setOptionsLoading(false);
    }
  };

  useEffect(() => {
    loadLandOptions({
      state_index: DEFAULT_STATE_INDEX,
      category_index: 0,
      district_index: 0,
      taluka_index: 0,
      village_index: 0,
    });
  }, []);

  const handleCategoryChange = async (categoryIndex: number) => {
    await loadLandOptions({
      state_index: DEFAULT_STATE_INDEX,
      category_index: categoryIndex,
      district_index: 0,
      taluka_index: 0,
      village_index: 0,
    });
  };

  const handleDistrictChange = async (districtIndex: number) => {
    await loadLandOptions({
      state_index: DEFAULT_STATE_INDEX,
      category_index: landForm.category_index,
      district_index: districtIndex,
      taluka_index: 0,
      village_index: 0,
    });
  };

  const handleTalukaChange = async (talukaIndex: number) => {
    await loadLandOptions({
      state_index: DEFAULT_STATE_INDEX,
      category_index: landForm.category_index,
      district_index: landForm.district_index,
      taluka_index: talukaIndex,
      village_index: 0,
    });
  };

  const handleVillageChange = async (villageIndex: number) => {
    await loadLandOptions({
      state_index: DEFAULT_STATE_INDEX,
      category_index: landForm.category_index,
      district_index: landForm.district_index,
      taluka_index: landForm.taluka_index,
      village_index: villageIndex,
    });
  };

  const [claimForm, setClaimForm] = useState({
    crop_type: 'Wheat',
    damage_date: new Date().toISOString().slice(0, 10),
    analysis_start_date: new Date(Date.now() - (10 * 24 * 60 * 60 * 1000)).toISOString().slice(0, 10),
    analysis_end_date: new Date().toISOString().slice(0, 10),
    gap_before: 5,
    gap_after: 5,
    window_days: 10,
    max_cloud_threshold: 100,
    upscale_factor: 3,
  });

  const canStep3 = entryMode === 'manual' ? true : (!!farm && farmConfirmed);

  const ownerPreview = useMemo(() => {
    if (!farm) return 'No owner metadata';
    return farm.owner_names.length > 0 ? farm.owner_names.join(', ') : 'Operator data unavailable';
  }, [farm]);

  const submitLandLookup = async () => {
    setError(null);
    setFormErrors((prev) => ({ ...prev, landFarmerName: undefined }));
    if (!landForm.farmer_name.trim()) {
      setFormErrors((prev) => ({ ...prev, landFarmerName: 'Authorized name required.' }));
      return;
    }
    setLoading(true);
    try {
      const profile = await createFarmProfile({
        farmer_name: landForm.farmer_name.trim(),
        state_index: landForm.state_index,
        category_index: landForm.category_index,
        district_index: landForm.district_index,
        taluka_index: landForm.taluka_index,
        village_index: landForm.village_index,
        plot_index: landForm.plot_index,
        headless: landForm.headless,
      });
      setFarm(profile);
      setStep(2);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(`Transmission rejected (${err.status}).`);
      } else {
        setError(`Link failed: ${String(err)}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const continueManualFlow = () => {
    setError(null);
    const nextErrors: typeof formErrors = {};
    if (!manualForm.farmer_name.trim()) {
      nextErrors.manualFarmerName = 'Operator name required.';
    }
    if (manualForm.farm_area_hectares <= 0) {
      nextErrors.manualArea = 'Dimension must be > 0.';
    }
    if (manualForm.latitude < -90 || manualForm.latitude > 90) {
      nextErrors.manualLatitude = 'Lat out of bounds.';
    }
    if (manualForm.longitude < -180 || manualForm.longitude > 180) {
      nextErrors.manualLongitude = 'Long out of bounds.';
    }
    if (claimForm.analysis_start_date > claimForm.analysis_end_date) {
      nextErrors.analysisDateRange = 'Invalid temporal window.';
    }
    setFormErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }
    setStep(3);
  };

  const trackAnalysisJob = async (jobId: string, claimId: number, onFailure?: (message: string) => void) => {
    try {
      const latest = await waitForJobCompletion(jobId, {
        timeoutMs: 10 * 60_000,
        onUpdate: (update) => {
          setJobProgress(update.progress ?? 0);
          setJobInfo(`Processing Matrix: ${update.status} (${update.progress ?? 0}%)`);
        },
      });

      if (latest.status === 'failed') {
        const message = latest.error_message ?? 'Matrix runtime error.';
        setJobInfo(`Fault: ${message}`);
        onFailure?.(message);
        return;
      }

      setJobProgress(100);
      setJobInfo('Cycle completed. Syncing state...');
      await claimsQuery.refetch();
      setSubmittedClaimId(claimId);
      setView('status');
    } catch (err) {
      const message = String(err);
      setJobInfo(`Link broken: ${message}`);
      onFailure?.(message);
    }
  };

  const openRetryPanel = async (claim: Claim) => {
    const damageDate = new Date(`${claim.damage_date}T00:00:00`);
    const startDate = new Date(damageDate.getTime() - (10 * 24 * 60 * 60 * 1000));
    const endDate = new Date(damageDate.getTime() + (10 * 24 * 60 * 60 * 1000));
    setRetryStartDate(startDate.toISOString().slice(0, 10));
    setRetryEndDate(endDate.toISOString().slice(0, 10));
    setRetryClaimId(claim.id);
    setRetryError(null);
    setRetryJob(null);
    try {
      const latest = await getAnalysis(claim.id);
      setRetryFailureReason(normalizeFailureReason(latest.analysis?.status_message));
    } catch {
      setRetryFailureReason(normalizeFailureReason());
    }
  };

  const submitRetryAnalysis = async (claim: Claim) => {
    setRetryError(null);
    if (retryStartDate > retryEndDate) {
      setRetryError('Temporal window invalid.');
      return;
    }
    setRetryBusy(true);
    try {
      const params = calculateAnalysisParams(
        claim.damage_date,
        retryStartDate,
        retryEndDate,
        claimForm.max_cloud_threshold,
        claimForm.upscale_factor,
      );
      const job = await analyzeClaim(claim.id, params);
      void (async () => {
        try {
          const latest = await waitForJobCompletion(job.job_id, {
            timeoutMs: 10 * 60_000,
            onUpdate: (update) => setRetryJob(update),
          });
          if (latest.status === 'failed') {
            setRetryFailureReason(normalizeFailureReason(latest.error_message));
            setRetryError(normalizeFailureReason(latest.error_message));
            return;
          }
          await claimsQuery.refetch();
          setRetryClaimId(null);
          setSubmittedClaimId(claim.id);
        } catch (retryErr) {
          setRetryError(String(retryErr));
        }
      })();
    } catch (err) {
      setRetryError(String(err));
    } finally {
      setRetryBusy(false);
    }
  };

  const submitNeedsMoreInfoNotes = async (claimId: number) => {
    const notes = (farmerNotesDraft[claimId] ?? '').trim();
    if (!notes) {
      setFarmerNotesErrorById((prev) => ({ ...prev, [claimId]: 'Rationale required for override.' }));
      return;
    }
    setFarmerNotesBusyId(claimId);
    setFarmerNotesErrorById((prev) => ({ ...prev, [claimId]: '' }));
    try {
      await submitFarmerNotes(claimId, { notes });
      setFarmerNotesDraft((prev) => ({ ...prev, [claimId]: '' }));
      await claimsQuery.refetch();
    } catch (err) {
      if (err instanceof ApiError) {
        setFarmerNotesErrorById((prev) => ({ ...prev, [claimId]: `Signature fault (${err.status}).` }));
      } else {
        setFarmerNotesErrorById((prev) => ({ ...prev, [claimId]: `Override failed: ${String(err)}` }));
      }
    } finally {
      setFarmerNotesBusyId(null);
    }
  };

  const buildAnalysisParams = () =>
    calculateAnalysisParams(
      claimForm.damage_date,
      claimForm.analysis_start_date,
      claimForm.analysis_end_date,
      claimForm.max_cloud_threshold,
      claimForm.upscale_factor,
    );

  const submitClaim = async () => {
    if (entryMode === 'automation' && !farm) return;
    setError(null);
    setLoading(true);
    setStep(4);
    setJobProgress(0);
    setJobInfo('Initializing payload segment...');

    try {
      const claim = await createClaim(
        entryMode === 'automation'
          ? {
              farm_profile_id: farm!.id,
              farmer_name: farm!.farmer_name,
              crop_type: claimForm.crop_type,
              damage_date: claimForm.damage_date,
            }
          : {
              farmer_name: manualForm.farmer_name.trim(),
              crop_type: claimForm.crop_type,
              farm_area_hectares: manualForm.farm_area_hectares,
              latitude: manualForm.latitude,
              longitude: manualForm.longitude,
              damage_date: claimForm.damage_date,
            }
      );

      setJobInfo('Packet sent. Streaming raster analysis...');
      const job = await analyzeClaim(claim.id, buildAnalysisParams());

      setJobInfo('Analysis sequence started. Monitoring...');
      setSubmittedClaimId(claim.id);
      setView('status');
      setStep(1);
      setLoading(false);
      void trackAnalysisJob(job.job_id, claim.id);
      void claimsQuery.refetch();
      return;
    } catch (err) {
      setError(String(err));
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 lg:gap-8 pb-12 overflow-x-hidden">
      
      {/* BRANDING LAYER */}
      <div className="flex items-center justify-between rounded-xl bg-[#eef8f1] px-4 py-3 border border-[#7ddf92]/20 shadow-sm mb-2 max-w-full overflow-hidden">
        <div className="flex items-center gap-2">
          <Satellite className="text-primary w-5 h-5 flex-shrink-0" />
          <span className="text-primary font-bold text-sm truncate">Secure Claim Transmission Layer</span>
        </div>
      </div>

      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl lg:text-4xl font-extrabold text-gray-900 tracking-tight">Request Portal</h1>
          <p className="text-sm text-gray-500 lg:text-base max-w-2xl">
            Register crop-damage vectors, track spatial audits, and finalize settlement payloads.
          </p>
        </div>
        
        {/* VIEW TOGGLE */}
        <div className="bg-gray-100/80 p-1.5 rounded-[20px] flex items-center gap-1 border border-gray-200 w-fit self-start md:self-auto">
          <button
            onClick={() => setView('new')}
            className={`px-6 py-2.5 rounded-[16px] text-sm font-bold transition-all ${
              view === 'new' ? 'bg-white text-primary shadow-md' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            New Request
          </button>
          <button
            onClick={() => setView('status')}
            className={`px-6 py-2.5 rounded-[16px] text-sm font-bold transition-all ${
              view === 'status' ? 'bg-white text-primary shadow-md' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Track Assets
          </button>
        </div>
      </header>

      {error && <div className="animate-in fade-in slide-in-from-top-2"><ErrorBanner message={error} onRetry={() => setError(null)} /></div>}

      {view === 'status' ? (
        <section className="bg-white rounded-[32px] border border-gray-100 shadow-[0_12px_40px_rgba(31,52,38,0.06)] overflow-hidden flex flex-col animate-in fade-in">
          <div className="px-6 lg:px-8 py-5 border-b border-gray-50 flex items-center justify-between gap-4">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-primary" /> Active Claim Vectors
            </h2>
            <button
               onClick={refreshRequests}
               className="flex items-center gap-2 bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-600 px-4 py-2 rounded-xl text-xs font-bold transition-all"
            >
              <RefreshCw size={14} className={claimsQuery.loading ? 'animate-spin' : ''} />
              Poll Server
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left min-w-[800px]">
              <thead>
                <tr className="bg-gray-50/50">
                   <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest text-gray-400">ID</th>
                   <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest text-gray-400">Asset Type</th>
                   <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest text-gray-400">Event Date</th>
                   <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest text-gray-400 text-center">Audit Status</th>
                   <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest text-gray-400 text-right">Analysis Detail</th>
                </tr>
              </thead>
              <tbody>
                {claimsQuery.loading ? (
                   <tr><td colSpan={5} className="px-6 py-16 text-center text-gray-400 font-bold text-sm">Synchronizing orbital data...</td></tr>
                ) : claims.length === 0 ? (
                  <tr><td colSpan={5} className="px-6 py-16 text-center text-gray-400 font-bold text-sm">No active claims found in history.</td></tr>
                ) : (
                  claims.map((claim) => {
                    const approved = canViewDetailedReport(claim);
                    return (
                      <Fragment key={claim.id}>
                        <tr className={`border-b border-gray-50 hover:bg-gray-50/40 transition-colors ${submittedClaimId === claim.id ? 'bg-primary/5' : ''}`}>
                          <td className="px-6 py-4 font-mono text-[11px] font-bold text-gray-400">#{claim.id}</td>
                          <td className="px-6 py-4 text-sm font-bold text-gray-900">{claim.crop_type}</td>
                          <td className="px-6 py-4 text-sm font-medium text-gray-500">{claim.damage_date}</td>
                          <td className="px-6 py-4 text-center">
                            <ClaimStatusBadge claim={claim} />
                          </td>
                          <td className="px-6 py-4 text-right">
                             {approved ? (
                                 <Link href={`/analysis/${claim.id}`} className="inline-flex items-center gap-1.5 text-primary hover:text-emerald-700 font-bold transition-colors">
                                   View Report <ChevronRight size={14} />
                                 </Link>
                             ) : claim.status === 'failed' ? (
                               <button 
                                 onClick={() => openRetryPanel(claim)}
                                 className="inline-flex items-center gap-1.5 bg-rose-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm hover:scale-105 transition-all"
                               >
                                 Retry Matrix <AlertTriangle size={12} />
                               </button>
                             ) : (
                               <span className="inline-flex items-center gap-1 text-[11px] font-bold text-gray-300">
                                 <Lock size={12} /> Sealed
                               </span>
                             )}
                          </td>
                        </tr>

                        {/* RETRY MODULE PANEL */}
                        {retryClaimId === claim.id && (
                          <tr className="bg-orange-50/30 border-b-2 border-orange-200">
                            <td colSpan={5} className="p-6">
                               <div className="bg-white rounded-[24px] border border-orange-100 p-6 shadow-sm flex flex-col gap-5 max-w-3xl">
                                  <div>
                                    <h3 className="text-[11px] font-bold text-orange-600 uppercase tracking-widest mb-1 flex items-center gap-2">
                                      <AlertTriangle className="w-3.5 h-3.5" /> Matrix Fault Detected
                                    </h3>
                                    <p className="text-sm font-medium text-gray-700">{retryFailureReason}</p>
                                  </div>
                                  
                                  <div className="grid md:grid-cols-2 gap-4">
                                     <div className="flex flex-col gap-2">
                                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider pl-1">Baseline Sync</label>
                                        <input type="date" value={retryStartDate} onChange={(e)=>setRetryStartDate(e.target.value)} className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-semibold outline-none focus:ring-2 focus:ring-orange-500/20" />
                                     </div>
                                     <div className="flex flex-col gap-2">
                                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider pl-1">Post-Event Window</label>
                                        <input type="date" value={retryEndDate} onChange={(e)=>setRetryEndDate(e.target.value)} className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-semibold outline-none focus:ring-2 focus:ring-orange-500/20" />
                                     </div>
                                  </div>

                                  <div className="flex items-center gap-3">
                                     <button 
                                       disabled={retryBusy}
                                       onClick={() => submitRetryAnalysis(claim)}
                                       className="bg-gray-900 hover:bg-black text-white px-6 py-2.5 rounded-xl text-sm font-bold shadow-md transition-all flex items-center gap-2 flex-1 justify-center"
                                     >
                                       {retryBusy ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />} 
                                       Re-Initialize Analysis
                                     </button>
                                     <button onClick={()=>setRetryClaimId(null)} className="px-6 py-2.5 rounded-xl text-sm font-bold text-gray-500 hover:bg-gray-100 flex-1 justify-center">Cancel</button>
                                  </div>
                               </div>
                            </td>
                          </tr>
                        )}

                        {/* NEEDS INFO PANEL */}
                        {claim.admin_status === 'needs_more_info' && (
                          <tr className="bg-amber-50/30 border-b-2 border-amber-200">
                             <td colSpan={5} className="p-6">
                               <div className="bg-white rounded-[24px] border border-amber-100 p-6 shadow-sm flex flex-col gap-5 max-w-3xl">
                                  <div className="flex flex-col gap-1">
                                    <h3 className="text-[11px] font-bold text-amber-600 uppercase tracking-widest flex items-center gap-2">
                                      <ShieldCheck className="w-3.5 h-3.5" /> Response Required
                                    </h3>
                                    <p className="text-sm font-bold text-gray-900">{claim.admin_notes || 'Admin requesting additional field insights.'}</p>
                                  </div>
                                  
                                  <textarea 
                                    className="bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                                    rows={4}
                                    placeholder="Enter telemetry justification or evidence..."
                                    value={farmerNotesDraft[claim.id] || ''}
                                    onChange={(e)=>setFarmerNotesDraft(p=>({...p, [claim.id]: e.target.value}))}
                                  />
                                  
                                  <div className="flex items-center gap-3">
                                     <button 
                                       disabled={farmerNotesBusyId === claim.id}
                                       onClick={() => submitNeedsMoreInfoNotes(claim.id)}
                                       className="bg-primary hover:bg-primary-dark text-white px-8 py-3 rounded-xl text-sm font-bold shadow-lg shadow-primary/20 transition-all flex items-center gap-2"
                                     >
                                       {farmerNotesBusyId === claim.id ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} 
                                       Transmit Remarks
                                     </button>
                                  </div>
                               </div>
                             </td>
                          </tr>
                        )}
                      </Fragment>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        /* RAISE NEW REQUEST FLOW */
        <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-4">
          
          {/* PROGRESS INDICATOR */}
          <div className="grid grid-cols-4 gap-3 lg:gap-6">
             {[
               { id: 1, label: 'Mode', icon: Layers },
               { id: 2, label: 'Audit Farm', icon: MapIcon },
               { id: 3, label: 'Metadata', icon: ClipboardList },
               { id: 4, label: 'Processing', icon: Satellite }
             ].map((s) => (
                <div key={s.id} className={`flex items-center gap-3 p-3 rounded-2xl border transition-all ${step >= s.id ? 'bg-primary border-primary text-white shadow-lg' : 'bg-gray-50 border-gray-200 text-gray-400'}`}>
                   <div className={`p-1.5 rounded-lg ${step >= s.id ? 'bg-white/20' : 'bg-gray-200/50'}`}>
                      <s.icon size={16} strokeWidth={3} />
                   </div>
                   <span className="text-[11px] font-extrabold uppercase tracking-widest hidden md:block">{s.label}</span>
                </div>
             ))}
          </div>

          <div className="bg-white rounded-[32px] p-6 lg:p-10 border border-gray-100 shadow-[0_12px_45px_rgba(31,52,38,0.08)] min-h-[500px] flex flex-col">
            
            {/* STEP 1: MODE SELECTION */}
            {step === 1 && (
              <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-right-4">
                 <div className="flex flex-col gap-2">
                    <h2 className="text-2xl font-extrabold text-gray-900">Selection Layer</h2>
                    <p className="text-sm text-gray-500">Choose between verified automation or manual payload definition.</p>
                 </div>
                 
                 <div className="grid md:grid-cols-2 gap-5">
                    <button 
                      onClick={() => setEntryMode('automation')}
                      className={`group relative p-6 rounded-[24px] border-2 transition-all flex flex-col gap-4 text-left ${entryMode === 'automation' ? 'border-primary bg-primary/5' : 'border-gray-100 hover:border-gray-200'}`}
                    >
                       <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors ${entryMode === 'automation' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-400 group-hover:bg-gray-200'}`}>
                          <Satellite size={24} />
                       </div>
                       <div>
                          <h3 className={`font-bold ${entryMode === 'automation' ? 'text-primary' : 'text-gray-900'}`}>Orbital Automation</h3>
                          <p className="text-xs text-gray-500 mt-1">Connect to Mahabhunakasha for verified spatial alignment.</p>
                       </div>
                       {entryMode === 'automation' && <div className="absolute top-4 right-4"><CheckCircle2 className="text-primary w-6 h-6" /></div>}
                    </button>

                    <button 
                      onClick={() => setEntryMode('manual')}
                      className={`group relative p-6 rounded-[24px] border-2 transition-all flex flex-col gap-4 text-left ${entryMode === 'manual' ? 'border-primary bg-primary/5' : 'border-gray-100 hover:border-gray-200'}`}
                    >
                       <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors ${entryMode === 'manual' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-400 group-hover:bg-gray-200'}`}>
                          <Layers size={24} />
                       </div>
                       <div>
                          <h3 className={`font-bold ${entryMode === 'manual' ? 'text-primary' : 'text-gray-900'}`}>Manual Definition</h3>
                          <p className="text-xs text-gray-500 mt-1">Define coordinates and farm parameters manually.</p>
                       </div>
                       {entryMode === 'manual' && <div className="absolute top-4 right-4"><CheckCircle2 className="text-primary w-6 h-6" /></div>}
                    </button>
                 </div>

                 {entryMode === 'automation' ? (
                    <div className="flex flex-col gap-5 p-8 border border-gray-100 rounded-[28px] bg-gray-50/50 mt-2">
                       <div className="flex flex-col gap-2">
                          <label className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1">Authorized Operator Name</label>
                          <input 
                            value={landForm.farmer_name}
                            onChange={(e)=>{setLandForm(p=>({...p, farmer_name: e.target.value})); setFormErrors(p=>({...p, landFarmerName: undefined}))}}
                            placeholder="Full Legal Name"
                            className="w-full bg-white border border-gray-200 rounded-[18px] px-5 py-4 text-sm font-bold shadow-sm focus:ring-4 focus:ring-primary/10 outline-none transition-all"
                          />
                          {formErrors.landFarmerName && <p className="text-xs font-bold text-rose-500 mt-1 ml-1">{formErrors.landFarmerName}</p>}
                       </div>

                       <div className="grid grid-cols-2 md:grid-cols-3 gap-4 lg:gap-6">
                           {[
                             { label: 'Category', value: landForm.category_index, options: landOptions.category, change: handleCategoryChange },
                             { label: 'District', value: landForm.district_index, options: landOptions.district, change: handleDistrictChange },
                             { label: 'Taluka', value: landForm.taluka_index, options: landOptions.taluka, change: handleTalukaChange },
                             { label: 'Village', value: landForm.village_index, options: landOptions.village, change: handleVillageChange },
                             { label: 'Plot / Survey', value: landForm.plot_index, options: landOptions.plot, change: (val: number)=>setLandForm(p=>({...p, plot_index: val})) },
                           ].map((f: any)=> (
                             <div key={f.label} className="flex flex-col gap-1.5">
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">{f.label}</label>
                                <select 
                                  value={f.value}
                                  onChange={(e)=>f.change(Number(e.target.value))}
                                  disabled={optionsLoading}
                                  className="bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-xs font-bold outline-none shadow-sm disabled:opacity-50 transition-all focus:border-primary"
                                >
                                   {f.options.map((o: any)=>(<option key={o.index} value={o.index}>{getReadableLabel(o.label)}</option>))}
                                </select>
                             </div>
                           ))}
                       </div>
                       
                       <div className="flex items-center justify-between gap-4 mt-4 bg-white p-5 rounded-[22px] border border-gray-100 shadow-sm">
                          <p className="text-xs font-bold text-gray-500 max-w-[300px]">System will initialize a secure handshake with the land records database.</p>
                          <button 
                            disabled={loading || optionsLoading}
                            onClick={submitLandLookup}
                            className="flex items-center gap-2 bg-primary hover:bg-primary-dark text-white px-8 py-3.5 rounded-[18px] text-sm font-extrabold shadow-lg shadow-primary/20 transition-all whitespace-nowrap"
                          >
                            {loading ? <Loader2 size={18} className="animate-spin" /> : <Satellite size={18} />} Synchronize
                          </button>
                       </div>
                    </div>
                 ) : (
                   <div className="flex flex-col gap-6 p-8 border border-gray-100 rounded-[28px] bg-gray-50/50 mt-2 animate-in fade-in slide-in-from-top-4">
                      <div className="grid md:grid-cols-2 gap-6">
                        <div className="flex flex-col gap-2">
                           <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Operator Signature</label>
                           <input 
                             value={manualForm.farmer_name}
                             onChange={(e)=>setManualForm(p=>({...p, farmer_name:e.target.value}))}
                             placeholder="Full Operator Name"
                             className="bg-white border border-gray-200 rounded-2xl px-5 py-4 text-sm font-bold shadow-sm focus:ring-4 focus:ring-primary/10 outline-none"
                           />
                           {formErrors.manualFarmerName && <p className="text-xs font-bold text-rose-500">{formErrors.manualFarmerName}</p>}
                        </div>
                        <div className="flex flex-col gap-2">
                           <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Spatial Extent (Ha)</label>
                           <input 
                             type="number" step="0.01"
                             value={manualForm.farm_area_hectares}
                             onChange={(e)=>setManualForm(p=>({...p, farm_area_hectares: Number(e.target.value)}))}
                             className="bg-white border border-gray-200 rounded-2xl px-5 py-4 text-sm font-bold shadow-sm focus:ring-4 focus:ring-primary/10 outline-none"
                           />
                           {formErrors.manualArea && <p className="text-xs font-bold text-rose-500">{formErrors.manualArea}</p>}
                        </div>
                      </div>
                      <div className="grid md:grid-cols-2 gap-6">
                        <div className="flex flex-col gap-2">
                           <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Latitude Coordinate</label>
                           <input 
                             type="number" step="0.000001"
                             value={manualForm.latitude}
                             onChange={(e)=>setManualForm(p=>({...p, latitude: Number(e.target.value)}))}
                             className="bg-white border border-gray-200 rounded-2xl px-5 py-4 text-sm font-bold shadow-sm focus:ring-4 focus:ring-primary/10 outline-none"
                           />
                        </div>
                        <div className="flex flex-col gap-2">
                           <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Longitude Coordinate</label>
                           <input 
                             type="number" step="0.000001"
                             value={manualForm.longitude}
                             onChange={(e)=>setManualForm(p=>({...p, longitude: Number(e.target.value)}))}
                             className="bg-white border border-gray-200 rounded-2xl px-5 py-4 text-sm font-bold shadow-sm focus:ring-4 focus:ring-primary/10 outline-none"
                           />
                        </div>
                      </div>
                      <div className="flex justify-end mt-4">
                         <button 
                           onClick={continueManualFlow}
                           className="bg-primary hover:bg-primary-dark text-white px-10 py-4 rounded-[18px] text-sm font-extrabold shadow-lg shadow-primary/20 flex items-center gap-2"
                         >
                            Continue to Logic <ArrowRight size={18} />
                         </button>
                      </div>
                   </div>
                 )}
              </div>
            )}

            {/* STEP 2: FARM AUDIT (Verification) */}
            {step === 2 && farm && (
              <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-right-4">
                 <div className="flex flex-col gap-2">
                    <h2 className="text-2xl font-extrabold text-gray-900">Spatial Consensus</h2>
                    <p className="text-sm text-gray-500">Confirm the identified spatial buffer before committing payload.</p>
                 </div>

                 <div className="bg-gray-900 rounded-[32px] border-8 border-gray-800 shadow-2xl overflow-hidden relative group">
                    <FarmBoundaryMap
                      polygon={farm.polygon}
                      center={[farm.centroid_latitude, farm.centroid_longitude]}
                      height={400}
                    />
                    <div className="absolute top-6 left-6 bg-gray-900/80 backdrop-blur-md border border-white/10 p-4 rounded-2xl text-white shadow-xl pointer-events-none">
                       <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Live Spatial Vector</p>
                       <p className="text-lg font-extrabold">{farm.farm_area_hectares.toFixed(2)} <span className="text-sm font-bold text-gray-400">Hectares</span></p>
                    </div>
                 </div>

                 <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-gray-50 p-4 rounded-[20px] border border-gray-100">
                       <span className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Operator Ledger</span>
                       <span className="text-sm font-bold text-gray-800 line-clamp-1 truncate">{ownerPreview}</span>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-[20px] border border-gray-100">
                       <span className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Survey Identifier</span>
                       <span className="text-sm font-bold text-gray-800">{farm.survey_numbers.join(', ') || 'Manual'}</span>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-[20px] border border-gray-100 col-span-2">
                       <span className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Spatial Extent (Boundaries)</span>
                       <span className="text-sm font-bold text-gray-800 font-mono">{farm.extent.map(v=>v.toFixed(4)).join(' , ')}</span>
                    </div>
                 </div>

                 {farm.screenshot_data_url && (
                   <div className="flex flex-col gap-3">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Automated Capture Ledger</label>
                      <div className="rounded-[28px] overflow-hidden border border-gray-100 shadow-lg">
                        <Image src={farm.screenshot_data_url} alt="Registry" width={1280} height={720} unoptimized className="w-full h-auto" />
                      </div>
                   </div>
                 )}

                 <div className="mt-4 flex flex-col gap-6 md:flex-row md:items-center justify-between border-t border-gray-100 pt-8">
                    <label className="flex items-center gap-4 cursor-pointer group">
                       <div className={`w-8 h-8 rounded-xl border-2 flex items-center justify-center transition-all ${farmConfirmed ? 'bg-primary border-primary text-white' : 'bg-white border-gray-200 group-hover:border-primary/40'}`}>
                          {farmConfirmed && <CheckCircle2 size={20} />}
                       </div>
                       <input type="checkbox" className="hidden" checked={farmConfirmed} onChange={(e)=>setFarmConfirmed(e.target.checked)} />
                       <span className="text-sm font-bold text-gray-700">Override: Confirm spatial vector alignment.</span>
                    </label>

                    <div className="flex items-center gap-3">
                       <button onClick={()=>setStep(1)} className="px-8 py-3.5 rounded-xl text-sm font-bold text-gray-500 hover:bg-gray-100 transition-all">Reject & Reset</button>
                       <button 
                         disabled={!farmConfirmed}
                         onClick={()=>setStep(3)}
                         className="bg-[#1b241d] hover:bg-gray-800 text-white px-10 py-3.5 rounded-[18px] text-sm font-extrabold shadow-xl shadow-gray-200 transition-all disabled:opacity-40 flex items-center gap-2"
                       >
                         Seal & Continue <ChevronRight size={18} />
                       </button>
                    </div>
                 </div>
              </div>
            )}

            {/* STEP 3: PAYLOAD METADATA */}
            {step === 3 && (entryMode === 'manual' || farm) && (
              <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-right-4 flex-1">
                 <div className="flex flex-col gap-2">
                    <h2 className="text-2xl font-extrabold text-gray-900">Payload Parameters</h2>
                    <p className="text-sm text-gray-500">Define the incident metadata and orbital sensing window.</p>
                 </div>

                 <div className="grid md:grid-cols-2 gap-x-10 gap-y-8 flex-1">
                    {/* LEFT PANEL: Asset Context */}
                    <div className="flex flex-col gap-7">
                       <div className="flex flex-col gap-2">
                          <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Asset Category (Crop)</label>
                          <select 
                            value={claimForm.crop_type}
                            onChange={(e)=>setClaimForm(p=>({...p, crop_type: e.target.value}))}
                            className="bg-gray-50 border border-gray-200 rounded-2xl px-5 py-4 text-sm font-bold outline-none focus:ring-4 focus:ring-primary/10 transition-all"
                          >
                             {['Wheat', 'Rice', 'Cotton', 'Soybean', 'Sugarcane', 'Maize'].map(c=>(<option key={c}>{c}</option>))}
                          </select>
                       </div>

                       <div className="flex flex-col gap-2">
                          <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Incident Timestamp</label>
                          <input 
                            type="date"
                            value={claimForm.damage_date}
                            onChange={(e)=>setClaimForm(p=>({...p, damage_date: e.target.value}))}
                            className="bg-gray-50 border border-gray-200 rounded-2xl px-5 py-4 text-sm font-bold outline-none focus:ring-4 focus:ring-primary/10 transition-all"
                          />
                       </div>

                       <div className="p-6 rounded-[24px] bg-indigo-50/50 border border-indigo-100 mt-2">
                          <div className="flex items-start gap-4">
                             <div className="bg-indigo-100 p-2 rounded-xl text-indigo-600 mt-1">
                                <Satellite size={20} />
                             </div>
                             <div>
                                <h3 className="text-sm font-bold text-indigo-900 mb-1">Orbital Constraint</h3>
                                <p className="text-xs text-indigo-800/80 leading-relaxed">System will compute NDVI/NDWI deltas across the specified temporal window. Max cloud interference restricted to {claimForm.max_cloud_threshold}%.</p>
                             </div>
                          </div>
                       </div>
                    </div>

                    {/* RIGHT PANEL: Temporal Specs */}
                    <div className="flex flex-col gap-7">
                       <div className="grid grid-cols-2 gap-4">
                          <div className="flex flex-col gap-2">
                             <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Sensing Start</label>
                             <input 
                               type="date"
                               value={claimForm.analysis_start_date}
                               onChange={(e)=>setClaimForm(p=>({...p, analysis_start_date: e.target.value}))}
                               className="bg-gray-50 border border-gray-200 rounded-2xl px-5 py-4 text-sm font-bold outline-none focus:ring-4 focus:ring-primary/10 transition-all"
                             />
                          </div>
                          <div className="flex flex-col gap-2">
                             <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Sensing End</label>
                             <input 
                               type="date"
                               value={claimForm.analysis_end_date}
                               onChange={(e)=>setClaimForm(p=>({...p, analysis_end_date: e.target.value}))}
                               className="bg-gray-50 border border-gray-200 rounded-2xl px-5 py-4 text-sm font-bold outline-none focus:ring-4 focus:ring-primary/10 transition-all"
                             />
                          </div>
                       </div>

                       <div className="grid grid-cols-3 gap-4">
                          {[
                            { l: 'Gap Before', v: claimForm.gap_before },
                            { l: 'Gap After', v: claimForm.gap_after },
                            { l: 'Window', v: claimForm.window_days }
                          ].map(f=>(
                             <div key={f.l} className="flex flex-col gap-1.5 opacity-50">
                                <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">{f.l}</label>
                                <div className="bg-gray-100 border border-gray-200 rounded-xl px-4 py-3 text-xs font-bold text-gray-500">{f.v}d</div>
                             </div>
                          ))}
                       </div>

                       <div className="flex flex-col gap-2">
                          <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1 flex justify-between">
                             <span>Sky Obscurity Limit</span>
                             <span>{claimForm.max_cloud_threshold}%</span>
                          </label>
                          <input 
                            type="range" min="0" max="100"
                            value={claimForm.max_cloud_threshold}
                            onChange={(e)=>setClaimForm(p=>({...p, max_cloud_threshold: Number(e.target.value)}))}
                            className="w-full accent-primary h-2 bg-gray-100 rounded-full appearance-none cursor-pointer"
                          />
                       </div>
                    </div>
                 </div>

                 <div className="mt-auto flex items-center justify-between border-t border-gray-100 pt-8">
                    <button onClick={()=>setStep(entryMode === 'automation' ? 2 : 1)} className="px-8 py-3.5 rounded-xl text-sm font-bold text-gray-500 hover:bg-gray-100 transition-all flex items-center gap-2">
                       <ChevronLeft size={18} /> Re-Align
                    </button>
                    <button 
                      onClick={submitClaim}
                      className="bg-primary hover:bg-primary-dark text-white px-12 py-4 rounded-[20px] text-sm font-extrabold shadow-xl shadow-primary/20 transition-all flex items-center gap-3 animate-pulse"
                    >
                      Initialize Transmission <Send size={18} />
                    </button>
                 </div>
              </div>
            )}

            {/* STEP 4: PROCESSING */}
            {step === 4 && (
              <div className="flex-1 flex flex-col items-center justify-center text-center gap-8 py-10 animate-in zoom-in-95 duration-500">
                 <div className="relative">
                    <div className="w-24 h-24 rounded-[32px] bg-primary/10 flex items-center justify-center text-primary animate-bounce">
                       <Satellite size={48} />
                    </div>
                    <div className="absolute inset-0 w-24 h-24 rounded-[32px] border-4 border-primary/20 animate-ping" />
                 </div>

                 <div className="flex flex-col gap-3">
                    <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight">{jobInfo}</h2>
                    <p className="text-sm font-medium text-gray-400 max-w-sm">Neural engines are computing differential indices across spatial vectors. Do not disconnect.</p>
                 </div>

                 <div className="w-full max-w-md bg-gray-50 rounded-full h-4 border border-gray-100 overflow-hidden shadow-inner p-1">
                    <div 
                      className="h-full bg-primary rounded-full transition-all duration-1000 shadow-[0_0_15px_rgba(47,133,90,0.4)]"
                      style={{ width: `${Math.max(5, Math.min(100, jobProgress))}%` }}
                    />
                 </div>
                 <span className="text-xs font-black text-primary uppercase tracking-[0.2em]">{Math.round(jobProgress)}% Sync Completed</span>
              </div>
            )}

          </div>
        </div>
      )}
    </div>
  );
}

function Send(props: any) {
  return (
    <svg 
      {...props}
      xmlns="http://www.w3.org/2000/svg" 
      width="24" 
      height="24" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    >
      <line x1="22" y1="2" x2="11" y2="13"></line>
      <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
    </svg>
  );
}
