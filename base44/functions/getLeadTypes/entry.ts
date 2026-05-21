import { createClientFromRequest, createClient } from 'npm:@base44/sdk@0.8.25';

const LEADERSHIP_FIELDS = [
  'corporate_operations', 'corporate_finance', 'corporate_hr', 'corporate_revenue',
  'corporate_sales', 'corporate_ecommerce', 'property_gm', 'property_dof',
  'property_hrd', 'property_dorm', 'property_dosm', 'property_doe',
];

const EXCLUDED_VALUES = new Set(['n/a', 'brand support', '']);

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const apiKey = Deno.env.get('BASE44_SERVICE_API_KEY');
    const dashboardClient = createClient({
      appId: '69d57633cdc86dba45d18ca2',
      token: apiKey,
    });

    const deployments = await dashboardClient.entities.Deployment.list('name', 500);

    // Collect all unique names across all 12 leadership fields
    const allNames = new Set();
    deployments.forEach(d => {
      LEADERSHIP_FIELDS.forEach(field => {
        const val = d[field];
        if (val && !EXCLUDED_VALUES.has(val.trim().toLowerCase())) {
          allNames.add(val.trim());
        }
      });
    });

    const leadTypes = [...allNames].sort();

    // Build strId -> array of people in any leadership field
    // For filtering: strId -> Set of all person names on that deployment
    const strIdToLeads = {};
    deployments.forEach(d => {
      if (!d.str_id) return;
      const people = new Set();
      LEADERSHIP_FIELDS.forEach(field => {
        const val = d[field];
        if (val && !EXCLUDED_VALUES.has(val.trim().toLowerCase())) {
          people.add(val.trim());
        }
      });
      strIdToLeads[d.str_id] = [...people];
    });

    return Response.json({ leadTypes, strIdToLeads });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});