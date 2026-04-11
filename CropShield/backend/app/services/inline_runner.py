from __future__ import annotations

import asyncio
import logging
import threading
from typing import Any

from app.workers.tasks import run_analysis_job, run_report_job

logger = logging.getLogger(__name__)


class InlineJobRunner:
    """Dispatches jobs in-process when Celery workers are intentionally disabled."""

    @staticmethod
    def schedule_analysis(job_id: str, claim_id: int, params: dict[str, Any]) -> None:
        InlineJobRunner._schedule(run_analysis_job(job_id=job_id, claim_id=claim_id, params=params))

    @staticmethod
    def schedule_report(job_id: str, claim_id: int, analysis_run_id: int) -> None:
        InlineJobRunner._schedule(
            run_report_job(job_id=job_id, claim_id=claim_id, analysis_run_id=analysis_run_id)
        )

    @staticmethod
    def _schedule(coro) -> None:
        try:
            loop = asyncio.get_running_loop()
            loop.create_task(InlineJobRunner._guard(coro))
        except RuntimeError:
            thread = threading.Thread(target=lambda: asyncio.run(InlineJobRunner._guard(coro)), daemon=True)
            thread.start()

    @staticmethod
    async def _guard(coro) -> None:
        try:
            await coro
        except Exception:
            logger.exception("Inline background job failed.")
