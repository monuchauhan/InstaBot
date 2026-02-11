from fastapi import APIRouter
from app.api.routes import auth, instagram, automations, logs, webhooks

api_router = APIRouter()

# Include all route modules
api_router.include_router(auth.router)
api_router.include_router(instagram.router)
api_router.include_router(automations.router)
api_router.include_router(logs.router)
api_router.include_router(webhooks.router)
