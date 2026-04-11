'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Activity, ExternalLink, RefreshCw, ShieldCheck, TriangleAlert, Database, Search, FileText } from 'lucide-react';
import ErrorBanner from '@/components/ErrorBanner';
import { useClaims, useDashboardSummary } from '@/hooks/useApi';

function MetricCard(props: { title: string; value: string; subtitle: string; icon: React.ElementType; loading?: boolean }) {
  const Icon = props.icon;
  return (
    <div className="bg-white rounded-[24px] p-6 border border-gray-100 shadow-[0_4px_24px_rgba(31,52,38,0.04)] hover:-translate-y-1 transition-transform relative overflow-hidden group">
      <div className="flex items-center justify-between mb-4 relative z-10">
        <p className="text-[11px] font-bold tracking-widest text-gray-400 uppercase">{props.title}</p>
        <span className="w-10 h-10 rounded-[16px] bg-primary/10 text-primary flex items-center justify-center group-hover:scale-110 transition-transform">
          <Icon size={18} strokeWidth={2.5} />
        </span>
      </div>
      {props.loading ? (
        <div className="mb-2 h-9 w-28 animate-pulse rounded-lg bg-gray-100 relative z-10" />
      ) : (
        <p className="text-3xl font-extrabold text-gray-900 mb-1 relative z-10">{props.value}</p>
      )}
      <p className="text-[11px] font-bold text-gray-400 relative z-10">{props.subtitle}</p>
      <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-primary/[0.03] rounded-full blur-[20px] pointer-events-none" />
    </div>
  );
}

function formatDateTime(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
}

