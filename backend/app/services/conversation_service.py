"""Service for managing conversation flows, steps, and state tracking."""
from typing import Optional, List
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload, subqueryload
from app.db.models import (
    ConversationFlow,
    ConversationStep,
    ConversationState,
    AutomationSettings,
    AutomationType,
)
from app.schemas import (
    ConversationFlowCreate,
    ConversationFlowUpdate,
    ConversationStepCreate,
    ConversationStepUpdate,
)


# ============= Conversation Flow CRUD =============

async def get_flow_by_id(
    db: AsyncSession,
    flow_id: int,
    user_id: int,
) -> Optional[ConversationFlow]:
    """Get a conversation flow by ID, ensuring it belongs to the user."""
    result = await db.execute(
        select(ConversationFlow)
        .join(AutomationSettings, ConversationFlow.automation_id == AutomationSettings.id)
        .options(
            selectinload(ConversationFlow.steps)
            .selectinload(ConversationStep.child_steps)
        )
        .where(
            ConversationFlow.id == flow_id,
            AutomationSettings.user_id == user_id,
        )
    )
    return result.scalar_one_or_none()


async def get_flow_by_automation_id(
    db: AsyncSession,
    automation_id: int,
) -> Optional[ConversationFlow]:
    """Get the conversation flow for an automation."""
    result = await db.execute(
        select(ConversationFlow)
        .options(
            selectinload(ConversationFlow.steps)
            .selectinload(ConversationStep.child_steps)
        )
        .where(ConversationFlow.automation_id == automation_id)
    )
    return result.scalar_one_or_none()


async def get_user_flows(
    db: AsyncSession,
    user_id: int,
) -> List[ConversationFlow]:
    """Get all conversation flows for a user."""
    result = await db.execute(
        select(ConversationFlow)
        .join(AutomationSettings, ConversationFlow.automation_id == AutomationSettings.id)
        .options(
            selectinload(ConversationFlow.steps)
            .selectinload(ConversationStep.child_steps)
        )
        .where(AutomationSettings.user_id == user_id)
    )
    return list(result.scalars().all())


async def create_flow(
    db: AsyncSession,
    user_id: int,
    flow_in: ConversationFlowCreate,
) -> ConversationFlow:
    """Create a conversation flow with optional inline steps."""
    # Verify the automation belongs to the user and is SEND_DM type
    automation = await db.execute(
        select(AutomationSettings).where(
            AutomationSettings.id == flow_in.automation_id,
            AutomationSettings.user_id == user_id,
            AutomationSettings.automation_type == AutomationType.SEND_DM,
        )
    )
    automation = automation.scalar_one_or_none()
    if not automation:
        raise ValueError("Automation not found or is not a SEND_DM type")

    # Check if a flow already exists for this automation
    existing = await get_flow_by_automation_id(db, flow_in.automation_id)
    if existing:
        raise ValueError("A conversation flow already exists for this automation")

    flow = ConversationFlow(
        automation_id=flow_in.automation_id,
        name=flow_in.name,
        description=flow_in.description,
        initial_message=flow_in.initial_message,
    )
    db.add(flow)
    await db.flush()

    # Create inline steps if provided
    if flow_in.steps:
        for step_in in flow_in.steps:
            step = ConversationStep(
                flow_id=flow.id,
                parent_step_id=step_in.parent_step_id,
                step_order=step_in.step_order,
                payload_trigger=step_in.payload_trigger,
                button_title=step_in.button_title,
                message_text=step_in.message_text,
                quick_replies=[qr.model_dump() for qr in step_in.quick_replies] if step_in.quick_replies else None,
                is_end_step=step_in.is_end_step,
            )
            db.add(step)

        await db.flush()

    await db.flush()

    # Re-query with eager loading so `steps` is available for serialization
    return await get_flow_by_automation_id(db, flow.automation_id)


async def update_flow(
    db: AsyncSession,
    flow: ConversationFlow,
    flow_in: ConversationFlowUpdate,
) -> ConversationFlow:
    """Update a conversation flow."""
    update_data = flow_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(flow, field, value)
    await db.flush()

    # Re-query with eager loading so `steps` is available for serialization
    result = await db.execute(
        select(ConversationFlow)
        .options(
            selectinload(ConversationFlow.steps)
            .selectinload(ConversationStep.child_steps)
        )
        .where(ConversationFlow.id == flow.id)
    )
    return result.scalar_one()


