# backend/auth_service/mail_service/email_service.py
import os
import logging
from typing import Dict, Any, Optional
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail, Email, To, Content, TemplateId, Personalization

# Setup logging
logger = logging.getLogger(__name__)

class EmailService:
    """Email service using SendGrid for sending emails"""
    
    def __init__(self):
        """Initialize the email service with SendGrid API key"""
        self.api_key = os.getenv("SENDGRID_API_KEY")
        self.from_email = os.getenv("EMAIL_FROM", "noreply@loadant.com")
        self.client = None
        
        if not self.api_key:
            logger.warning("SendGrid API key not set. Email functionality will not work.")
        else:
            self.client = SendGridAPIClient(self.api_key)
            
    async def send_email(self, to_email: str, subject: str, html_content: str) -> bool:
        """Send a basic email using SendGrid
        
        Args:
            to_email: Recipient email address
            subject: Email subject
            html_content: HTML content of the email
            
        Returns:
            bool: True if email was sent successfully
        """
        if not self.client:
            logger.error("SendGrid client not initialized. Cannot send email.")
            return False
            
        try:
            message = Mail(
                from_email=self.from_email,
                to_emails=to_email,
                subject=subject,
                html_content=html_content
            )
            
            response = self.client.send(message)
            
            # Log success
            logger.info(f"Email sent to {to_email}, Status: {response.status_code}")
            return response.status_code in [200, 201, 202]
            
        except Exception as e:
            logger.error(f"Failed to send email: {str(e)}")
            return False
    
    async def send_password_reset_email(self, to_email: str, reset_token: str, frontend_url: str) -> bool:
        """Send password reset email with reset link
        
        Args:
            to_email: Recipient email address
            reset_token: Password reset token
            frontend_url: Frontend URL for creating the reset link
            
        Returns:
            bool: True if email was sent successfully
        """
        reset_link = f"{frontend_url}/reset-password?token={reset_token}"
        
        subject = "Reset Your Password"
        
        html_content = f"""
        <html>
            <body>
                <h2>Password Reset Request</h2>
                <p>Hello,</p>
                <p>We received a request to reset your password. Click the link below to set a new password:</p>
                <p><a href="{reset_link}" style="padding: 10px 15px; background-color: #4f46e5; color: white; text-decoration: none; border-radius: 5px;">Reset Password</a></p>
                <p>Or copy and paste this URL into your browser:</p>
                <p>{reset_link}</p>
                <p>This link will expire in 1 hour.</p>
                <p>If you didn't request a password reset, please ignore this email.</p>
                <p>Thank you,<br>The RAG Assistant Team</p>
            </body>
        </html>
        """
        
        return await self.send_email(to_email, subject, html_content)
        
    async def send_verification_email(self, to_email: str, verification_token: str, frontend_url: str) -> bool:
        """Send email verification link
        
        Args:
            to_email: Recipient email address
            verification_token: Email verification token
            frontend_url: Frontend URL for creating the verification link
            
        Returns:
            bool: True if email was sent successfully
        """
        verification_link = f"{frontend_url}/verify-email?token={verification_token}"
        
        subject = "Verify Your Email Address"
        
        html_content = f"""
        <html>
            <body>
                <h2>Email Verification</h2>
                <p>Hello,</p>
                <p>Thank you for registering! Please click the link below to verify your email address:</p>
                <p><a href="{verification_link}" style="padding: 10px 15px; background-color: #4f46e5; color: white; text-decoration: none; border-radius: 5px;">Verify Email</a></p>
                <p>Or copy and paste this URL into your browser:</p>
                <p>{verification_link}</p>
                <p>Thank you,<br>The RAG Assistant Team</p>
            </body>
        </html>
        """
        
        return await self.send_email(to_email, subject, html_content)

# Create a singleton instance
email_service = EmailService()