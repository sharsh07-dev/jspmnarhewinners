'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ChevronDown, ChevronUp, Download, RefreshCw, Send, ShieldCheck, PieChart as PieChartIcon, AlertTriangle, AlertCircle, MapPin, ClipboardList, TrendingUp } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import ErrorBanner from '@/components/ErrorBanner';
import FarmBoundaryMap from '@/components/FarmBoundaryMap';
import {
  bulkReviewAdminClaims,
  downloadAdminReportPdf,
  getAdminClaimFull,
  getAnalysisArtifacts,
  reviewAdminClaim,
} from '@/lib/api';
import { useAdminClaims } from '@/hooks/useApi';
import type { AdminClaim, AdminClaimFullResponse, AnalysisArtifacts } from '@/types/api';

/* ... types and hooks are same ... */
interface ReviewState {
  [claimId: number]: {
    admin_status: 'pending_review' | 'approved' | 'rejected' | 'needs_more_info';
    reviewed_by: string;
    admin_notes: string;
    recommended_insurance_amount: string;
  };
}

function useAdminQueryParams() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const page = Math.max(1, Number(searchParams.get('page') ?? '1') || 1);
  const adminStatus = searchParams.get('admin_status') ?? '';
  const cropType = searchParams.get('crop_type') ?? '';
  const status = searchParams.get('status') ?? '';
  const damageDateFrom = searchParams.get('damage_date_from') ?? '';
  const damageDateTo = searchParams.get('damage_date_to') ?? '';
  const search = searchParams.get('search') ?? '';

  const setParams = (updates: Record<string, string | number | null>) => {
    const next = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([key, value]) => {
      if (value === null || value === '') {
        next.delete(key);
      } else {
        next.set(key, String(value));
      }
    });
    router.replace(`${pathname}?${next.toString()}`);
  };

  return {
    page,
    adminStatus,
    cropType,
    status,
    damageDateFrom,
    damageDateTo,
    search,
    setParams,
  };
}

