import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const DASHBOARD_APP_ID = '69d57633cdc86dba45d18ca2';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};

    // Allow webhook calls via shared secret OR authenticated users
    const secret = body.secret || new URL(req.url).searchParams.get('secret');
    const expectedSecret = Deno.env.get('REBEL_SYNC_SECRET');
    const secretMatch = expectedSecret && secret === expectedSecret;

    if (!secretMatch) {
      const user = await base44.auth.me().catch(() => null);
      if (!user) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    // Fetch all Deployment records from the Dashboard app via Base44 cross-app API
    const deploymentRecords = await fetchDeployments(base44);

    if (!deploymentRecords || !deploymentRecords.length) {
      return Response.json({ error: 'No deployment records found in Dashboard app' }, { status: 404 });
    }

    // Load all existing properties and staff from this app
    const existingProperties = await base44.asServiceRole.entities.Property.list('name', 500);
    const existingStaff = await base44.asServiceRole.entities.Staff.list('name', 1000);

    let propertiesUpserted = 0;
    let staffUpserted = 0;
    let propertiesDeactivated = 0;
    let staffDeactivated = 0;

    // Build a set of str_ids seen in this sync
    const seenStrIds = new Set();
    const seenStaffKeys = new Set(); // "name|propertyId|role"

    // Build lookup maps
    const propByStrId = {};
    const propByName = {};
    existingProperties.forEach(p => {
      if (p.str_id) propByStrId[p.str_id] = p;
      propByName[p.name] = p;
    });

    // --- Upsert Properties ---
    for (const rec of deploymentRecords) {
      const propertyPayload = mapDeploymentToProperty(rec);
      if (!propertyPayload.name) continue;

      let existing = null;
      if (propertyPayload.str_id) existing = propByStrId[propertyPayload.str_id];
      if (!existing) existing = propByName[propertyPayload.name];

      if (existing) {
        await base44.asServiceRole.entities.Property.update(existing.id, { ...propertyPayload, is_active: true });
        // Update local lookup in case we match by name later for staff
        propByStrId[propertyPayload.str_id || existing.str_id] = { ...existing, ...propertyPayload };
        propByName[propertyPayload.name] = { ...existing, id: existing.id };
      } else {
        const created = await base44.asServiceRole.entities.Property.create({ ...propertyPayload, is_active: true });
        propByName[propertyPayload.name] = created;
        if (propertyPayload.str_id) propByStrId[propertyPayload.str_id] = created;
      }
      propertiesUpserted++;
      if (propertyPayload.str_id) seenStrIds.add(propertyPayload.str_id);
    }

    // Deactivate properties no longer in deployment (matched by str_id only)
    for (const p of existingProperties) {
      if (p.str_id && !seenStrIds.has(p.str_id) && p.is_active !== false) {
        await base44.asServiceRole.entities.Property.update(p.id, { is_active: false });
        propertiesDeactivated++;
      }
    }

    // --- Upsert Staff ---
    for (const rec of deploymentRecords) {
      const staffList = mapDeploymentToStaff(rec, propByName);
      for (const staffPayload of staffList) {
        if (!staffPayload.name || !staffPayload.property_id) continue;

        const key = `${staffPayload.name}|${staffPayload.property_id}|${staffPayload.role || ''}`;
        seenStaffKeys.add(key);

        const existing = existingStaff.find(s =>
          s.name === staffPayload.name &&
          s.property_id === staffPayload.property_id &&
          (s.role || '') === (staffPayload.role || '')
        );

        if (existing) {
          await base44.asServiceRole.entities.Staff.update(existing.id, { ...staffPayload, is_active: true });
        } else {
          await base44.asServiceRole.entities.Staff.create({ ...staffPayload, is_active: true });
        }
        staffUpserted++;
      }
    }

    // Deactivate staff no longer in deployment
    for (const s of existingStaff) {
      const key = `${s.name}|${s.property_id}|${s.role || ''}`;
      if (!seenStaffKeys.has(key) && s.is_active !== false) {
        await base44.asServiceRole.entities.Staff.update(s.id, { is_active: false });
        staffDeactivated++;
      }
    }

    // Write sync log
    await base44.asServiceRole.entities.SyncLog.create({
      synced_at: new Date().toISOString(),
      source: body.source || 'manual',
      properties_upserted: propertiesUpserted,
      staff_upserted: staffUpserted,
      properties_deactivated: propertiesDeactivated,
      staff_deactivated: staffDeactivated,
      status: 'success',
    });

    return Response.json({
      success: true,
      properties_upserted: propertiesUpserted,
      staff_upserted: staffUpserted,
      properties_deactivated: propertiesDeactivated,
      staff_deactivated: staffDeactivated,
    });
  } catch (error) {
    // Try to log the error
    try {
      const base44 = createClientFromRequest(req);
      await base44.asServiceRole.entities.SyncLog.create({
        synced_at: new Date().toISOString(),
        source: 'manual',
        status: 'error',
        error_message: error.message,
      });
    } catch (_) { /* ignore log errors */ }

    return Response.json({ error: error.message }, { status: 500 });
  }
});

