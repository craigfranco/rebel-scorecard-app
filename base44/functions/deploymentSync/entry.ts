import { createClientFromRequest, createClient } from 'npm:@base44/sdk@0.8.25';

/**
 * deploymentSync - Receives property/staff data pushed from the Dashboard app
 * or called manually by an authenticated user (with no payload = dry run / status check).
 *
 * POST body:
 *   {
 *     secret: string,           // optional shared secret for server-to-server calls
 *     source: string,           // 'manual' | 'dashboard' | etc.
 *     properties: Property[],   // array of property records to upsert
 *     staff: Staff[],           // optional array of staff records to upsert
 *   }
 *
 * Each property record shape:
 *   { str_id, name, parent_brand, sub_brand, city, state, gm_name, lead_type, department }
 *
 * Each staff record shape:
 *   { name, role, property_str_id (or property_name), year, salary_q1..q4 }
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};

    // Auth: authenticated user OR shared secret
    const secret = body.secret;
    const expectedSecret = Deno.env.get('BASE44_SERVICE_API_KEY');
    const secretMatch = expectedSecret && secret === expectedSecret;

    let isAuthedUser = false;
    if (!secretMatch) {
      const user = await base44.auth.me().catch(() => null);
      if (!user) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
      }
      isAuthedUser = true;
    }

    // PULL MODE: fetch the latest deployments from the Dashboard app
    if (body.pull === true && (secretMatch || isAuthedUser)) {
      const apiKey = Deno.env.get('BASE44_SERVICE_API_KEY');
      const dashboardClient = createClient({
        appId: '69d57633cdc86dba45d18ca2',
        token: apiKey,
      });
      const deployments = await dashboardClient.entities.Deployment.list('name', 500);

      body.properties = deployments.map(d => ({
        str_id: d.str_id || null,
        name: d.name || d.hotel_name || d.property_name || null,
        parent_brand: d.parent_brand || d.brand || null,
        sub_brand: d.sub_brand || null,
        city: d.city || null,
        state: d.state || null,
        gm_name: d.property_gm || d.gm_name || d.general_manager || null,
        lead_type: d.lead_type || null,
        department: d.department || null,
      })).filter(p => p.name);
      body.source = 'dashboard_pull';
    }

    const incomingProperties = body.properties || [];
    const incomingStaff = body.staff || [];
    const source = body.source || 'manual';

    // If no data provided, return current sync status
    if (!incomingProperties.length && !incomingStaff.length) {
      const syncLogs = await base44.asServiceRole.entities.SyncLog.list('-synced_at', 1);
      return Response.json({ status: 'ok', last_sync: syncLogs[0] || null });
    }

    // Load existing records
    const existingProperties = await base44.asServiceRole.entities.Property.list('name', 500);
    const existingStaff = await base44.asServiceRole.entities.Staff.list('name', 1000);
    const existingEntries = await base44.asServiceRole.entities.ScoreEntry.filter({ year: new Date().getFullYear() }, undefined, 500);

    // --- Deduplicate existing properties (same str_id or same normalized name) ---
    // Keeps the property that has score entries; moves staff/docs to it; deactivates the rest.
    const entryCountByProp = {};
    existingEntries.forEach(e => { entryCountByProp[e.property_id] = (entryCountByProp[e.property_id] || 0) + 1; });
    const propGroups = {};
    existingProperties.forEach(p => {
      const key = (p.str_id || p.name || '').toString().toLowerCase().trim();
      if (!key) return;
      if (!propGroups[key]) propGroups[key] = [];
      propGroups[key].push(p);
    });
    let dedupMerged = 0;
    for (const key of Object.keys(propGroups)) {
      const group = propGroups[key];
      if (group.length <= 1) continue;
      // canonical = property with the most score entries (fallback: the active one)
      const canonical = group.slice().sort((a, b) =>
        (entryCountByProp[b.id] || 0) - (entryCountByProp[a.id] || 0)
      )[0];
      for (const p of group) {
        if (p.id === canonical.id) continue;
        // Move staff to canonical
        const dupStaff = existingStaff.filter(s => s.property_id === p.id);
        for (const s of dupStaff) {
          const dup = existingStaff.find(x => x.property_id === canonical.id && x.name === s.name && (x.year || 0) === (s.year || 0));
          if (dup) continue;
          await base44.asServiceRole.entities.Staff.update(s.id, { property_id: canonical.id });
          s.property_id = canonical.id;
        }
        await base44.asServiceRole.entities.Property.update(p.id, { is_active: false });
        dedupMerged++;
      }
    }

    let propertiesUpserted = 0;
    let staffUpserted = 0;
    let propertiesDeactivated = 0;
    let staffDeactivated = 0;

    const seenStrIds = new Set();
    const seenStaffKeys = new Set();

    // Build lookups — normalize names to lowercase for case-insensitive matching
    const propByStrId = {};
    const propByNameLower = {};
    existingProperties.forEach(p => {
      if (p.str_id) propByStrId[p.str_id] = p;
      propByNameLower[p.name.toLowerCase()] = p;
    });

    // --- Upsert Properties ---
    for (const rec of incomingProperties) {
      const payload = {
        str_id: rec.str_id || null,
        name: rec.name || rec.hotel_name || rec.property_name || null,
        parent_brand: rec.parent_brand || rec.brand || null,
        sub_brand: rec.sub_brand || null,
        city: rec.city || null,
        state: rec.state || null,
        gm_name: rec.gm_name || rec.general_manager || null,
        lead_type: rec.lead_type || null,
        department: rec.department || null,
        is_active: true,
      };
      if (!payload.name) continue;

      // Match by str_id first, then case-insensitive name
      let existing = (payload.str_id && propByStrId[payload.str_id])
        || propByNameLower[payload.name.toLowerCase()];

      if (existing) {
        await base44.asServiceRole.entities.Property.update(existing.id, payload);
        const updated = { ...existing, ...payload, id: existing.id };
        propByNameLower[payload.name.toLowerCase()] = updated;
        if (payload.str_id) propByStrId[payload.str_id] = updated;
      } else {
        const created = await base44.asServiceRole.entities.Property.create(payload);
        propByNameLower[payload.name.toLowerCase()] = created;
        if (payload.str_id) propByStrId[payload.str_id] = created;
      }
      propertiesUpserted++;
      if (payload.str_id) seenStrIds.add(payload.str_id);
    }

    // Deactivate properties no longer in incoming set (by str_id only)
    for (const p of existingProperties) {
      if (p.str_id && !seenStrIds.has(p.str_id) && p.is_active !== false) {
        await base44.asServiceRole.entities.Property.update(p.id, { is_active: false });
        propertiesDeactivated++;
      }
    }

    // --- Upsert Staff ---
    for (const rec of incomingStaff) {
      const propertyName = rec.property_name || rec.hotel_name;
      const property = (rec.property_str_id && propByStrId[rec.property_str_id])
        || (propertyName && propByNameLower[propertyName.toLowerCase()]);
      if (!property || !rec.name) continue;

      const payload = {
        name: rec.name,
        role: rec.role || rec.title || null,
        property_id: property.id,
        job_classification_id: rec.job_classification_id || null,
        year: rec.year || new Date().getFullYear(),
        salary_q1: rec.salary_q1 || null,
        salary_q2: rec.salary_q2 || null,
        salary_q3: rec.salary_q3 || null,
        salary_q4: rec.salary_q4 || null,
        is_active: true,
      };

      const key = `${payload.name}|${payload.property_id}|${payload.role || ''}|${payload.year}`;
      seenStaffKeys.add(key);

      const existing = existingStaff.find(s =>
        s.name === payload.name &&
        s.property_id === payload.property_id &&
        (s.role || '') === (payload.role || '') &&
        s.year === payload.year
      );

      if (existing) {
        await base44.asServiceRole.entities.Staff.update(existing.id, payload);
      } else {
        await base44.asServiceRole.entities.Staff.create(payload);
      }
      staffUpserted++;
    }

    // Deactivate staff no longer in incoming set (only when staff are being synced)
    if (incomingStaff.length > 0) {
      for (const s of existingStaff) {
        const key = `${s.name}|${s.property_id}|${s.role || ''}|${s.year}`;
        if (!seenStaffKeys.has(key) && s.is_active !== false) {
          await base44.asServiceRole.entities.Staff.update(s.id, { is_active: false });
          staffDeactivated++;
        }
      }
    }

    // Write sync log
    await base44.asServiceRole.entities.SyncLog.create({
      synced_at: new Date().toISOString(),
      source,
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
    try {
      const base44 = createClientFromRequest(req);
      await base44.asServiceRole.entities.SyncLog.create({
        synced_at: new Date().toISOString(),
        source: 'error',
        status: 'error',
        error_message: error.message,
      });
    } catch (_) { /* ignore */ }

    return Response.json({ error: error.message }, { status: 500 });
  }
});