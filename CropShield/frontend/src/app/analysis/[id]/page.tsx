'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useParams } from 'next/navigation';
import { ArrowLeft, Loader2, RefreshCw } from 'lucide-react';
import {
  analyzeClaim,
  getAnalysis,
  getAnalysisArtifacts,
  getClaim,
  downloadReportPdf as downloadReportPdfFile,
  waitForJobCompletion,
} from '@/lib/api';
import type { AnalysisArtifacts, AnalysisResult, Claim, JobStatusResponse } from '@/types/api';

function ImagePanel({ title, src }: { title: string; src: string }) {
  return (
    <div className="feed-card overflow-hidden p-0">
      <p className="px-4 py-3 text-sm font-semibold text-foreground-main border-b border-border-glass">{title}</p>
      <div className="bg-black/5 overflow-hidden">
        <Image
          src={src}
          alt={title}
          width={1280}
          height={720}
          unoptimized
          className="h-auto w-full object-contain shadow-inner"
          style={{ imageRendering: 'auto', filter: 'contrast(1.02) brightness(1.02)' }}
        />
      </div>
    </div>
  );
}

function extractAttemptedWindows(reason: string): string[] {
  const windowsMatch = reason.match(/expanded attempts:\s*([^)]*)\)/i);
  if (!windowsMatch?.[1]) {
    return [];
  }
  return windowsMatch[1]
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

