import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Find and delete any Supervisor job classification
    const allJobs = await base44.asServiceRole.entities.JobClassification.list('title', 100);
    const supervisor = allJobs.find(j => j.title.toLowerCase().includes('supervisor'));

    if (supervisor) {
      await base44.asServiceRole.entities.JobClassification.delete(supervisor.id);
      return Response.json({ message: 'Supervisor removed', deleted_id: supervisor.id });
    }

    return Response.json({ message: 'No supervisor found' });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});