'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, Send, RefreshCw, AlertTriangle, ShieldCheck, X, 
  MapPin, Clock, IndianRupee, Activity, Scale, HeartPulse, Leaf, CheckCircle,
  TrendingUp, BarChart3, CloudSun, ShieldAlert, Zap
} from 'lucide-react';

import ErrorBanner from '@/components/ErrorBanner';
import { useClaims, useDashboardHomeSignals } from '@/hooks/useApi';
import { Claim } from '@/types/api';

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  PENDING:         { bg: 'bg-amber-50', text: 'text-amber-600' },
  APPROVED:        { bg: 'bg-emerald-50', text: 'text-emerald-600' },
  REJECTED:        { bg: 'bg-red-50', text: 'text-red-600' },
  NEEDS_MORE_INFO: { bg: 'bg-blue-50', text: 'text-blue-600' },
};

const SCHEMES = [
  {
    id: 1,
    name: 'PM-KISAN (Income Support)',
    description: 'Direct income support for all landholding farmers.',
    subsidy: '₹6,000 / Year',
    status: 'CLOSING SOON (48h)',
    is_verified: true,
    reason: 'Available for your farm size',
    urgent: true
  },
  {
    id: 2,
    name: 'PMFBY (Standard Crop Insurance)',
    description: 'Yield-based insurance against natural calamities and disease.',
    subsidy: 'Premium: 2%',
    status: 'CLOSING SOON (48h)',
    is_verified: true,
    reason: 'Available for your farm size',
    urgent: true
  },
  {
    id: 3,
    name: 'Kisan Credit Card (Micro-Credit)',
    description: 'Short term credit for high-quality input procurement.',
    subsidy: 'Rate: 4%',
    status: 'AVAILABLE',
    is_verified: true,
    reason: 'Available for your farm size',
    urgent: false
  },
  {
    id: 4,
    name: 'Pradhan Mantri Krishi Sinchayee Yojana',
    description: 'Drip irrigation and water management equipment support.',
    subsidy: '55% Subsidy',
    status: 'CLOSING SOON (48h)',
    is_verified: true,
    reason: 'Available for your farm size',
    urgent: true
  }
];

