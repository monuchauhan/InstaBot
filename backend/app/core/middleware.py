import time
from typing import Optional
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse
import redis.asyncio as redis
from app.core.config import settings


class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    Rate limiting middleware using Redis for distributed rate limiting.
    Uses a sliding window algorithm for accurate rate limiting.
    """
    
    def __init__(self, app):
        super().__init__(app)
        self.redis_client: Optional[redis.Redis] = None
    
    async def get_redis(self) -> Optional[redis.Redis]:
        """Get or create Redis connection."""
        if self.redis_client is None:
            try:
                self.redis_client = redis.from_url(
                    settings.REDIS_URL,
                    encoding="utf-8",
                    decode_responses=True,
                )
                await self.redis_client.ping()
            except Exception as e:
                print(f"Failed to connect to Redis for rate limiting: {e}")
                self.redis_client = None
        return self.redis_client
    
    def get_client_ip(self, request: Request) -> str:
        """Extract client IP address from request."""
        # Check for forwarded headers (behind nginx/proxy)
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            return forwarded.split(",")[0].strip()
        
        real_ip = request.headers.get("x-real-ip")
        if real_ip:
            return real_ip
        
        return request.client.host if request.client else "unknown"
    
    def get_rate_limit(self, path: str) -> tuple[int, int]:
        """
        Get rate limit based on the path.
        Returns (max_requests, window_seconds).
        """
        # Stricter limits for auth endpoints
        auth_paths = ["/api/auth/login", "/api/auth/register", "/api/auth/forgot-password"]
        if any(path.startswith(p) for p in auth_paths):
            return settings.RATE_LIMIT_AUTH_PER_MINUTE, 60
        
        # Default API rate limit
        if path.startswith("/api/"):
            return settings.RATE_LIMIT_PER_MINUTE, 60
        
        # No rate limiting for static files, webhooks, etc.
        return 0, 0
    
    async def dispatch(self, request: Request, call_next) -> Response:
        """Process request and apply rate limiting."""
        path = request.url.path
        max_requests, window_seconds = self.get_rate_limit(path)
        
        # Skip rate limiting if not configured for this path
        if max_requests == 0:
            return await call_next(request)
        
        redis_client = await self.get_redis()
        
        # Fallback: if Redis is unavailable, allow the request
        if redis_client is None:
            return await call_next(request)
        
        client_ip = self.get_client_ip(request)
        key = f"rate_limit:{client_ip}:{path}"
        
        try:
            # Sliding window rate limiting
            now = time.time()
            window_start = now - window_seconds
            
            pipe = redis_client.pipeline()
            pipe.zremrangebyscore(key, 0, window_start)  # Remove old requests
            pipe.zcard(key)  # Count current requests
            pipe.zadd(key, {str(now): now})  # Add current request
            pipe.expire(key, window_seconds)  # Set TTL
            results = await pipe.execute()
            
            request_count = results[1]
            
            # Set rate limit headers
            headers = {
                "X-RateLimit-Limit": str(max_requests),
                "X-RateLimit-Remaining": str(max(0, max_requests - request_count - 1)),
                "X-RateLimit-Reset": str(int(now + window_seconds)),
            }
            
            if request_count >= max_requests:
                # Rate limit exceeded
                return JSONResponse(
                    status_code=429,
                    content={
                        "detail": "Too many requests. Please try again later.",
                        "retry_after": window_seconds,
                    },
                    headers={
                        **headers,
                        "Retry-After": str(window_seconds),
                    },
                )
            
            # Proceed with request
            response = await call_next(request)
            
            # Add rate limit headers to response
            for header_name, header_value in headers.items():
                response.headers[header_name] = header_value
            
            return response
            
        except Exception as e:
            print(f"Rate limiting error: {e}")
            # On error, allow the request through
            return await call_next(request)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Add security headers to all responses."""
    
    async def dispatch(self, request: Request, call_next) -> Response:
        response = await call_next(request)
        
        # Security headers
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        
        # Only add HSTS in production
        if not settings.DEBUG:
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        
        return response
