from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """Base class for all database models."""
    pass


# Lazy-initialize async engine and session only when needed (not in Celery worker)
engine = None
AsyncSessionLocal = None


def _init_async_engine():
    """Initialize async engine on first use (avoids import-time crash in Celery worker)."""
    global engine, AsyncSessionLocal
    if engine is not None:
        return
    
    from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
    from app.core.config import settings
    
    engine = create_async_engine(
        settings.DATABASE_URL,
        echo=settings.DEBUG,
        future=True,
    )
    
    AsyncSessionLocal = async_sessionmaker(
        engine,
        class_=AsyncSession,
        expire_on_commit=False,
        autocommit=False,
        autoflush=False,
    )


async def get_db():
    """Dependency to get database session."""
    _init_async_engine()
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def init_db():
    """Initialize database tables and apply pending column migrations.

    ``create_all`` only creates tables that are missing; it never adds new
    columns to existing tables.  The statements below fill that gap so that
    deployments against an older schema are upgraded automatically.
    """
    _init_async_engine()
    from sqlalchemy import text

    async with engine.begin() as conn:
        # Create any brand-new tables first.
        await conn.run_sync(Base.metadata.create_all)

        # ---------- incremental enum value migrations ----------
        # ADD VALUE IF NOT EXISTS is safe to run repeatedly (PostgreSQL 12+).
        # We add both cases to cover however SQLAlchemy serialises the enum.
        await conn.execute(text(
            "ALTER TYPE actiontype ADD VALUE IF NOT EXISTS 'dm_response'"
        ))
        await conn.execute(text(
            "ALTER TYPE actiontype ADD VALUE IF NOT EXISTS 'DM_RESPONSE'"
        ))

        # ---------- incremental column migrations ----------
        # PostgreSQL's ADD COLUMN IF NOT EXISTS is safe to run repeatedly.
        await conn.execute(text(
            "ALTER TABLE action_logs "
            "ADD COLUMN IF NOT EXISTS recipient_username VARCHAR(100) DEFAULT NULL"
        ))
        await conn.execute(text(
            "ALTER TABLE automation_settings "
            "ADD COLUMN IF NOT EXISTS target_post_id VARCHAR(100) DEFAULT NULL"
        ))
        await conn.execute(text(
            "ALTER TABLE conversation_steps "
            "ADD COLUMN IF NOT EXISTS button_title VARCHAR(20) DEFAULT NULL"
        ))
