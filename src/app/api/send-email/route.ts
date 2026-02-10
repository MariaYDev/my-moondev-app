import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { to, name, decision, feedback } = await request.json();

    if (!to || !name || !decision || !feedback) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const apiKey = process.env.MAILJET_API_KEY;
    const secretKey = process.env.MAILJET_SECRET_KEY;
    const fromEmail = process.env.MAILJET_FROM_EMAIL || 'mariayoussef61@gmail.com';
    const fromName = process.env.MAILJET_FROM_NAME || 'Maria Youssef';

    if (!apiKey || !secretKey) {
      console.error('Mailjet credentials not configured');
      return NextResponse.json(
        { error: 'Email service not configured' },
        { status: 500 }
      );
    }

    const subject =
      decision === 'accepted'
        ? '🎉 Welcome to MoonDev!'
        : 'MoonDev Internship Application Update';

    const htmlContent =
      decision === 'accepted'
        ? `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #9333ea 0%, #ec4899 100%); color: white; padding: 40px 20px; text-align: center; border-radius: 10px 10px 0 0; }
    .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
    .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
    .button { display: inline-block; background: #9333ea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎉 Congratulations, ${name}!</h1>
    </div>
    <div class="content">
      <p>Hi ${name},</p>
      <p>We're thrilled to inform you that you've been accepted into the MoonDev Internship Program 2026!</p>
      <p><strong>Evaluator Feedback:</strong></p>
      <p style="background: white; padding: 15px; border-left: 4px solid #9333ea; margin: 20px 0;">${feedback}</p>
      <p>We were impressed by your submission and believe you'll be a great addition to our team. We'll be in touch soon with next steps and onboarding information.</p>
      <p>Welcome aboard! 🚀</p>
    </div>
    <div class="footer">
      <p>© 2026 MoonDev. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
`
        : `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #6b7280 0%, #374151 100%); color: white; padding: 40px 20px; text-align: center; border-radius: 10px 10px 0 0; }
    .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
    .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>MoonDev Internship Application Update</h1>
    </div>
    <div class="content">
      <p>Hi ${name},</p>
      <p>Thank you for taking the time to apply to the MoonDev Internship Program 2026. We appreciate your interest in joining our team.</p>
      <p>After careful review, we've decided not to move forward with your application at this time.</p>
      <p><strong>Evaluator Feedback:</strong></p>
      <p style="background: white; padding: 15px; border-left: 4px solid #6b7280; margin: 20px 0;">${feedback}</p>
      <p>We encourage you to continue developing your skills and to apply again in the future. We wish you the best in your career journey.</p>
      <p>Best regards,<br>The MoonDev Team</p>
    </div>
    <div class="footer">
      <p>© 2026 MoonDev. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
`;

    const textContent =
      decision === 'accepted'
        ? `Congratulations, ${name}!\n\nWe're thrilled to inform you that you've been accepted into the MoonDev Internship Program 2026!\n\nEvaluator Feedback:\n${feedback}\n\nWe were impressed by your submission and believe you'll be a great addition to our team. We'll be in touch soon with next steps.\n\nWelcome aboard!\n\n© 2026 MoonDev`
        : `Hi ${name},\n\nThank you for applying to the MoonDev Internship Program 2026.\n\nAfter careful review, we've decided not to move forward with your application at this time.\n\nEvaluator Feedback:\n${feedback}\n\nWe encourage you to continue developing your skills and to apply again in the future.\n\nBest regards,\nThe MoonDev Team\n\n© 2026 MoonDev`;

    // Send email via Mailjet
    const response = await fetch('https://api.mailjet.com/v3.1/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization:
          'Basic ' + Buffer.from(`${apiKey}:${secretKey}`).toString('base64'),
      },
      body: JSON.stringify({
        Messages: [
          {
            From: {
              Email: fromEmail,
              Name: fromName,
            },
            To: [
              {
                Email: to,
                Name: name,
              },
            ],
            Subject: subject,
            TextPart: textContent,
            HTMLPart: htmlContent,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Mailjet error:', errorData);
      throw new Error('Failed to send email');
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Email sending error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to send email' },
      { status: 500 }
    );
  }
}