async function fetchDeployments(base44) {
  // Use Base44 cross-app API to read Deployment entity from the Dashboard app
  const response = await fetch(
    `https://api.base44.com/api/apps/${DASHBOARD_APP_ID}/entities/Deployment/query`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': Deno.env.get('BASE44_SERVICE_API_KEY') || '',
        'Authorization': `Bearer ${Deno.env.get('BASE44_SERVICE_API_KEY') || ''}`,
      },
      body: JSON.stringify({ limit: 500 }),
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Dashboard API error ${response.status}: ${text}`);
  }

  const json = await response.json();
  // Base44 entity list responses are typically an array or { items: [] }
  return Array.isArray(json) ? json : (json.items || json.data || []);
}

function mapDeploymentToProperty(rec) {
  return {
    str_id: rec.str_id || rec.id || null,
    name: rec.hotel_name || rec.name || rec.property_name || null,
    parent_brand: rec.parent_brand || rec.brand || null,
    sub_brand: rec.sub_brand || null,
    city: rec.city || null,
    state: rec.state || null,
    gm_name: rec.gm_name || rec.general_manager || null,
    lead_type: rec.lead_type || null,
    department: rec.department || null,
  };
}

function mapDeploymentToStaff(rec, propByName) {
  const staffList = [];
  const propertyName = rec.hotel_name || rec.name || rec.property_name;
  const property = propByName[propertyName];
  if (!property) return staffList;

  const year = rec.year || new Date().getFullYear();

  // Each deployment record may have multiple staff fields
  const staffFields = [
    { nameField: 'gm_name', role: 'General Manager' },
    { nameField: 'agm_name', role: 'AGM' },
    { nameField: 'dos_name', role: 'Director of Sales' },
    { nameField: 'fd_name', role: 'Front Desk Manager' },
    { nameField: 'hk_name', role: 'Housekeeping Manager' },
    { nameField: 'fb_name', role: 'F&B Manager' },
    { nameField: 'maintenance_name', role: 'Maintenance Manager' },
    { nameField: 'controller_name', role: 'Controller' },
  ];

  // Also handle array-style staff if present
  if (Array.isArray(rec.staff)) {
    for (const s of rec.staff) {
      if (!s.name) continue;
      staffList.push({
        name: s.name,
        role: s.role || s.title || s.job_title || null,
        property_id: property.id,
        year,
        salary_q1: s.salary_q1 || null,
        salary_q2: s.salary_q2 || null,
        salary_q3: s.salary_q3 || null,
        salary_q4: s.salary_q4 || null,
      });
    }
    return staffList;
  }

  // Flat-field style
  for (const { nameField, role } of staffFields) {
    if (rec[nameField]) {
      staffList.push({
        name: rec[nameField],
        role,
        property_id: property.id,
        year,
      });
    }
  }

  return staffList;
}