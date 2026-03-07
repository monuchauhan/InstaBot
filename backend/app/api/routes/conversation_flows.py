"""API routes for managing conversation flows and steps."""
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.db import get_db, User
from app.schemas import (
    ConversationFlowCreate,
    ConversationFlowUpdate,
    ConversationFlowResponse,
    ConversationStepCreate,
    ConversationStepUpdate,
    ConversationStepResponse,
)
from app.services import (
    get_flow_by_id,
    get_flow_by_automation_id,
    get_user_flows,
    create_flow,
    update_flow,
    delete_flow,
    get_step_by_id,
    create_step,
    update_step,
    delete_step,
)
from app.api.deps import get_current_user

router = APIRouter(prefix="/conversation-flows", tags=["Conversation Flows"])


@router.get("", response_model=List[ConversationFlowResponse])
async def list_flows(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get all conversation flows for the current user."""
    flows = await get_user_flows(db, current_user.id)
    return flows


@router.get("/by-automation/{automation_id}", response_model=ConversationFlowResponse)
async def get_flow_for_automation(
    automation_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get the conversation flow for a specific automation."""
    flow = await get_flow_by_automation_id(db, automation_id)
    if not flow:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No conversation flow found for this automation",
        )
    return flow


@router.get("/{flow_id}", response_model=ConversationFlowResponse)
async def get_flow(
    flow_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a specific conversation flow."""
    flow = await get_flow_by_id(db, flow_id, current_user.id)
    if not flow:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation flow not found",
        )
    return flow


@router.post("", response_model=ConversationFlowResponse, status_code=status.HTTP_201_CREATED)
async def create_conversation_flow(
    flow_in: ConversationFlowCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new conversation flow for a SEND_DM automation."""
    try:
        flow = await create_flow(db, current_user.id, flow_in)
        return flow
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.put("/{flow_id}", response_model=ConversationFlowResponse)
async def update_conversation_flow(
    flow_id: int,
    flow_in: ConversationFlowUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update a conversation flow."""
    flow = await get_flow_by_id(db, flow_id, current_user.id)
    if not flow:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation flow not found",
        )
    flow = await update_flow(db, flow, flow_in)
    return flow


@router.delete("/{flow_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_conversation_flow(
    flow_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a conversation flow."""
    flow = await get_flow_by_id(db, flow_id, current_user.id)
    if not flow:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation flow not found",
        )
    await delete_flow(db, flow)
    return None


# ============= Step Routes =============

@router.post("/{flow_id}/steps", response_model=ConversationStepResponse, status_code=status.HTTP_201_CREATED)
async def add_step(
    flow_id: int,
    step_in: ConversationStepCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Add a step to a conversation flow."""
    flow = await get_flow_by_id(db, flow_id, current_user.id)
    if not flow:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation flow not found",
        )
    step = await create_step(db, flow_id, step_in)
    return step


@router.put("/{flow_id}/steps/{step_id}", response_model=ConversationStepResponse)
async def update_flow_step(
    flow_id: int,
    step_id: int,
    step_in: ConversationStepUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update a step in a conversation flow."""
    flow = await get_flow_by_id(db, flow_id, current_user.id)
    if not flow:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation flow not found",
        )
    step = await get_step_by_id(db, step_id)
    if not step or step.flow_id != flow_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Step not found",
        )
    step = await update_step(db, step, step_in)
    return step


@router.delete("/{flow_id}/steps/{step_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_flow_step(
    flow_id: int,
    step_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a step from a conversation flow."""
    flow = await get_flow_by_id(db, flow_id, current_user.id)
    if not flow:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation flow not found",
        )
    step = await get_step_by_id(db, step_id)
    if not step or step.flow_id != flow_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Step not found",
        )
    await delete_step(db, step)
    return None
