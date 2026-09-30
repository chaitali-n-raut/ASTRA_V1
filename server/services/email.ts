import nodemailer from 'nodemailer';

export interface EmailSendResult {
  success: boolean;
  providerConfigured: boolean;
  provider: 'smtp' | 'resend' | 'none';
  statusMessage: string;
  code: 'EMAIL_SENT' | 'EMAIL_PROVIDER_NOT_CONFIGURED' | 'EMAIL_DELIVERY_FAILED';
  error?: string;
  devVerificationUrl?: string;
}

export function isEmailProviderConfigured(): { configured: boolean; provider: 'smtp' | 'resend' | 'none' } {
  const provider = (process.env.EMAIL_PROVIDER || '').toLowerCase().trim();

  if (provider === 'smtp' || (!provider && process.env.SMTP_HOST)) {
    if (process.env.SMTP_HOST) {
      return { configured: true, provider: 'smtp' };
    }
  }

  if (provider === 'resend' || (!provider && process.env.RESEND_API_KEY)) {
    if (process.env.RESEND_API_KEY) {
      return { configured: true, provider: 'resend' };
    }
  }

  return { configured: false, provider: 'none' };
}

export function getVerificationUrl(rawToken: string, reqHost?: string): string {
  // Use configured APP_URL or request host
  let baseUrl = process.env.APP_URL;
  if (!baseUrl && reqHost) {
    const protocol = reqHost.includes('localhost') ? 'http' : 'https';
    baseUrl = `${protocol}://${reqHost}`;
  }
  if (!baseUrl) {
    baseUrl = 'http://localhost:3000';
  }
  baseUrl = baseUrl.replace(/\/+$/, '');

  return `${baseUrl}/api/auth/verify-email?token=${encodeURIComponent(rawToken)}`;
}

export async function sendVerificationEmail(options: {
  toEmail: string;
  userName: string;
  rawToken: string;
  reqHost?: string;
}): Promise<EmailSendResult> {
  const { toEmail, userName, rawToken, reqHost } = options;
  const verificationUrl = getVerificationUrl(rawToken, reqHost);
  const emailStatus = isEmailProviderConfigured();

  // If not configured, truthfully report that email delivery is not configured
  if (!emailStatus.configured) {
    const isDev = process.env.NODE_ENV !== 'production';
    if (isDev) {
      console.log(`\n======================================================`);
      console.log(`[ASTRA AUTH - DEV MODE] Email provider not configured.`);
      console.log(`Recipient: ${toEmail} (${userName})`);
      console.log(`Verification URL: ${verificationUrl}`);
      console.log(`======================================================\n`);
    }

    return {
      success: false,
      providerConfigured: false,
      provider: 'none',
      code: 'EMAIL_PROVIDER_NOT_CONFIGURED',
      statusMessage: 'Registration created, but email delivery is not configured.',
      devVerificationUrl: isDev ? verificationUrl : undefined,
    };
  }

  const emailFrom = process.env.EMAIL_FROM || 'ASTRA Autonomous Assistant <no-reply@astra.corp>';
  const subject = 'Verify your ASTRA account';

  const textContent = `Hello ${userName},

Thank you for registering with ASTRA.

Please verify your email address by clicking the verification link below:
${verificationUrl}

This verification link will expire in 24 hours.

If you did not create an ASTRA account, please ignore this email.

Best regards,
ASTRA Security & Operations Team`;

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Verify your ASTRA account</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 32px 16px;">
  <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 560px; background-color: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
    <tr>
      <td style="background-color: #0f766e; padding: 24px 32px; text-align: left;">
        <h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 700; letter-spacing: -0.5px;">
          ASTRA<span style="color: #99f6e4;">_V1</span>
        </h1>
        <p style="color: #ccfbf1; margin: 4px 0 0; font-size: 12px;">Autonomous Workspace Synchronization & Resolution</p>
      </td>
    </tr>
    <tr>
      <td style="padding: 32px;">
        <h2 style="color: #0f172a; margin: 0 0 16px; font-size: 18px; font-weight: 600;">
          Verify your email address
        </h2>
        <p style="color: #334155; font-size: 14px; line-height: 1.6; margin: 0 0 16px;">
          Hello <strong>${userName}</strong>,
        </p>
        <p style="color: #334155; font-size: 14px; line-height: 1.6; margin: 0 0 24px;">
          Thank you for registering with ASTRA. Please verify your email address to activate your workspace account and complete your sign-in.
        </p>
        <div style="text-align: center; margin: 32px 0;">
          <a href="${verificationUrl}" style="background-color: #0f766e; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-size: 14px; font-weight: 600; display: inline-block; letter-spacing: 0.5px;">
            VERIFY EMAIL
          </a>
        </div>
        <p style="color: #64748b; font-size: 12px; line-height: 1.5; margin: 24px 0 0;">
          Or copy and paste this verification URL into your browser:<br>
          <a href="${verificationUrl}" style="color: #0d9488; word-break: break-all;">${verificationUrl}</a>
        </p>
        <div style="margin-top: 32px; padding-top: 20px; border-top: 1px solid #f1f5f9; color: #94a3b8; font-size: 12px;">
          <p style="margin: 0 0 8px;">⏳ <strong>Notice:</strong> This verification link will expire in 24 hours.</p>
          <p style="margin: 0;">If you did not request this account registration, you can safely ignore this message.</p>
        </div>
      </td>
    </tr>
  </table>
</body>
</html>
`;

  try {
    if (emailStatus.provider === 'smtp') {
      const port = Number(process.env.SMTP_PORT) || 587;
      const isSecure = process.env.SMTP_SECURE === 'true' || port === 465;

      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port,
        secure: isSecure,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASSWORD,
        },
      });

      await transporter.sendMail({
        from: emailFrom,
        to: toEmail,
        subject,
        text: textContent,
        html: htmlContent,
      });

      return {
        success: true,
        providerConfigured: true,
        provider: 'smtp',
        code: 'EMAIL_SENT',
        statusMessage: 'Verification email sent. Please check your inbox.',
      };
    } else if (emailStatus.provider === 'resend') {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: emailFrom,
          to: [toEmail],
          subject,
          text: textContent,
          html: htmlContent,
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Resend API returned status ${res.status}: ${errText}`);
      }

      return {
        success: true,
        providerConfigured: true,
        provider: 'resend',
        code: 'EMAIL_SENT',
        statusMessage: 'Verification email sent. Please check your inbox.',
      };
    }

    return {
      success: false,
      providerConfigured: false,
      provider: 'none',
      code: 'EMAIL_PROVIDER_NOT_CONFIGURED',
      statusMessage: 'Registration created, but email delivery is not configured.',
    };
  } catch (err: any) {
    console.error('[ASTRA AUTH] Real email delivery failed:', err);
    return {
      success: false,
      providerConfigured: true,
      provider: emailStatus.provider,
      code: 'EMAIL_DELIVERY_FAILED',
      error: err.message,
      statusMessage: 'Unable to send verification email. Please try again.',
    };
  }
}