export default function AdminClaimsPage() {
  const pageSize = 20;
  const { page, adminStatus, cropType, status, damageDateFrom, damageDateTo, search, setParams } = useAdminQueryParams();
  const offset = (page - 1) * pageSize;

  const { data, loading, error, refetch } = useAdminClaims({
    limit: pageSize,
    offset,
    status: status || undefined,
    admin_status: adminStatus || undefined,
    crop_type: cropType || undefined,
    damage_date_from: damageDateFrom || undefined,
    damage_date_to: damageDateTo || undefined,
    search: search || undefined,
  });

  const [reviewState, setReviewState] = useState<ReviewState>({});
  const [message, setMessage] = useState<string | null>(null);
  const [busyClaimId, setBusyClaimId] = useState<number | null>(null);
  const [expandedClaimId, setExpandedClaimId] = useState<number | null>(null);
  const [expandedData, setExpandedData] = useState<Record<number, AdminClaimFullResponse>>({});
  const [expandedArtifacts, setExpandedArtifacts] = useState<Record<number, AnalysisArtifacts>>({});
  const [expandedBusy, setExpandedBusy] = useState<number | null>(null);

  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [bulkReviewedBy, setBulkReviewedBy] = useState('Admin');
  const [bulkNotes, setBulkNotes] = useState('');
  const [bulkAmount, setBulkAmount] = useState('');
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkFieldErrors, setBulkFieldErrors] = useState<{ selected?: string; reviewedBy?: string }>({});

  const claims = useMemo(() => data?.items ?? [], [data?.items]);
  const totalCount = data?.total_count ?? 0;
  const hasPrev = page > 1;
  const hasNext = offset + claims.length < totalCount;

  const adminStatusChartData = useMemo(() => {
    const grouped = claims.reduce<Record<string, number>>((acc, claim) => {
      const key = claim.admin_status || 'unknown';
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});

    return [
      { name: 'Pending Review', value: grouped.pending_review ?? 0 },
      { name: 'Approved', value: grouped.approved ?? 0 },
      { name: 'Rejected', value: grouped.rejected ?? 0 },
      { name: 'Needs More Info', value: grouped.needs_more_info ?? 0 },
    ].filter((entry) => entry.value > 0);
  }, [claims]);

  const damageChartData = useMemo(
    () =>
      claims
        .filter((claim) => typeof claim.latest_damage_percentage === 'number')
        .slice()
        .sort((left, right) => (right.latest_damage_percentage ?? 0) - (left.latest_damage_percentage ?? 0))
        .slice(0, 6)
        .map((claim) => ({
          label: `#${claim.claim_id}`,
          damage: claim.latest_damage_percentage ?? 0,
        })),
    [claims],
  );

  const adminStatusColors = ['#f59e0b', '#10b981', '#f43f5e', '#6366f1'];

  const refreshClaims = () => {
    setLastRefreshedAt(new Date().toLocaleTimeString());
    refetch();
  };

  useEffect(() => {
    setSelectedIds((prev) => {
      const next = prev.filter((id) => claims.some((item) => item.claim_id === id));
      if (next.length === prev.length && next.every((id, index) => id === prev[index])) {
        return prev;
      }
      return next;
    });
  }, [claims]);

  const availableCropTypes = useMemo(() => {
    const set = new Set<string>();
    claims.forEach((item) => set.add(item.crop_type));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [claims]);

  const getState = (claim: AdminClaim) =>
    reviewState[claim.claim_id] ?? {
      admin_status: (claim.admin_status as 'pending_review' | 'approved' | 'rejected' | 'needs_more_info') || 'pending_review',
      reviewed_by: claim.reviewed_by || 'Admin',
      admin_notes: '',
      recommended_insurance_amount: claim.recommended_insurance_amount?.toString() ?? '',
    };

  const submitReview = async (claim: AdminClaim) => {
    const state = getState(claim);
    setBusyClaimId(claim.claim_id);
    setMessage(null);
    try {
      await reviewAdminClaim(claim.claim_id, {
        admin_status: state.admin_status,
        reviewed_by: state.reviewed_by,
        admin_notes: state.admin_notes || undefined,
        recommended_insurance_amount: state.recommended_insurance_amount
          ? Number(state.recommended_insurance_amount)
          : undefined,
      });
      setMessage(`Review updated for logic stream #${claim.claim_id}`);
      refetch();
    } catch (err) {
      setMessage(`Failed review update for #${claim.claim_id}: ${String(err)}`);
    } finally {
      setBusyClaimId(null);
    }
  };

  const toggleExpand = async (claimId: number) => {
    if (expandedClaimId === claimId) {
      setExpandedClaimId(null);
      return;
    }

    setExpandedClaimId(claimId);
    if (expandedData[claimId]) {
      return;
    }

    setExpandedBusy(claimId);
    try {
      const full = await getAdminClaimFull(claimId);
      setExpandedData((prev) => ({ ...prev, [claimId]: full }));
      if (full.latest_analysis?.status === 'completed') {
        const artifacts = await getAnalysisArtifacts(claimId);
        setExpandedArtifacts((prev) => ({ ...prev, [claimId]: artifacts }));
      }
    } catch (err) {
      setMessage(`Transmission fault for #${claimId}: ${String(err)}`);
    } finally {
      setExpandedBusy(null);
    }
  };

  const runBulkAction = async (action: 'approved' | 'rejected') => {
    const nextErrors: { selected?: string; reviewedBy?: string } = {};
    if (selectedIds.length === 0) {
      nextErrors.selected = 'Select at least one active claim payload.';
    }
    if (!bulkReviewedBy.trim()) {
      nextErrors.reviewedBy = 'Authorizing agent name required.';
    }
    setBulkFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setMessage(null);
      return;
    }

    setBulkBusy(true);
    setMessage(null);
    try {
      const result = await bulkReviewAdminClaims({
        claim_ids: selectedIds,
        admin_status: action,
        reviewed_by: bulkReviewedBy.trim(),
        admin_notes: bulkNotes.trim() || undefined,
        recommended_insurance_amount: bulkAmount ? Number(bulkAmount) : undefined,
      });
      setMessage(`Multi-claim operation processed: ${result.updated_claim_ids.length} vectors sealed.`);
      setSelectedIds([]);
      refetch();
    } catch (err) {
      setMessage(`Multi-claim proxy failed: ${String(err)}`);
    } finally {
      setBulkBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 lg:gap-8 pb-12">
      {/* HEADER BANNER */}
      <div className="flex items-center justify-between rounded-xl bg-[#eef8f1] px-4 py-3 border border-[#7ddf92]/20 shadow-sm mb-2">
        <div className="flex items-center gap-2">
          <ShieldCheck className="text-primary w-5 h-5" />
          <span className="text-primary font-bold text-sm">Administrative Authority Layer</span>
        </div>
      </div>

      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl lg:text-4xl font-extrabold text-gray-900 tracking-tight">Supervision Panel</h1>
          <p className="text-sm text-gray-500 lg:text-base max-w-2xl">
            Query, audit, and finalize insurance settlement payload vectors.
          </p>
        </div>
        <button
          type="button"
          onClick={refreshClaims}
          className="flex items-center gap-2 bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 px-5 py-2.5 rounded-[16px] text-sm font-bold transition-all shadow-[0_4px_12px_rgba(0,0,0,0.02)]"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Force Sync
        </button>
      </header>
      
      {message && (
        <div className="rounded-[16px] border border-emerald-100 bg-emerald-50 px-5 py-4 flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
          <ShieldCheck className="w-5 h-5 text-emerald-600" />
          <p className="text-sm font-bold text-emerald-800">{message}</p>
        </div>
      )}
      
      {error ? <ErrorBanner message={error} onRetry={refetch} /> : null}

      {/* INTELLIGENCE GRAPHS */}
      <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-white rounded-[32px] p-6 lg:p-8 border border-gray-100 shadow-[0_8px_32px_rgba(31,52,38,0.06)] flex flex-col h-[400px]">
          <h2 className="text-lg lg:text-xl font-bold text-gray-900 flex items-center gap-2 mb-2">
            <PieChartIcon className="w-5 h-5 text-indigo-500" /> Local Decision Quota
          </h2>
          <p className="text-sm text-gray-500 mb-6">Aggregate evaluation states observed in current pagination.</p>
          
          <div className="h-[300px] w-full flex-1">
            {loading ? <div className="h-full animate-pulse rounded-2xl bg-gray-50 border dashed border-gray-200" /> : null}
            {!loading && adminStatusChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={adminStatusChartData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={70}
                    outerRadius={100}
                    paddingAngle={6}
                    cornerRadius={8}
                    stroke="none"
                  >
                    {adminStatusChartData.map((entry, index) => (
                      <Cell key={entry.name} fill={adminStatusColors[index % adminStatusColors.length]} />
                    ))}
                  </Pie>
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', fontWeight: 'bold', fill: '#64748b' }} />
                  <RechartsTooltip
                    cursor={{ fill: 'transparent' }}
                    contentStyle={{ borderRadius: 16, border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', fontWeight: 'bold' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : null}
            {!loading && adminStatusChartData.length === 0 ? (
              <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center bg-gray-50/50 border border-dashed border-gray-200 rounded-3xl">
                <span className="text-sm font-bold text-gray-400">Metrics Unavailable</span>
              </div>
            ) : null}
          </div>
        </div>

        <div className="bg-gradient-to-br from-[#1b241d] to-gray-800 rounded-[32px] p-6 lg:p-8 text-white shadow-[0_12px_32px_rgba(27,36,29,0.15)] flex flex-col relative overflow-hidden h-[400px]">
          <AlertCircle className="absolute -right-8 -top-8 w-48 h-48 text-white/5 pointer-events-none" />
          
          <h2 className="text-lg lg:text-xl font-bold text-white flex items-center gap-2 mb-2 relative z-10">
            <AlertTriangle className="w-5 h-5 text-amber-400" /> High-Risk Sectors
          </h2>
          <p className="text-sm text-gray-400 mb-6 relative z-10">Forensic satellite vectors returning severe damage topologies.</p>
          
          <div className="h-[300px] w-full flex-1 relative z-10">
            {loading ? <div className="h-full animate-pulse rounded-2xl bg-white/10" /> : null}
            {!loading && damageChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={damageChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 600 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 600 }} domain={[0, 100]} />
                  <RechartsTooltip
                    cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }}
                    contentStyle={{ borderRadius: 16, border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.5)', fontWeight: 'bold', background: '#fff', color: '#000' }}
                    formatter={(val: number) => [`${val.toFixed(1)}%`, 'Damage Index']}
                  />
                  <Bar dataKey="damage" fill="#10b981" radius={[12, 12, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            ) : null}
            {!loading && damageChartData.length === 0 ? (
              <div className="w-full h-full flex items-center justify-center border-2 border-dashed border-white/20 rounded-3xl">
                <span className="text-sm font-bold text-gray-400">Risk Vectors Offline</span>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      {/* FILTER BAY */}
      <section className="bg-white rounded-[24px] p-6 border border-gray-100 shadow-[0_4px_24px_rgba(31,52,38,0.04)] grid md:grid-cols-3 lg:grid-cols-6 gap-4">
        <select
          className="bg-gray-50 border border-gray-200 text-sm font-semibold rounded-[16px] px-4 py-3 focus:bg-white focus:ring-2 focus:ring-primary/20 outline-none transition-all shadow-sm appearance-none"
          value={adminStatus}
          onChange={(e) => setParams({ admin_status: e.target.value || null, page: 1 })}
        >
          <option value="">Status Filter: All</option>
          <option value="pending_review">Pending Review</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="needs_more_info">Needs Info</option>
        </select>

        <select
          className="bg-gray-50 border border-gray-200 text-sm font-semibold rounded-[16px] px-4 py-3 focus:bg-white focus:ring-2 focus:ring-primary/20 outline-none transition-all shadow-sm appearance-none"
          value={cropType}
          onChange={(e) => setParams({ crop_type: e.target.value || null, page: 1 })}
        >
          <option value="">Crop: Global</option>
          {availableCropTypes.map((item) => (
            <option key={item} value={item}>{item}</option>
          ))}
        </select>

        <select
          className="bg-gray-50 border border-gray-200 text-sm font-semibold rounded-[16px] px-4 py-3 focus:bg-white focus:ring-2 focus:ring-primary/20 outline-none transition-all shadow-sm appearance-none"
          value={status}
          onChange={(e) => setParams({ status: e.target.value || null, page: 1 })}
        >
          <option value="">Analysis Phase: All</option>
          <option value="created">Created</option>
          <option value="analysis_running">Matrix Running</option>
          <option value="analysis_completed">Matrix Competed</option>
          <option value="failed">Failed Sequence</option>
        </select>

        <input
          type="date"
          className="bg-gray-50 border border-gray-200 text-sm font-semibold rounded-[16px] px-4 py-3 focus:bg-white focus:ring-2 focus:ring-primary/20 outline-none transition-all shadow-sm"
          value={damageDateFrom}
          onChange={(e) => setParams({ damage_date_from: e.target.value || null, page: 1 })}
        />

        <input
          type="date"
          className="bg-gray-50 border border-gray-200 text-sm font-semibold rounded-[16px] px-4 py-3 focus:bg-white focus:ring-2 focus:ring-primary/20 outline-none transition-all shadow-sm"
          value={damageDateTo}
          onChange={(e) => setParams({ damage_date_to: e.target.value || null, page: 1 })}
        />

        <input
          className="bg-gray-50 border border-gray-200 text-sm font-semibold rounded-[16px] px-4 py-3 focus:bg-white focus:ring-2 focus:ring-primary/20 outline-none transition-all shadow-sm"
          placeholder="Lookup Operator/Crop..."
          value={search}
          onChange={(e) => setParams({ search: e.target.value || null, page: 1 })}
        />
      </section>

      {/* BATCH ENFORCEMENT */}
      <section className="bg-primary/5 rounded-[24px] p-6 border border-primary/20 grid md:grid-cols-4 gap-4 shadow-inner">
        <input
          className="bg-white border border-gray-200 text-sm font-semibold rounded-[16px] px-4 py-3 focus:bg-white focus:ring-2 focus:ring-primary/20 outline-none transition-all shadow-sm"
          placeholder="Signature ID (e.g. Admin12)"
          value={bulkReviewedBy}
          onChange={(e) => {
            setBulkReviewedBy(e.target.value);
            setBulkFieldErrors((prev) => ({ ...prev, reviewedBy: undefined }));
          }}
        />
        <input
          className="bg-white border border-gray-200 text-sm font-semibold rounded-[16px] px-4 py-3 focus:bg-white focus:ring-2 focus:ring-primary/20 outline-none transition-all shadow-sm"
          placeholder="Default Reimbursement (₹)"
          value={bulkAmount}
          onChange={(e) => setBulkAmount(e.target.value)}
        />
        <input
          className="bg-white border border-gray-200 text-sm font-semibold rounded-[16px] px-4 py-3 focus:bg-white focus:ring-2 focus:ring-primary/20 outline-none transition-all shadow-sm"
          placeholder="Override rationale..."
          value={bulkNotes}
          onChange={(e) => setBulkNotes(e.target.value)}
        />
        <div className="flex gap-2">
          <button
            type="button"
            className="flex-1 bg-[#1b241d] hover:bg-gray-800 text-white rounded-[16px] px-4 py-3 text-sm font-bold transition-all shadow-[0_4px_12px_rgba(27,36,29,0.15)] disabled:opacity-50"
            disabled={bulkBusy}
            onClick={() => runBulkAction('approved')}
          >
            Force Approval
          </button>
          <button
            type="button"
            className="rounded-[16px] border border-rose-200 bg-rose-50 hover:bg-rose-100 px-4 py-3 text-sm font-bold text-rose-700 transition-all shadow-sm disabled:opacity-50"
            disabled={bulkBusy}
            onClick={() => runBulkAction('rejected')}
          >
            Deny
          </button>
        </div>
        {bulkFieldErrors.selected ? <p className="col-span-4 text-xs font-bold text-rose-600 mt-[-4px]">{bulkFieldErrors.selected}</p> : null}
        {bulkFieldErrors.reviewedBy ? <p className="col-span-4 text-xs font-bold text-rose-600 mt-[-4px]">{bulkFieldErrors.reviewedBy}</p> : null}
      </section>

      {/* CORE TABLE */}
      <section className="bg-white rounded-[32px] border border-gray-100 shadow-[0_12px_40px_rgba(31,52,38,0.06)] overflow-hidden flex flex-col">
        <div className="px-6 lg:px-8 py-5 border-b border-gray-50">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-primary" /> Forensic Audits
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left min-w-[800px]">
            <thead>
              <tr className="bg-gray-50/50">
                <th className="px-6 lg:px-8 py-4 text-[11px] font-bold uppercase tracking-widest text-gray-400">Lock</th>
                <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest text-gray-400">Vector</th>
                <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest text-gray-400">Operator</th>
                <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest text-gray-400">Asset</th>
                <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest text-gray-400">Flag Status</th>
                <th className="px-6 lg:px-8 py-4 text-[11px] font-bold uppercase tracking-widest text-gray-400 text-right">Deep Dive</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center text-gray-400 font-bold text-sm">
                     Initializing secure protocol...
                  </td>
                </tr>
              ) : null}
              {!loading && claims.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center text-gray-400 font-bold text-sm">
                    No anomalies match defined heuristics.
                  </td>
                </tr>
              ) : null}
              {claims.map((claim) => {
                const state = getState(claim);
                const expanded = expandedClaimId === claim.claim_id;
                const detail = expandedData[claim.claim_id];
                const artifacts = expandedArtifacts[claim.claim_id];
                return (
                  <Fragment key={claim.claim_id}>
                    <tr className={`border-b border-gray-50 hover:bg-gray-50/30 transition-colors ${expanded ? 'bg-primary/[0.02]' : ''}`}>
                      <td className="px-6 lg:px-8 py-4">
                        <input
                          type="checkbox"
                          className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                          checked={selectedIds.includes(claim.claim_id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedIds((prev) => Array.from(new Set([...prev, claim.claim_id])));
                            } else {
                              setSelectedIds((prev) => prev.filter((item) => item !== claim.claim_id));
                            }
                          }}
                        />
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-[11px] font-mono font-bold text-gray-500 bg-gray-100 px-2 py-1 rounded-md">
                          #{claim.claim_id}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm font-bold text-gray-900">{claim.farmer_name}</td>
                      <td className="px-6 py-4">
                         <span className="px-3 py-1 rounded-full border border-gray-200 text-[11px] font-bold text-gray-700 bg-white shadow-sm flex items-center w-fit gap-1.5">
                           {claim.crop_type}
                         </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md whitespace-nowrap ${
                           claim.admin_status.toLowerCase().includes('reject') ? 'bg-rose-50 text-rose-600' :
                           claim.admin_status.toLowerCase().includes('approv') ? 'bg-emerald-50 text-emerald-600' : 
                           claim.admin_status.toLowerCase().includes('pending') ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-blue-600'
                        }`}>
                          {claim.admin_status.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-6 lg:px-8 py-4 text-right">
                        <button
                          type="button"
                          className={`inline-flex items-center gap-1.5 rounded-[12px] px-3 py-2 text-xs font-bold transition-all ${
                            expanded ? 'bg-primary/10 text-primary' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                          }`}
                          onClick={() => toggleExpand(claim.claim_id)}
                        >
                          Payload {expanded ? <ChevronUp size={14} strokeWidth={3} /> : <ChevronDown size={14} strokeWidth={3} />}
                        </button>
                      </td>
                    </tr>
                    
                    {expanded ? (
                      <tr className="border-b-2 border-primary/20 bg-primary/[0.03]">
                        <td colSpan={6} className="px-6 lg:px-8 py-6">
                          {expandedBusy === claim.claim_id ? (
                            <div className="flex items-center justify-center p-8 gap-3">
                              <RefreshCw className="w-5 h-5 text-primary animate-spin" />
                              <p className="text-sm font-bold text-gray-500">Decrypting satellite artifacts...</p>
                            </div>
                          ) : (
                            <div className="grid lg:grid-cols-2 gap-8">
                              
                              {/* LEFT COLUMN: CONTEXT */}
                              <div className="space-y-6">
                                <div className="bg-white rounded-[24px] border border-gray-100 p-5 shadow-sm">
                                  <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3">Event Telemetry</h3>
                                  <div className="grid grid-cols-2 gap-y-4 text-sm font-medium text-gray-800">
                                    <div><span className="text-gray-400 block text-xs">Event Date:</span> {claim.damage_date}</div>
                                    <div>
                                      <span className="text-gray-400 block text-xs">Lifecycle State:</span> 
                                      <span className="text-primary font-bold">{claim.status.replace(/_/g, ' ')}</span>
                                    </div>
                                    <div>
                                      <span className="text-gray-400 block text-xs">Damage Surface Area:</span> 
                                      <span className="text-amber-600 font-extrabold">{claim.latest_damage_percentage?.toFixed(1) ?? 'N/A'}%</span>
                                    </div>
                                    <div>
                                      <span className="text-gray-400 block text-xs">Model Consensus:</span> 
                                      {claim.latest_ai_damage_probability?.toFixed(2) ?? 'N/A'}
                                    </div>
                                  </div>
                                </div>

                                {claim.polygon && claim.polygon.length >= 3 ? (
                                  <div className="bg-white rounded-[24px] border border-gray-100 p-2 shadow-sm overflow-hidden">
                                     <FarmBoundaryMap polygon={claim.polygon} center={[claim.polygon[0][0], claim.polygon[0][1]]} height={200} />
                                  </div>
                                ) : null}

                                {detail?.farmer_notes ? (
                                  <div className="bg-white rounded-[24px] border border-amber-100 p-5 shadow-sm">
                                    <h3 className="text-[11px] font-bold text-amber-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                                      <AlertTriangle className="w-3.5 h-3.5" /> Operator Testimony
                                    </h3>
                                    <p className="text-sm font-medium text-gray-800">{detail.farmer_notes}</p>
                                  </div>
                                ) : null}

                                <div className="bg-white rounded-[24px] border border-gray-100 p-5 shadow-sm">
                                  <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3">Chain of Custody</h3>
                                  {detail?.audit_logs?.length ? (
                                    <div className="space-y-3">
                                      {detail.audit_logs.slice(0, 4).map((log) => (
                                        <div key={log.id} className="text-xs font-medium text-gray-600 flex items-start gap-3">
                                          <div className="w-2 h-2 rounded-full bg-primary/40 mt-1" />
                                          <div>
                                            <span className="text-gray-400 block text-[10px] mb-0.5">{new Date(log.created_at).toLocaleString()}</span>
                                            <span className="font-bold text-gray-900">{log.actor}</span> altered baseline from <span className="text-rose-500">{log.old_status?.replace(/_/g, ' ') || 'null'}</span> to <span className="text-emerald-500">{log.new_status?.replace(/_/g, ' ') || 'null'}</span>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <p className="text-sm font-medium text-gray-400">Ledger is empty.</p>
                                  )}
                                </div>
                              </div>

                              {/* RIGHT COLUMN: ACTION & METRICS */}
                              <div className="space-y-6">
                                {detail?.latest_analysis?.decision ? (
                                  <div className="bg-[#1b241d] rounded-[24px] border border-gray-800 p-6 shadow-sm text-white">
                                    <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                      <TrendingUp className="w-4 h-4 text-emerald-500" /> Synthesized Outcome
                                    </h3>
                                    <p className="text-lg font-bold mb-4">{detail.latest_analysis.decision.decision}</p>
                                    
                                    <div className="mb-1 flexjustify-between text-xs font-bold text-gray-400 uppercase tracking-widest">
                                       <span className="text-emerald-400">Integrity Rating</span>
                                    </div>
                                    <div className="h-2.5 rounded-full bg-white/10 overflow-hidden mb-2">
                                      <div
                                        className="h-full bg-emerald-500 rounded-full"
                                        style={{ width: `${Math.min(100, Math.max(0, detail.latest_analysis.decision.confidence * 100))}%` }}
                                      />
                                    </div>
                                    <p className="text-sm font-extrabold text-white">
                                      {(detail.latest_analysis.decision.confidence * 100).toFixed(1)}% Confidence
                                    </p>
                                  </div>
                                ) : null}

                                {detail?.latest_analysis?.metrics ? (
                                  <div className="bg-white rounded-[24px] border border-gray-100 p-5 shadow-sm">
                                    <h3 className="text-[11px] font-bold text-blue-500 uppercase tracking-widest mb-3">Topographical Scans (Before / After)</h3>
                                    <div className="grid grid-cols-3 gap-2">
                                       <div className="bg-gray-50 rounded-xl p-3 text-center">
                                         <p className="text-[10px] font-bold text-gray-400 uppercase">NDVI</p>
                                         <p className="text-sm font-bold text-gray-900 line-through text-gray-400">{detail.latest_analysis.metrics.ndvi_before.toFixed(2)}</p>
                                         <p className="text-base font-extrabold text-blue-600">{detail.latest_analysis.metrics.ndvi_after.toFixed(2)}</p>
                                       </div>
                                       <div className="bg-gray-50 rounded-xl p-3 text-center">
                                         <p className="text-[10px] font-bold text-gray-400 uppercase">NDWI</p>
                                         <p className="text-sm font-bold text-gray-900 line-through text-gray-400">{detail.latest_analysis.metrics.ndwi_before.toFixed(2)}</p>
                                         <p className="text-base font-extrabold text-blue-600">{detail.latest_analysis.metrics.ndwi_after.toFixed(2)}</p>
                                       </div>
                                       <div className="bg-gray-50 rounded-xl p-3 text-center">
                                         <p className="text-[10px] font-bold text-gray-400 uppercase">EVI</p>
                                         <p className="text-sm font-bold text-gray-900 line-through text-gray-400">{detail.latest_analysis.metrics.evi_before.toFixed(2)}</p>
                                         <p className="text-base font-extrabold text-blue-600">{detail.latest_analysis.metrics.evi_after.toFixed(2)}</p>
                                       </div>
                                    </div>
                                  </div>
                                ) : null}

                                {artifacts ? (
                                  <div className="bg-white rounded-[24px] border border-gray-100 p-4 shadow-sm">
                                    <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3 px-2">Visual Packets</h3>
                                    <div className="grid grid-cols-4 gap-2">
                                      {[
                                        artifacts.before_rgb_data_url,
                                        artifacts.after_rgb_data_url,
                                        artifacts.ndvi_before_data_url,
                                        artifacts.ndvi_after_data_url,
                                        artifacts.ndwi_before_data_url,
                                        artifacts.ndwi_after_data_url,
                                        artifacts.evi_before_data_url,
                                        artifacts.evi_after_data_url,
                                      ].map((src, index) => (
                                        <Image
                                          key={`${claim.claim_id}-${index}`}
                                          src={src}
                                          alt={`Artifact ${index + 1}`}
                                          width={320}
                                          height={220}
                                          unoptimized
                                          className="h-16 object-cover w-full rounded-xl border border-gray-100 hover:scale-[2] hover:z-50 transition-transform origin-center shadow-sm"
                                        />
                                      ))}
                                    </div>
                                  </div>
                                ) : null}

                                {/* SUPERVISION OVERRIDE PANEL */}
                                <div className="bg-white rounded-[24px] border border-primary/20 p-6 shadow-[0_8px_32px_rgba(47,133,90,0.06)] flex flex-col gap-4">
                                  <h3 className="text-[11px] font-bold text-primary uppercase tracking-widest flex items-center gap-2">
                                    <ShieldCheck className="w-4 h-4" /> Final Logic Override
                                  </h3>
                                  
                                  <div className="grid grid-cols-2 gap-3">
                                    <label className="flex flex-col gap-1.5">
                                      <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider pl-1">Final Status Matrix</span>
                                      <select
                                        className="bg-gray-50 border border-gray-200 text-sm font-semibold rounded-xl px-3 py-2.5 outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                                        value={state.admin_status}
                                        onChange={(e) =>
                                          setReviewState((prev) => ({
                                            ...prev,
                                            [claim.claim_id]: { ...state, admin_status: e.target.value as typeof state.admin_status },
                                          }))
                                        }
                                      >
                                        <option value="pending_review">Pending Review</option>
                                        <option value="approved">Approved</option>
                                        <option value="rejected">Rejected</option>
                                        <option value="needs_more_info">Needs More Info</option>
                                      </select>
                                    </label>
                                    
                                    <label className="flex flex-col gap-1.5">
                                      <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider pl-1">Authorized By</span>
                                      <input
                                        className="bg-gray-50 border border-gray-200 text-sm font-semibold rounded-xl px-3 py-2.5 outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                                        placeholder="Admin Signature"
                                        value={state.reviewed_by}
                                        onChange={(e) =>
                                          setReviewState((prev) => ({
                                            ...prev,
                                            [claim.claim_id]: { ...state, reviewed_by: e.target.value },
                                          }))
                                        }
                                      />
                                    </label>
                                  </div>

                                  <label className="flex flex-col gap-1.5">
                                      <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider pl-1">Settlement Baseline Override (₹)</span>
                                      <input
                                        className="bg-gray-50 border border-gray-200 text-sm font-semibold rounded-xl px-3 py-2.5 outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                                        placeholder="e.g. 50000"
                                        value={state.recommended_insurance_amount}
                                        onChange={(e) =>
                                          setReviewState((prev) => ({
                                            ...prev,
                                            [claim.claim_id]: { ...state, recommended_insurance_amount: e.target.value },
                                          }))
                                        }
                                      />
                                  </label>

                                  <label className="flex flex-col gap-1.5">
                                      <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider pl-1">Internal Remarks Document</span>
                                      <textarea
                                        className="bg-gray-50 border border-gray-200 text-sm font-medium rounded-xl px-3 py-2.5 outline-none focus:border-primary focus:ring-1 focus:ring-primary resize-none"
                                        rows={3}
                                        placeholder="Note justification for overrides..."
                                        value={state.admin_notes}
                                        onChange={(e) =>
                                          setReviewState((prev) => ({
                                            ...prev,
                                            [claim.claim_id]: { ...state, admin_notes: e.target.value },
                                          }))
                                        }
                                      />
                                  </label>
                                  
                                  <div className="flex items-center gap-3 mt-2">
                                     <a
                                       href="#"
                                       className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 py-3 text-sm font-extrabold transition-colors"
                                       onClick={async (event) => {
                                         event.preventDefault();
                                         try {
                                           await downloadAdminReportPdf(claim.claim_id);
                                         } catch (err) {
                                           setMessage(`Download restricted on #${claim.claim_id}: ${String(err)}`);
                                         }
                                       }}
                                     >
                                       <Download size={14} /> Fetch Dossier
                                     </a>
                                     <button
                                       type="button"
                                       className="flex-[2] flex items-center justify-center gap-2 rounded-xl bg-[#1b241d] hover:bg-gray-800 text-white py-3 text-sm font-extrabold transition-all shadow-[0_4px_12px_rgba(27,36,29,0.15)] disabled:opacity-60"
                                       onClick={() => submitReview(claim)}
                                       disabled={busyClaimId === claim.claim_id}
                                     >
                                       {busyClaimId === claim.claim_id ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />}
                                       Execute Directive
                                     </button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 text-xs font-bold text-gray-500 uppercase tracking-widest bg-gray-50/50">
          <p>Displaying Set of {totalCount}</p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="rounded-lg border border-gray-200 bg-white hover:bg-gray-50 px-3 py-1.5 transition-all disabled:opacity-40 shadow-sm"
              disabled={!hasPrev}
              onClick={() => setParams({ page: page - 1 })}
            >
              Prev
            </button>
            <span className="text-gray-900 border border-gray-200 bg-white px-3 py-1.5 rounded-lg shadow-sm">Log {page}</span>
            <button
              type="button"
              className="rounded-lg border border-gray-200 bg-white hover:bg-gray-50 px-3 py-1.5 transition-all disabled:opacity-40 shadow-sm"
              disabled={!hasNext}
              onClick={() => setParams({ page: page + 1 })}
            >
              Next
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