export default function AnalysisDetailPage() {
  const params = useParams<{ id: string }>();
  const claimId = params.id;

  const [claim, setClaim] = useState<Claim | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [artifacts, setArtifacts] = useState<AnalysisArtifacts | null>(null);
  const [job, setJob] = useState<JobStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [reportBusy, setReportBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [claimData, analysisData] = await Promise.all([
        getClaim(claimId),
        getAnalysis(claimId),
      ]);
      setClaim(claimData);
      setAnalysis(analysisData);
      if (analysisData.analysis?.status === 'completed') {
        const art = await getAnalysisArtifacts(claimId);
        setArtifacts(art);
      } else {
        setArtifacts(null);
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claimId]);

  const runAnalysis = async () => {
    setBusy(true);
    setError(null);
    try {
      const response = await analyzeClaim(claimId);
      const latest = await waitForJobCompletion(response.job_id, {
        timeoutMs: 10 * 60_000,
        onUpdate: (update) => setJob(update),
      });
      if (latest.status === 'failed') {
        throw new Error(latest.error_message ?? 'Analysis failed');
      }
      if (latest.status === 'completed') {
        await load();
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  };

  const handleDownloadReportPdf = async () => {
    setReportBusy(true);
    setError(null);
    try {
      await downloadReportPdfFile(claimId);
    } catch (err) {
      setError(String(err));
    } finally {
      setReportBusy(false);
    }
  };

  const decision = analysis?.analysis?.decision;
  const farmerAssessment = analysis?.analysis?.farmer_assessment;
  const analysisStatus = analysis?.analysis?.status;
  const failureReason =
    (analysisStatus === 'failed' ? analysis?.analysis?.status_message : null) ||
    (job?.status === 'failed' ? job.error_message : null);
  const attemptedWindows = failureReason ? extractAttemptedWindows(failureReason) : [];

  return (
    <div className="flex flex-col gap-6 lg:gap-8">
      <div className="page-hero">
        <div>
          <p className="section-heading mb-2">Claim Analysis</p>
          <h1 className="page-title gradient-text">Analysis Detail</h1>
          <p className="page-description mt-3">Review fused damage signals, imagery, and the final decision trail.</p>
        </div>
        <Link href="/farmer/requests" className="inline-flex items-center gap-2 rounded-2xl border border-border-glass bg-white/80 px-4 py-2.5 text-sm font-semibold text-foreground-main no-underline hover:bg-white">
          <ArrowLeft size={16} />
          Back to Requests
        </Link>
        <button type="button" onClick={load} className="inline-flex items-center gap-2 rounded-2xl border border-border-glass bg-white/80 px-4 py-2.5 text-sm font-semibold hover:bg-white">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {error ? (
        <div className="feed-card rounded-2xl border border-red-300/60 text-red-700 text-sm">{error}</div>
      ) : null}

      {loading ? (
        <div className="feed-card rounded-2xl p-8 text-center">
          <Loader2 size={24} className="animate-spin text-primary mx-auto mb-3" />
          Loading analysis...
        </div>
      ) : null}

      {!loading && claim ? (
        <section className="feed-card grid md:grid-cols-4 gap-4 text-sm">
          <p><strong>Claim ID:</strong> #{claim.id}</p>
          <p><strong>Farmer:</strong> {claim.farmer_name}</p>
          <p><strong>Crop:</strong> {claim.crop_type}</p>
          <p><strong>Damage Date:</strong> {claim.damage_date}</p>
        </section>
      ) : null}

      {!loading && !analysis?.analysis ? (
        <section className="feed-card text-center">
          <p className="text-foreground-muted mb-4">No analysis found for this claim yet.</p>
          <button type="button" className="btn-premium" onClick={runAnalysis} disabled={busy}>
            {busy ? <Loader2 size={16} className="animate-spin" /> : null}
            Run Analysis
          </button>
        </section>
      ) : null}

      {analysis?.analysis && analysis.analysis.status !== 'completed' ? (
        <section className="feed-card text-center">
          <p className="text-foreground-main font-semibold mb-2">Analysis status: {analysis.analysis.status}</p>
          <p className="text-sm text-foreground-muted mb-4">{job ? `${job.status} (${job.progress}%)` : 'Processing...'}</p>
          <button type="button" className="btn-premium" onClick={runAnalysis} disabled={busy}>
            {busy ? <Loader2 size={16} className="animate-spin" /> : null}
            Re-check Analysis
          </button>
        </section>
      ) : null}

      {failureReason ? (
        <section className="feed-card border border-red-300/60">
          <h2 className="text-lg font-bold text-red-700 mb-2">Imagery Lookup Failed</h2>
          <p className="text-sm text-red-800 mb-3">{failureReason}</p>
          {attemptedWindows.length > 0 ? (
            <div className="text-sm text-red-900">
              <p className="font-semibold mb-2">Attempted date windows:</p>
              <ul className="list-disc pl-5 space-y-1">
                {attemptedWindows.map((windowText) => (
                  <li key={windowText}>{windowText}</li>
                ))}
              </ul>
            </div>
          ) : null}
          <p className="text-xs text-foreground-dim mt-3">
            Try changing analysis start/end dates to a wider or older period, then run analysis again.
          </p>
        </section>
      ) : null}

      {analysis?.analysis?.status === 'completed' ? (
        <>
          {farmerAssessment ? (
            <section className="feed-card">
              <h2 className="text-xl font-bold text-foreground-main mb-2">Possible Crop Damage Assessment</h2>
              <p className="text-3xl font-bold text-primary mb-2">{farmerAssessment.possible_damage_percentage.toFixed(1)}%</p>
              <p className="text-sm font-semibold text-foreground-main mb-2">{farmerAssessment.risk_level}</p>
              <p className="text-sm text-foreground-muted">{farmerAssessment.summary}</p>
              <p className="text-xs text-foreground-dim mt-3">
                Final insurance amount is reviewed by admin and aligned with PMFBY workflow.
              </p>
            </section>
          ) : null}

          {decision ? (
            <section className="feed-card">
              <h2 className="text-lg font-bold text-foreground-main mb-3">Fused Damage Decision</h2>
              <div className="grid md:grid-cols-2 gap-4 text-sm">
                <p><strong>Decision:</strong> {decision.decision}</p>
                <p><strong>Confidence:</strong> {(decision.confidence * 100).toFixed(1)}%</p>
              </div>
              <div className="mt-4 rounded-xl border border-primary/10 bg-white/60 p-4 text-sm space-y-2">
                <p className="font-semibold text-foreground-main">Calculation</p>
                <p className="text-foreground-muted">
                  Fused Damage = 0.35 × NDVI Damage + 0.15 × NDWI Damage + 0.15 × EVI Damage + 0.20 × AI Damage + 0.15 × Area Score
                </p>
                <div className="grid sm:grid-cols-2 gap-2 text-foreground-main">
                  <p>NDVI Damage: {formatPercent(decision.ndvi_damage)}</p>
                  <p>NDWI Damage: {formatPercent(decision.ndwi_damage)}</p>
                  <p>EVI Damage: {formatPercent(decision.evi_damage)}</p>
                  <p>AI Damage: {formatPercent(decision.ai_damage)}</p>
                  <p>Area Score: {formatPercent(decision.area_score)}</p>
                  <p>Fused Damage: {formatPercent(decision.fused_damage)}</p>
                </div>
              </div>
              <p className="text-sm text-foreground-muted mt-3">{decision.rationale}</p>
            </section>
          ) : null}

          {artifacts ? (
            <section className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
              <ImagePanel title="RGB Before" src={artifacts.before_rgb_data_url} />
              <ImagePanel title="RGB After" src={artifacts.after_rgb_data_url} />
              <ImagePanel title="NDVI Before" src={artifacts.ndvi_before_data_url} />
              <ImagePanel title="NDVI After" src={artifacts.ndvi_after_data_url} />
              <ImagePanel title="NDWI Before" src={artifacts.ndwi_before_data_url} />
              <ImagePanel title="NDWI After" src={artifacts.ndwi_after_data_url} />
              <ImagePanel title="EVI Before" src={artifacts.evi_before_data_url} />
              <ImagePanel title="EVI After" src={artifacts.evi_after_data_url} />
            </section>
          ) : null}

          <section className="feed-card p-4 flex justify-end">
            <button
              type="button"
              className="btn-premium"
              onClick={handleDownloadReportPdf}
              disabled={reportBusy}
            >
              {reportBusy ? <Loader2 size={16} className="animate-spin" /> : null}
              Download PDF
            </button>
          </section>
        </>
      ) : null}
    </div>
  );
}
