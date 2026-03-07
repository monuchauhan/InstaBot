from fastapi import APIRouter
from app.api.routes import auth, instagram, automations, logs, webhooks, conversation_flows

api_router = APIRouter()

# Include all route modules
api_router.include_router(auth.router)
api_router.include_router(instagram.router)
api_router.include_router(automations.router)
api_router.include_router(conversation_flows.router)
api_router.include_router(logs.router)
api_router.include_router(webhooks.router)
