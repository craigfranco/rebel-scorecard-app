import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Leadership fields stored on the local Property entity (populated via the
// deployment roster upload). Previously these lived on a separate Dashboard
// app's Deployment entity, which is no longer available.
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

    // Read leadership assignments straight from this app's Property records.
    const properties = await base44.asServiceRole.entities.Property.list('name', 500);

    // strIdToLeads: { str_id: [personName, ...] } — all people on that deployment
    const strIdToLeads = {};

    // fieldToPersonStrIds: { fieldName: { personName: [str_id, ...] } }
    const fieldToPersonStrIds = {};
    LEADERSHIP_FIELDS.forEach((f) => { fieldToPersonStrIds[f] = {}; });

    properties.forEach((p) => {
      if (!p.str_id) return;
      const people = new Set();
      LEADERSHIP_FIELDS.forEach((field) => {
        const raw = p[field];
        const val = raw ? String(raw).trim() : '';
        if (!val || EXCLUDED_VALUES.has(val.toLowerCase())) return;
        people.add(val);
        if (!fieldToPersonStrIds[field][val]) fieldToPersonStrIds[field][val] = [];
        fieldToPersonStrIds[field][val].push(p.str_id);
      });
      strIdToLeads[p.str_id] = [...people];
    });

    return Response.json({ strIdToLeads, fieldToPersonStrIds });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});