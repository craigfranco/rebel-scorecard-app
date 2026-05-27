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

    // Invite the user to the app via Base44's built-in invite system (creates account + sends email)
    // Always invite as 'user' role — admin role must be assigned manually
    await base44.users.inviteUser(email, 'user');

    return Response.json({ success: true });
  } catch (error) {
    // If user already exists in the system, that's fine — treat as success
    if (error.message?.includes('already') || error.message?.includes('exists')) {
      return Response.json({ success: true });
    }
    return Response.json({ error: error.message }, { status: 500 });
  }
});