export default function AnalysisPage() {
  const summaryQuery = useDashboardSummary();
  const claimsQuery = useClaims({ limit: 100, offset: 0 });
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string | null>(null);

  const loading = summaryQuery.loading || claimsQuery.loading;
  const claims = claimsQuery.data?.items ?? [];
  const totalClaims = summaryQuery.data?.total_claims ?? claims.length;
  const approvedClaims = summaryQuery.data?.approved_claims ?? 0;
  const avgDamage = summaryQuery.data?.average_damage_percentage ?? 0;
  const avgConfidence = summaryQuery.data?.average_decision_confidence ?? 0;

  const analysisCompleted = claims.filter((item) => item.status === 'analysis_completed').length;
  const pendingReview = claims.filter((item) => item.admin_status === 'pending_review').length;
  const needsAttention = claims.filter(
    (item) => item.status === 'failed' || item.admin_status === 'needs_more_info',
  ).length;
  const completionRate = totalClaims > 0 ? (analysisCompleted / totalClaims) * 100 : 0;

  const allClaims = [...claims]
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

  const refreshAll = () => {
    setLastRefreshedAt(new Date().toLocaleTimeString());
    summaryQuery.refetch();
    claimsQuery.refetch();
  };

  return (
    <div className="flex flex-col gap-6 lg:gap-8 pb-12">
      {/* HEADER BANNER */}
      <div className="flex items-center justify-between rounded-xl bg-[#eef8f1] px-4 py-3 border border-[#7ddf92]/20 shadow-sm mb-2">
        <div className="flex items-center gap-2">
          <Database className="text-primary w-5 h-5" />
          <span className="text-primary font-bold text-sm">Administrative Override Console</span>
        </div>
      </div>

      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl lg:text-4xl font-extrabold text-gray-900 tracking-tight">Analysis Operations</h1>
          <p className="text-sm text-gray-500 lg:text-base max-w-2xl">
            Satellite-driven risk indicators, aggregate model progress, and absolute claim verification.
          </p>
        </div>
        <button
          type="button"
          onClick={refreshAll}
          className="flex items-center gap-2 bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 px-5 py-2.5 rounded-[16px] text-sm font-bold transition-all shadow-[0_4px_12px_rgba(0,0,0,0.02)]"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh Registry
        </button>
      </div>

      {summaryQuery.error || claimsQuery.error ? (
        <ErrorBanner
          message={`${summaryQuery.error ? `Registry fault: ${summaryQuery.error}` : ''}${summaryQuery.error && claimsQuery.error ? ' | ' : ''}${claimsQuery.error ? `Verification failure: ${claimsQuery.error}` : ''}`}
          onRetry={refreshAll}
        />
      ) : null}

      {/* CORE METRICS ROW */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <MetricCard
          title="Total Claims"
          value={String(totalClaims)}
          subtitle="Tracked vectors in system"
          icon={Activity}
          loading={loading}
        />
        <MetricCard
          title="Avg Damage"
          value={`${avgDamage.toFixed(1)}%`}
          subtitle="Mean estimated crop impact"
          icon={TriangleAlert}
          loading={loading}
        />
        <MetricCard
          title="Approved Claims"
          value={String(approvedClaims)}
          subtitle="Resolved outcomes"
          icon={ShieldCheck}
          loading={loading}
        />
        <MetricCard
          title="Avg Confidence"
          value={`${(avgConfidence * 100).toFixed(1)}%`}
          subtitle="Prediction logic integrity"
          icon={ShieldCheck}
          loading={loading}
        />
      </section>

      {/* PIPELINE METRICS */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-[32px] p-6 border border-gray-100 shadow-[0_8px_32px_rgba(31,52,38,0.06)] flex flex-col justify-center items-center text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-[40px] pointer-events-none" />
          <p className="text-[11px] uppercase tracking-widest text-gray-400 font-bold mb-3 relative z-10">AI Pipeline Completed</p>
          <p className="text-5xl font-extrabold text-gray-900 mb-2 relative z-10">{analysisCompleted}</p>
          <div className="flex items-center gap-2 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100 relative z-10">
             <Activity className="w-3 h-3 text-emerald-600" />
             <p className="text-[10px] font-bold text-emerald-700">{completionRate.toFixed(1)}% Completion Rate</p>
          </div>
        </div>
        
        <div className="bg-white rounded-[32px] p-6 border border-gray-100 shadow-[0_8px_32px_rgba(31,52,38,0.06)] flex flex-col justify-center items-center text-center relative overflow-hidden">
          <p className="text-[11px] uppercase tracking-widest text-amber-500/80 font-bold mb-3 relative z-10">Awaiting Signature</p>
          <p className="text-5xl font-extrabold text-gray-900 mb-2 relative z-10">{pendingReview}</p>
          <p className="text-[11px] font-bold text-gray-400 relative z-10">Requires human administrator approval</p>
        </div>

        <div className="bg-white rounded-[32px] p-6 border border-rose-100 shadow-[0_8px_32px_rgba(244,63,94,0.06)] flex flex-col justify-center items-center text-center relative overflow-hidden">
           <div className="absolute top-0 left-0 w-32 h-32 bg-rose-500/5 rounded-full blur-[40px] pointer-events-none" />
          <p className="text-[11px] uppercase tracking-widest text-rose-500/80 font-bold mb-3 relative z-10">Critical Blockers</p>
          <p className="text-5xl font-extrabold text-rose-600 mb-2 relative z-10">{needsAttention}</p>
          <p className="text-[11px] font-bold text-rose-500/70 relative z-10">Missing telemetrics or model failure</p>
        </div>
      </section>

      {/* ADMIN CLAIMS REGISTRY */}
      <section className="bg-white rounded-[32px] border border-gray-100 shadow-[0_12px_40px_rgba(31,52,38,0.06)] overflow-hidden flex flex-col">
        <div className="px-6 lg:px-8 py-6 border-b border-gray-50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg lg:text-xl font-bold text-gray-900 flex items-center gap-2 mb-1">
              <FileText className="w-5 h-5 text-gray-400" /> Master Claim Registry
            </h2>
            <p className="text-xs font-medium text-gray-500">Unfiltered administrative view of all historical and active claims.</p>
          </div>
          
          <Link href="/admin" className="flex items-center gap-2 bg-gray-50 hover:bg-gray-100 text-gray-700 px-4 py-2 rounded-xl text-sm font-bold transition-all border border-gray-200 self-start sm:self-auto">
             <Search className="w-4 h-4" /> Full Explorer
          </Link>
        </div>

        <div className="overflow-x-auto w-full">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-gray-50/50">
                <th className="px-6 lg:px-8 py-4 text-[11px] uppercase tracking-widest text-gray-400 font-bold">Claim ID</th>
                <th className="px-6 py-4 text-[11px] uppercase tracking-widest text-gray-400 font-bold">Operator</th>
                <th className="px-6 py-4 text-[11px] uppercase tracking-widest text-gray-400 font-bold">Asset Type</th>
                <th className="px-6 py-4 text-[11px] uppercase tracking-widest text-gray-400 font-bold">Model Status</th>
                <th className="px-6 py-4 text-[11px] uppercase tracking-widest text-gray-400 font-bold">Admin Status</th>
                <th className="px-6 py-4 text-[11px] uppercase tracking-widest text-gray-400 font-bold">Last Synchronized</th>
                <th className="px-6 lg:px-8 py-4 text-[11px] uppercase tracking-widest text-gray-400 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <RefreshCw className="w-8 h-8 text-gray-200 animate-spin" />
                      <p className="text-sm font-bold text-gray-400">Loading Registry Matrix...</p>
                    </div>
                  </td>
                </tr>
              ) : null}
              
              {!loading && allClaims.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <Database className="w-8 h-8 text-gray-200" />
                      <p className="text-sm font-bold text-gray-400">Registry Empty</p>
                      <p className="text-xs text-gray-400">No active assets registered in the network.</p>
                    </div>
                  </td>
                </tr>
              ) : null}

              {allClaims.map((claim) => (
                <tr key={claim.id} className="border-b border-gray-50 hover:bg-gray-50/30 transition-colors group">
                  <td className="px-6 lg:px-8 py-4">
                    <span className="text-[11px] font-mono font-bold text-gray-500 bg-gray-100 px-2 py-1 rounded-md">
                      #{claim.id}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm font-bold text-gray-900">{claim.farmer_name}</td>
                  <td className="px-6 py-4">
                    <span className="px-3 py-1 rounded-full border border-gray-200 text-xs font-bold text-gray-700 bg-white shadow-sm flex items-center w-fit gap-1.5">
                      {claim.crop_type}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md whitespace-nowrap ${
                      claim.status.toLowerCase().includes('fail') ? 'bg-rose-50 text-rose-600' :
                      claim.status.toLowerCase().includes('complet') ? 'bg-primary/10 text-primary' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {claim.status.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md whitespace-nowrap ${
                      claim.admin_status.toLowerCase().includes('reject') ? 'bg-rose-50 text-rose-600' :
                      claim.admin_status.toLowerCase().includes('approv') ? 'bg-primary/10 text-primary' : 
                      claim.admin_status.toLowerCase().includes('pending') ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-blue-600'
                    }`}>
                      {claim.admin_status.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-[11px] font-medium text-gray-500">{formatDateTime(claim.updated_at)}</td>
                  <td className="px-6 lg:px-8 py-4 text-right">
                    <Link
                      href={`/analysis/${claim.id}`}
                      className="inline-flex items-center gap-1 text-[11px] font-extrabold uppercase tracking-widest text-primary hover:text-[#1b241d] hover:bg-primary/5 px-3 py-2 rounded-xl transition-all"
                    >
                      Inspect <ExternalLink size={12} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
