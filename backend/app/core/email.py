import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional
from app.core.config import settings


async def send_email(
    to_email: str,
    subject: str,
    html_content: str,
    text_content: Optional[str] = None,
) -> bool:
    """Send an email using SMTP."""
    if not settings.email_enabled:
        print(f"Email not configured. Would send to {to_email}: {subject}")
        return False
    
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"{settings.SMTP_FROM_NAME} <{settings.SMTP_FROM_EMAIL}>"
        msg["To"] = to_email
        
        if text_content:
            msg.attach(MIMEText(text_content, "plain"))
        msg.attach(MIMEText(html_content, "html"))
        
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            server.starttls()
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.sendmail(settings.SMTP_FROM_EMAIL, to_email, msg.as_string())
        
        return True
    except Exception as e:
        print(f"Failed to send email: {e}")
        return False


async def send_verification_email(to_email: str, verification_token: str) -> bool:
    """Send email verification link."""
    verification_url = f"{settings.FRONTEND_URL}/verify-email?token={verification_token}"
    
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body {{ font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; line-height: 1.6; color: #333; }}
            .container {{ max-width: 600px; margin: 0 auto; padding: 40px 20px; }}
            .header {{ text-align: center; margin-bottom: 40px; }}
            .logo {{ font-size: 32px; font-weight: bold; color: #667eea; }}
            .content {{ background: #f8f9fa; border-radius: 12px; padding: 30px; margin-bottom: 30px; }}
            .button {{ display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; margin: 20px 0; }}
            .footer {{ text-align: center; color: #666; font-size: 14px; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div class="logo">📸 {settings.APP_NAME}</div>
            </div>
            <div class="content">
                <h2>Verify Your Email Address</h2>
                <p>Thanks for signing up! Please click the button below to verify your email address and activate your account.</p>
                <center>
                    <a href="{verification_url}" class="button">Verify Email</a>
                </center>
                <p style="font-size: 14px; color: #666;">If the button doesn't work, copy and paste this link into your browser:</p>
                <p style="font-size: 14px; word-break: break-all;">{verification_url}</p>
                <p style="font-size: 14px; color: #666;">This link will expire in 24 hours.</p>
            </div>
            <div class="footer">
                <p>If you didn't create an account, you can safely ignore this email.</p>
                <p>&copy; {settings.APP_NAME}. All rights reserved.</p>
            </div>
        </div>
    </body>
    </html>
    """
    
    text_content = f"""
    Verify Your Email Address
    
    Thanks for signing up! Please click the link below to verify your email address:
    
    {verification_url}
    
    This link will expire in 24 hours.
    
    If you didn't create an account, you can safely ignore this email.
    """
    
    return await send_email(to_email, f"Verify your {settings.APP_NAME} email", html_content, text_content)


async def send_password_reset_email(to_email: str, reset_token: str) -> bool:
    """Send password reset email."""
    reset_url = f"{settings.FRONTEND_URL}/reset-password?token={reset_token}"
    
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body {{ font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; line-height: 1.6; color: #333; }}
            .container {{ max-width: 600px; margin: 0 auto; padding: 40px 20px; }}
            .header {{ text-align: center; margin-bottom: 40px; }}
            .logo {{ font-size: 32px; font-weight: bold; color: #667eea; }}
            .content {{ background: #f8f9fa; border-radius: 12px; padding: 30px; margin-bottom: 30px; }}
            .button {{ display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; margin: 20px 0; }}
            .footer {{ text-align: center; color: #666; font-size: 14px; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div class="logo">📸 {settings.APP_NAME}</div>
            </div>
            <div class="content">
                <h2>Reset Your Password</h2>
                <p>We received a request to reset your password. Click the button below to create a new password.</p>
                <center>
                    <a href="{reset_url}" class="button">Reset Password</a>
                </center>
                <p style="font-size: 14px; color: #666;">If the button doesn't work, copy and paste this link into your browser:</p>
                <p style="font-size: 14px; word-break: break-all;">{reset_url}</p>
                <p style="font-size: 14px; color: #666;">This link will expire in 1 hour.</p>
            </div>
            <div class="footer">
                <p>If you didn't request a password reset, you can safely ignore this email.</p>
                <p>&copy; {settings.APP_NAME}. All rights reserved.</p>
            </div>
        </div>
    </body>
    </html>
    """
    
    text_content = f"""
    Reset Your Password
    
    We received a request to reset your password. Click the link below to create a new password:
    
    {reset_url}
    
    This link will expire in 1 hour.
    
    If you didn't request a password reset, you can safely ignore this email.
    """
    
    return await send_email(to_email, f"Reset your {settings.APP_NAME} password", html_content, text_content)


async def send_welcome_email(to_email: str, user_name: str) -> bool:
    """Send welcome email after verification."""
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body {{ font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; line-height: 1.6; color: #333; }}
            .container {{ max-width: 600px; margin: 0 auto; padding: 40px 20px; }}
            .header {{ text-align: center; margin-bottom: 40px; }}
            .logo {{ font-size: 32px; font-weight: bold; color: #667eea; }}
            .content {{ background: #f8f9fa; border-radius: 12px; padding: 30px; margin-bottom: 30px; }}
            .button {{ display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; margin: 20px 0; }}
            .feature {{ display: flex; align-items: center; margin: 15px 0; }}
            .feature-icon {{ font-size: 24px; margin-right: 15px; }}
            .footer {{ text-align: center; color: #666; font-size: 14px; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div class="logo">📸 {settings.APP_NAME}</div>
            </div>
            <div class="content">
                <h2>Welcome to {settings.APP_NAME}! 🎉</h2>
                <p>Hi {user_name or 'there'},</p>
                <p>Your account is now verified and ready to go! Here's what you can do:</p>
                <div class="feature">
                    <span class="feature-icon">📱</span>
                    <span><strong>Connect Instagram</strong> - Link your Professional account</span>
                </div>
                <div class="feature">
                    <span class="feature-icon">💬</span>
                    <span><strong>Auto-Reply Comments</strong> - Engage with your audience automatically</span>
                </div>
                <div class="feature">
                    <span class="feature-icon">✉️</span>
                    <span><strong>Send DMs</strong> - Reach out to commenters instantly</span>
                </div>
                <center>
                    <a href="{settings.FRONTEND_URL}/dashboard" class="button">Go to Dashboard</a>
                </center>
            </div>
            <div class="footer">
                <p>Need help? Check out our documentation or contact support.</p>
                <p>&copy; {settings.APP_NAME}. All rights reserved.</p>
            </div>
        </div>
    </body>
    </html>
    """
    
    return await send_email(to_email, f"Welcome to {settings.APP_NAME}! 🎉", html_content)
