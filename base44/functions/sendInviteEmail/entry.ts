import { createClientFromRequest } from 'npm:@base44/sdk@0.8.39';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { email, full_name, hotel_names, app_url } = await req.json();

    if (!email) {
      return Response.json({ error: 'Missing email' }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();

    // Invite the user to the app via Base44's built-in invite system (creates account + sends email)
    // Always invite as 'user' role — admin role must be assigned manually
    try {
      await base44.users.inviteUser(cleanEmail, 'user');
      return Response.json({ success: true });
    } catch (inviteError) {
      // If the error is NOT "already exists", it's a real failure
      const msg = inviteError.message || '';
      if (!msg.includes('already') && !msg.includes('exists')) {
        throw inviteError;
      }
      // User already has a platform account (e.g. was previously invited).
      // The platform won't re-send the invite email, so send a custom one
      // with a LOGIN link so they don't hit the "already exists" signup error.
      const hotelList = Array.isArray(hotel_names) && hotel_names.length > 0
        ? hotel_names.join(', ')
        : 'all properties';

      const body = [
        `<div style="font-family: Inter, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">`,
        `<div style="background: linear-gradient(135deg, #2d4b5e 0%, #1e3547 100%); border-radius: 16px; padding: 28px; margin-bottom: 24px;">`,
        `<h1 style="color: #fff; font-size: 22px; margin: 0;">REBEL Hotel Scorecard</h1>`,
        `<p style="color: rgba(255,255,255,0.7); font-size: 13px; margin: 4px 0 0;">You have been invited to access the Balanced Scorecard</p>`,
        `</div>`,
        `<p style="color: #334155; font-size: 15px;">Hi ${full_name || 'there'},</p>`,
        `<p style="color: #334155; font-size: 15px;">You have been granted access to the REBEL Hotel Performance Scorecard for <strong>${hotelList}</strong>.</p>`,
        `<p style="color: #334155; font-size: 15px;">Your account is already set up — just click below to <strong>log in</strong>:</p>`,
        `<a href="${app_url}" style="display: inline-block; background: #2d4b5e; color: #fff; font-weight: 600; font-size: 15px; padding: 12px 28px; border-radius: 10px; text-decoration: none; margin: 16px 0;">Log In to Scorecard</a>`,
        `<p style="color: #64748b; font-size: 13px; margin-top: 24px;">If the button doesn't work, copy and paste this link into your browser:<br/><a href="${app_url}" style="color: #2d4b5e;">${app_url}</a></p>`,
        `<hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />`,
        `<p style="color: #94a3b8; font-size: 12px;">If you did not expect this email, please disregard it.</p>`,
        `</div>`
      ].join('');

      await base44.integrations.Core.SendEmail({
        to: cleanEmail,
        subject: 'Your REBEL Hotel Scorecard Access',
        body
      });

      return Response.json({ success: true, alreadyExists: true });
    }
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});