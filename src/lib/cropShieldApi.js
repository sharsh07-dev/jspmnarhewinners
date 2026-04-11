/**
 * CropShield API Bridge
 * Connects the React frontend to the Satellite Analysis Engine (FastAPI).
 */

const getBaseUrl = () => {
    // If we're on localhost, use the standard 127.0.0.1
    // If we're on mobile (accessing via IP), use that same IP for the backend
    const hostname = window.location.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return 'http://127.0.0.1:8000';
    }
    return `http://${hostname}:8000`;
};

const BASE_URL = getBaseUrl();
const API_PREFIX = '/api/v1';

async function apiFetch(path, options = {}) {
    const url = `${BASE_URL}${API_PREFIX}${path}`;
    const res = await fetch(url, {
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
        },
        ...options,
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.detail || `API error ${res.status}`);
    }

    const text = await res.text();
    return text ? JSON.parse(text) : {};
}

export const cropShieldApi = {
    // Farm & Profile
    getFarmOptions: (params) => {
        const qs = new URLSearchParams(params).toString();
        return apiFetch(`/farms/options${qs ? `?${qs}` : ''}`);
    },
    createFarmProfile: (payload) => apiFetch('/farms/lookup', { method: 'POST', body: JSON.stringify(payload) }),
    
    // Insurance Claims
    createClaim: (payload) => apiFetch('/claims', { method: 'POST', body: JSON.stringify(payload) }),
    getClaims: (params = {}) => {
        const qs = new URLSearchParams(params).toString();
        return apiFetch(`/claims?${qs}`);
    },
    getClaimFull: (id) => apiFetch(`/admin/claims/${id}/full`),
    
    // Analysis
    analyzeClaim: (id, params) => apiFetch(`/claims/${id}/analyze`, { method: 'POST', body: JSON.stringify(params) }),
    getAnalysisArtifacts: (id) => apiFetch(`/claims/${id}/analysis/artifacts`),
    
    // Admin Review
    reviewClaim: (id, payload) => apiFetch(`/admin/claims/${id}/review`, { method: 'PATCH', body: JSON.stringify(payload) }),
    
    // Jobs
    getJobStatus: (id) => apiFetch(`/jobs/${id}`),
};

export const pollJob = async (jobId, onUpdate) => {
    let finished = false;
    while (!finished) {
        const status = await cropShieldApi.getJobStatus(jobId);
        onUpdate(status);
        if (status.status === 'completed' || status.status === 'failed') {
            finished = true;
            return status;
        }
        await new Promise(r => setTimeout(r, 2000));
    }
};
