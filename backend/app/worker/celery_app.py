from celery import Celery
from app.core.config import settings

celery_app = Celery(
    "instabot_worker",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
    include=["app.worker.tasks"],
)

# Celery configuration
celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    task_routes={
        "app.worker.tasks.process_comment_event": {"queue": "comments"},
        "app.worker.tasks.send_dm": {"queue": "messages"},
        "app.worker.tasks.post_comment_reply": {"queue": "comments"},
    },
    task_default_queue="default",
    broker_connection_retry_on_startup=True,
)
