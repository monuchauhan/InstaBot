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
    """Initialize database tables."""
    _init_async_engine()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
