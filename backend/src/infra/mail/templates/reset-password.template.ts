export function resetPasswordTemplate(params: {
  fullName: string;
  resetLink: string;
  ttlMinutes: number;
}): { subject: string; html: string; text: string } {
  const { fullName, resetLink, ttlMinutes } = params;

  const subject = 'Reset your password';

  const text = `Hi ${fullName},

Click the link below to reset your password:
${resetLink}

This link expires in ${ttlMinutes} minutes.
If you did not request this, please ignore this email.`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
      <h2>Reset your password</h2>
      <p>Hi ${fullName},</p>
      <p>Click the button below to reset your password:</p>
      <div style="text-align: center; margin: 24px 0;">
        <a href="${resetLink}"
           style="background: #0066cc; color: white; padding: 12px 24px;
                  text-decoration: none; border-radius: 6px; display: inline-block;">
          Reset Password
        </a>
      </div>
      <p style="font-size: 12px; color: #888;">
        Or copy this link: ${resetLink}
      </p>
      <p>This link expires in <strong>${ttlMinutes} minutes</strong>.</p>
      <p style="color: #888; font-size: 12px;">
        If you did not request this, please ignore this email.
      </p>
    </div>
  `;

  return { subject, html, text };
}