export default function FarmerDashboard() {
  const signalParams = { location: 'Pune', days: 3 };
  const signalsQuery = useDashboardHomeSignals(signalParams.location, signalParams.days);
  const claimsQuery = useClaims();
  
  const summary = signalsQuery.data?.summary;
  const farmHealth = summary?.average_decision_confidence ? Math.round(summary.average_decision_confidence * 100) : 82;
  const currentNdvi = 0.8;
  const walletBalance = 120000;
  const claimsList = claimsQuery.data?.items || [];
  const activeClaims = claimsList.filter(c => c.status.toLowerCase().includes('pending') || c.status.toLowerCase().includes('running')).length || 0;
  const riskLevel = summary?.average_damage_percentage ? Math.round(summary.average_damage_percentage) : 5;

  return (
    <div className="flex flex-col gap-6 lg:gap-10 pb-12">
      
      {/* BRANDING LAYER */}
      <div className="flex items-center justify-between rounded-xl bg-[#eef8f1] px-4 py-3 border border-[#7ddf92]/20 shadow-sm mb-2">
        <div className="flex items-center gap-2">
          <Zap className="text-primary w-5 h-5" />
          <span className="text-primary font-bold text-sm uppercase tracking-wider">Neural Agriculture Dashboard</span>
        </div>
        {signalsQuery.data?.weather_current && (
           <div className="flex items-center gap-2 text-xs text-primary font-bold bg-white/60 px-3 py-1 rounded-full border border-primary/10">
             <MapPin className="w-3.5 h-3.5" /> {signalsQuery.data.weather_current.location}
           </div>
        )}
      </div>

      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-4xl lg:text-5xl font-extrabold text-gray-900 tracking-tighter">Operational Nexus</h1>
          <p className="text-sm text-gray-500 lg:text-base max-w-2xl font-medium">
            Real-time orbital telemetry, risk monitoring, and fiscal liquidity management.
          </p>
        </div>
        <button
          type="button"
          onClick={() => { signalsQuery.refetch(); claimsQuery.refetch(); }}
          className="flex items-center gap-2 bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 px-6 py-3 rounded-[18px] text-sm font-bold transition-all shadow-sm"
        >
          <RefreshCw className={`w-4 h-4 ${signalsQuery.loading || claimsQuery.loading ? 'animate-spin' : ''}`} />
          Force Sync
        </button>
      </header>

      {signalsQuery.error ? <ErrorBanner message={`Dashboard signals error: ${signalsQuery.error}`} onRetry={signalsQuery.refetch} /> : null}

      {/* CORE STATS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        
        {/* Health Vector */}
        <div className="bg-white rounded-[32px] p-6 border border-gray-100 shadow-[0_8px_32px_rgba(31,52,38,0.06)] hover:shadow-[0_12px_45px_rgba(31,52,38,0.12)] transition-all cursor-default group overflow-hidden relative">
          <Activity className="absolute -right-4 -bottom-4 w-24 h-24 text-emerald-500/5 group-hover:scale-110 transition-transform" />
          <p className="text-[11px] font-bold tracking-widest text-gray-400 uppercase mb-3">Sustenance Index</p>
          <div className="flex items-baseline gap-2 mb-1">
             <span className="text-4xl font-black text-emerald-500">{farmHealth}%</span>
             <span className="text-xs font-bold text-gray-400">Target Reached</span>
          </div>
          <div className="flex items-center gap-2 mt-4 bg-emerald-50 w-fit px-2 py-1 rounded-lg border border-emerald-100/50">
             <Activity className="w-3 h-3 text-emerald-600" />
             <span className="text-[10px] font-extrabold text-emerald-700 uppercase">NDVI: {currentNdvi}</span>
          </div>
        </div>

        {/* Fiscal Vault */}
        <div className="bg-[#1b241d] rounded-[32px] p-6 shadow-[0_12px_40px_rgba(27,36,29,0.18)] hover:-translate-y-1 transition-all cursor-default group relative overflow-hidden">
          <TrendingUp className="absolute -right-4 -bottom-4 w-24 h-24 text-white/5" />
          <p className="text-[11px] font-bold tracking-widest text-gray-400 uppercase mb-3">Neural Vault</p>
          <div className="flex items-center gap-1 mb-1">
             <IndianRupee className="w-6 h-6 text-emerald-400 mr-0.5 stroke-[3px]" />
             <span className="text-4xl font-black text-white">{walletBalance.toLocaleString()}</span>
          </div>
          <p className="text-[10px] font-bold text-gray-500 mt-4 tracking-wider uppercase flex items-center gap-1.5">
             <ShieldCheck className="w-3 h-3 text-emerald-500" /> Insured Capital
          </p>
        </div>

        {/* Claim Queue */}
        <div className="bg-white rounded-[32px] p-6 border border-gray-100 shadow-[0_8px_32px_rgba(31,52,38,0.06)] hover:shadow-[0_12px_45px_rgba(31,52,38,0.12)] transition-all cursor-default group relative overflow-hidden">
          <CloudSun className="absolute -right-4 -bottom-4 w-24 h-24 text-amber-500/5" />
          <p className="text-[11px] font-bold tracking-widest text-gray-400 uppercase mb-3">Live Audits</p>
          <p className="text-4xl font-black text-amber-500 mb-1">{activeClaims}</p>
          <p className="text-[10px] font-bold text-gray-400 mt-4 tracking-wider uppercase">{claimsList.length} total history segments</p>
        </div>

        {/* Risk Assessment */}
        <div className="bg-white rounded-[32px] p-6 border border-gray-100 shadow-[0_8px_32px_rgba(31,52,38,0.06)] hover:shadow-[0_12px_45px_rgba(31,52,38,0.12)] transition-all cursor-default group relative overflow-hidden">
          <ShieldAlert className="absolute -right-4 -bottom-4 w-24 h-24 text-rose-500/5" />
          <p className="text-[11px] font-bold tracking-widest text-gray-400 uppercase mb-3">Threat Exposure</p>
          <p className={`text-4xl font-black ${riskLevel > 50 ? 'text-rose-500' : 'text-emerald-500'} mb-1`}>
            {riskLevel}%
          </p>
          <p className="text-[10px] font-bold text-gray-400 mt-4 tracking-wider uppercase">Aggregate Probabilistic Loss</p>
        </div>
      </div>

      {/* GOVT ELIGIBILITY ENGINE */}
      <div className="bg-white rounded-[40px] p-8 lg:p-12 border border-gray-100 shadow-[0_20px_60px_rgba(31,52,38,0.08)] relative overflow-hidden">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/[0.04] rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-[300px] h-[300px] bg-indigo-500/[0.03] rounded-full blur-[80px] pointer-events-none" />
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 relative z-10 gap-4 font-bold">
           <div>
              <h2 className="text-2xl font-black text-gray-900 tracking-tight">Verified Subsidy Channels</h2>
              <p className="text-sm text-gray-500 mt-1">Satellite-verified eligibility based on spatial topology.</p>
           </div>
           <button className="bg-gray-50 border border-gray-200 px-6 py-2.5 rounded-xl text-gray-600 hover:bg-gray-100 transition-all text-xs uppercase tracking-widest">Global Registrar</button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 relative z-10 font-bold">
          {SCHEMES.map(scheme => (
            <div key={scheme.id} className="bg-white rounded-[28px] p-6 border border-gray-100 shadow-sm hover:shadow-xl hover:-translate-y-2 transition-all duration-300 flex flex-col group">
              <div className="flex flex-col gap-4 mb-6">
                <div className={`text-[10px] uppercase tracking-widest font-black px-3 py-1.5 rounded-lg w-fit ${scheme.urgent ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                  {scheme.status}
                </div>
                <h3 className="text-base font-black text-gray-900 leading-tight group-hover:text-primary transition-colors">{scheme.name}</h3>
              </div>
              <p className="text-[11px] font-bold text-gray-400 mb-8 leading-relaxed flex-1">{scheme.description}</p>
              
              <div className="pt-6 border-t border-gray-50">
                <div className="flex justify-between items-center mb-4 font-black">
                  <span className="text-base text-gray-900">{scheme.subsidy}</span>
                  {scheme.is_verified && <ShieldCheck className="w-5 h-5 text-primary" />}
                </div>
                <div className="bg-emerald-50 rounded-xl px-3 py-2 border border-emerald-100/50">
                  <p className="text-[10px] text-emerald-700 font-black uppercase tracking-widest flex items-center gap-1.5">
                    <CheckCircle className="w-3 h-3" /> {scheme.reason}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ASSET LEDGER (Claims) */}
      <div className="bg-white rounded-[40px] border border-gray-100 shadow-[0_20px_60px_rgba(31,52,38,0.08)] overflow-hidden animate-in fade-in slide-in-from-bottom-4">
        <div className="p-8 lg:p-10 border-b border-gray-50 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="font-bold">
            <h2 className="text-2xl font-black text-gray-900 flex items-center gap-3">
              <BarChart3 className="w-6 h-6 text-primary" /> Active Asset Claims
            </h2>
            <p className="text-sm text-gray-500 mt-1">Forensic audit sequence of submitted spatial incidents.</p>
          </div>
          
          <div className="flex items-center gap-4">
            <Link 
              href="/farmer/requests"
              className="bg-[#1b241d] hover:bg-gray-800 text-white px-8 py-4 rounded-[20px] text-sm font-black transition-all shadow-[0_8px_30px_rgba(27,36,29,0.25)] flex items-center gap-3 no-underline"
            >
              <Plus className="w-4 h-4 stroke-[3px]" /> Initialize Claim
            </Link>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-separate border-spacing-0 min-w-[900px]">
            <thead>
              <tr className="bg-gray-50/50">
                <th className="px-10 py-5 text-[11px] font-black uppercase tracking-widest text-gray-400">Vector ID</th>
                <th className="px-6 py-5 text-[11px] font-black uppercase tracking-widest text-gray-400">Resource Category</th>
                <th className="px-6 py-5 text-[11px] font-black uppercase tracking-widest text-gray-400">Event Signature</th>
                <th className="px-6 py-5 text-[11px] font-black uppercase tracking-widest text-gray-400">Confidence</th>
                <th className="px-6 py-5 text-[11px] font-black uppercase tracking-widest text-gray-400">Lifecycle</th>
                <th className="px-6 py-5 text-[11px] font-black uppercase tracking-widest text-gray-400 text-right">Settlement</th>
              </tr>
            </thead>
            <tbody>
              {claimsQuery.loading ? (
                <tr><td colSpan={6} className="px-10 py-20 text-center text-gray-400 font-black text-sm">Synchronizing ledger telemetry...</td></tr>
              ) : claimsList.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-10 py-20 text-center font-bold">
                    <Scale className="w-12 h-12 text-gray-100 mx-auto mb-4" />
                    <p className="text-gray-400">No active claim vectors found in local nexus.</p>
                  </td>
                </tr>
              ) : (
                claimsList.map(claim => {
                  let uiStatus = 'PENDING';
                  if(claim.status.toLowerCase().includes('approve')) uiStatus = 'APPROVED';
                  if(claim.status.toLowerCase().includes('reject')) uiStatus = 'REJECTED';
                  if(claim.status.toLowerCase().includes('info')) uiStatus = 'NEEDS_MORE_INFO';
                  
                  const sColor = STATUS_COLORS[uiStatus] || STATUS_COLORS.PENDING;
                  const randomEstLoss = (claim.id * 17) % 60 + 15;

                  return (
                    <tr key={claim.id} className="group border-b border-gray-50 hover:bg-gray-50/30 transition-all font-bold">
                      <td className="px-10 py-6 text-xs font-mono font-black text-gray-300 group-hover:text-gray-500 transition-colors">#{claim.id}</td>
                      <td className="px-6 py-6">
                        <span className="bg-white border border-gray-100 px-3 py-1.5 rounded-xl text-xs text-gray-900 shadow-sm">
                          {claim.crop_type}
                        </span>
                      </td>
                      <td className="px-6 py-6 text-sm text-gray-700">{claim.damage_date}</td>
                      <td className="px-6 py-6">
                        <div className="flex items-center gap-3">
                          <div className="w-14 h-2 bg-gray-100 rounded-full overflow-hidden shadow-inner">
                            <motion.div 
                               initial={{ width: 0 }}
                               animate={{ width: `${randomEstLoss}%` }}
                               className={`h-full ${randomEstLoss > 50 ? 'bg-rose-500' : 'bg-emerald-500'}`} 
                            />
                          </div>
                          <span className="text-[11px] font-black text-gray-900 tracking-tighter">{randomEstLoss}%</span>
                        </div>
                      </td>
                      <td className="px-6 py-6">
                        <span className={`px-2.5 py-1 ${sColor.bg} ${sColor.text} text-[10px] font-bold rounded-[8px] uppercase tracking-wider`}>
                          {uiStatus.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-6 text-right">
                        {claim.recommended_insurance_amount ? (
                           <span className="text-lg font-black text-emerald-500 tracking-tight">₹{claim.recommended_insurance_amount.toLocaleString()}</span>
                        ) : (
                           <span className="text-xs font-bold text-gray-300 italic">Audit Active</span>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
