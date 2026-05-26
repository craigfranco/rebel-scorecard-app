import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

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

    const hotelsList = hotel_names && hotel_names.length > 0
      ? `You have been assigned to: ${hotel_names.join(', ')}.`
      : 'Your access covers all properties.';

    const body = `Hi ${full_name || email},

You've been given access to the REBEL Hotel Performance Scorecard.

${hotelsList}

To get started, click the link below to set up your password and log in:
${app_url}

— The REBEL Hotel Co. Team`;

    await base44.asServiceRole.integrations.Core.SendEmail({
      to: email,
      subject: "You've been invited to the REBEL Hotel Scorecard",
      body,
      from_name: 'REBEL Hotel Co.',
    });

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});