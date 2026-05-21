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

    // strIdToLeads: { str_id: [personName, ...] } — all people on that deployment
    const strIdToLeads = {};

    // fieldToPersonStrIds: { fieldName: { personName: [str_id, ...] } }
    const fieldToPersonStrIds = {};
    LEADERSHIP_FIELDS.forEach(f => { fieldToPersonStrIds[f] = {}; });

    deployments.forEach(d => {
      if (!d.str_id) return;
      const people = new Set();
      LEADERSHIP_FIELDS.forEach(field => {
        const raw = d[field];
        const val = raw ? raw.trim() : '';
        if (!val || EXCLUDED_VALUES.has(val.toLowerCase())) return;
        people.add(val);
        if (!fieldToPersonStrIds[field][val]) fieldToPersonStrIds[field][val] = [];
        fieldToPersonStrIds[field][val].push(d.str_id);
      });
      strIdToLeads[d.str_id] = [...people];
    });

    return Response.json({ strIdToLeads, fieldToPersonStrIds });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});