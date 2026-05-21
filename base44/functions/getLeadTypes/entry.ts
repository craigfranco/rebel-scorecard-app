import { createClientFromRequest, createClient } from 'npm:@base44/sdk@0.8.25';

/**
 * Fetches distinct corporate_operations values from the Dashboard app's Deployment entity.
 * Dashboard app ID: 69d57633cdc86dba45d18ca2
 * Returns: { leadTypes: string[], strIdToLead: { [str_id]: corporate_operations } }
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Connect to the Dashboard app using service API key
    const apiKey = Deno.env.get('BASE44_SERVICE_API_KEY');
    const dashboardClient = createClient({
      appId: '69d57633cdc86dba45d18ca2',
      token: apiKey,
    });

    const deployments = await dashboardClient.entities.Deployment.list('name', 500);

    const leadTypes = [...new Set(
      deployments
        .map(d => d.corporate_operations)
        .filter(Boolean)
    )].sort();

    const strIdToLead = {};
    deployments.forEach(d => {
      if (d.str_id && d.corporate_operations) {
        strIdToLead[d.str_id] = d.corporate_operations;
      }
    });

    return Response.json({ leadTypes, strIdToLead });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});