export function otpTemplate(params: {
  fullName: string;
  otp: string;
  ttlMinutes: number;
}): { subject: string; html: string; text: string } {
  const { fullName, otp, ttlMinutes } = params;

  const subject = `Your verification code: ${otp}`;

  const text = `Hi ${fullName},

Your verification code is: ${otp}

This code expires in ${ttlMinutes} minutes.
If you did not request this, please ignore this email.`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
      <h2>Hi ${fullName},</h2>
      <p>Your verification code is:</p>
      <div style="font-size: 32px; font-weight: bold; letter-spacing: 8px;
                  background: #f4f4f4; padding: 16px; text-align: center;
                  border-radius: 8px; margin: 20px 0;">
        ${otp}
      </div>
      <p>This code expires in <strong>${ttlMinutes} minutes</strong>.</p>
      <p style="color: #888; font-size: 12px;">
        If you did not request this, please ignore this email.
      </p>
    </div>
  `;

  return { subject, html, text };
}