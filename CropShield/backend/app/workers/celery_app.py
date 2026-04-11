from __future__ import annotations

from celery import Celery

from app.core.config import get_settings


settings = get_settings()

celery_app = Celery(
    "cropshield_worker",
    broker=settings.effective_celery_broker,
    backend=settings.effective_celery_result_backend,
    include=["app.workers.tasks"],
)

celery_app.conf.update(
    task_track_started=True,
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    task_acks_late=True,
    worker_prefetch_multiplier=1,
)