async def delete_flow(db: AsyncSession, flow: ConversationFlow) -> None:
    """Delete a conversation flow and all its steps/states."""
    await db.delete(flow)
    await db.flush()


# ============= Conversation Step CRUD =============

async def get_step_by_id(
    db: AsyncSession,
    step_id: int,
) -> Optional[ConversationStep]:
    """Get a conversation step by ID."""
    result = await db.execute(
        select(ConversationStep).where(ConversationStep.id == step_id)
    )
    return result.scalar_one_or_none()


async def _get_step_eagerly(
    db: AsyncSession,
    step_id: int,
) -> ConversationStep:
    """Re-query a step with child_steps eagerly loaded."""
    result = await db.execute(
        select(ConversationStep)
        .options(selectinload(ConversationStep.child_steps))
        .where(ConversationStep.id == step_id)
    )
    return result.scalar_one()


async def create_step(
    db: AsyncSession,
    flow_id: int,
    step_in: ConversationStepCreate,
) -> ConversationStep:
    """Create a conversation step."""
    step = ConversationStep(
        flow_id=flow_id,
        parent_step_id=step_in.parent_step_id,
        step_order=step_in.step_order,
        payload_trigger=step_in.payload_trigger,
        button_title=step_in.button_title,
        message_text=step_in.message_text,
        quick_replies=[qr.model_dump() for qr in step_in.quick_replies] if step_in.quick_replies else None,
        is_end_step=step_in.is_end_step,
    )
    db.add(step)
    await db.flush()
    return await _get_step_eagerly(db, step.id)


async def update_step(
    db: AsyncSession,
    step: ConversationStep,
    step_in: ConversationStepUpdate,
) -> ConversationStep:
    """Update a conversation step."""
    update_data = step_in.model_dump(exclude_unset=True)
    if "quick_replies" in update_data and update_data["quick_replies"] is not None:
        update_data["quick_replies"] = [qr.model_dump() if hasattr(qr, 'model_dump') else qr for qr in update_data["quick_replies"]]
    for field, value in update_data.items():
        setattr(step, field, value)
    await db.flush()
    return await _get_step_eagerly(db, step.id)


async def delete_step(db: AsyncSession, step: ConversationStep) -> None:
    """Delete a conversation step."""
    await db.delete(step)
    await db.flush()


# ============= Conversation State (sync versions for Celery tasks) =============

def get_or_create_state_sync(
    db_session,
    instagram_account_id: int,
    recipient_ig_id: str,
    flow_id: int,
) -> ConversationState:
    """Get or create a conversation state (sync version for Celery)."""
    state = db_session.query(ConversationState).filter(
        ConversationState.instagram_account_id == instagram_account_id,
        ConversationState.recipient_ig_id == recipient_ig_id,
        ConversationState.flow_id == flow_id,
        ConversationState.is_active == True,
    ).first()

    if not state:
        state = ConversationState(
            instagram_account_id=instagram_account_id,
            recipient_ig_id=recipient_ig_id,
            flow_id=flow_id,
            current_step_id=None,  # At the initial message stage
            is_active=True,
        )
        db_session.add(state)
        db_session.flush()

    return state


def get_active_state_sync(
    db_session,
    instagram_account_id: int,
    sender_ig_id: str,
) -> Optional[ConversationState]:
    """Get the active conversation state for a sender (sync for Celery)."""
    return db_session.query(ConversationState).filter(
        ConversationState.instagram_account_id == instagram_account_id,
        ConversationState.recipient_ig_id == sender_ig_id,
        ConversationState.is_active == True,
    ).first()


def find_next_step_sync(
    db_session,
    flow_id: int,
    current_step_id: Optional[int],
    payload: str,
) -> Optional[ConversationStep]:
    """Find the next step based on the payload the user selected.
    
    If current_step_id is None, we're at the initial message stage
    and look for root-level steps (parent_step_id IS NULL) matching the payload.
    Otherwise, look for child steps of the current step matching the payload.
    """
    query = db_session.query(ConversationStep).filter(
        ConversationStep.flow_id == flow_id,
        ConversationStep.payload_trigger == payload,
    )

    if current_step_id is None:
        query = query.filter(ConversationStep.parent_step_id.is_(None))
    else:
        query = query.filter(ConversationStep.parent_step_id == current_step_id)

    return query.first()
