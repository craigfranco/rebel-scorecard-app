import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const body = await req.json();
    const { secret, entity, event, data } = body;

    // Validate shared secret
    const expectedSecret = Deno.env.get("REBEL_SYNC_SECRET");
    if (!secret || secret !== expectedSecret) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!entity || !event || !data) {
      return Response.json({ error: 'Missing required fields: entity, event, data' }, { status: 400 });
    }

    const base44 = createClientFromRequest(req);

    if (entity === 'property') {
      await syncProperty(base44, event, data);
    } else if (entity === 'staff') {
      await syncStaff(base44, event, data);
    } else {
      return Response.json({ error: `Unknown entity: ${entity}` }, { status: 400 });
    }

    return Response.json({ success: true, entity, event });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

async function syncProperty(base44, event, data) {
  // Map REBEL property fields to this app's Property schema
  const propertyData = {
    name: data.name || data.hotel_name,
    parent_brand: data.parent_brand || data.brand,
    sub_brand: data.sub_brand,
    city: data.city,
    state: data.state,
    gm_name: data.gm_name || data.general_manager,
    is_active: data.is_active !== undefined ? data.is_active : true,
  };

  // Remove undefined fields
  Object.keys(propertyData).forEach(k => propertyData[k] === undefined && delete propertyData[k]);

  if (event === 'delete') {
    // Find and delete by name
    const existing = await base44.asServiceRole.entities.Property.filter({ name: propertyData.name });
    if (existing.length > 0) {
      await base44.asServiceRole.entities.Property.delete(existing[0].id);
    }
    return;
  }

  // Find existing property by name to upsert
  const existing = await base44.asServiceRole.entities.Property.filter({ name: propertyData.name });
  if (existing.length > 0) {
    await base44.asServiceRole.entities.Property.update(existing[0].id, propertyData);
  } else {
    await base44.asServiceRole.entities.Property.create(propertyData);
  }
}

async function syncStaff(base44, event, data) {
  // Resolve property by name if property_name provided instead of property_id
  let propertyId = data.property_id;
  if (!propertyId && data.property_name) {
    const props = await base44.asServiceRole.entities.Property.filter({ name: data.property_name });
    if (props.length > 0) propertyId = props[0].id;
  }

  // Resolve job classification by title if needed
  let jobClassId = data.job_classification_id;
  if (!jobClassId && data.job_title) {
    const classes = await base44.asServiceRole.entities.JobClassification.filter({ title: data.job_title });
    if (classes.length > 0) jobClassId = classes[0].id;
  }

  const staffData = {
    name: data.name,
    property_id: propertyId,
    job_classification_id: jobClassId,
    salary_q1: data.salary_q1,
    salary_q2: data.salary_q2,
    salary_q3: data.salary_q3,
    salary_q4: data.salary_q4,
    year: data.year || new Date().getFullYear(),
    is_active: data.is_active !== undefined ? data.is_active : true,
  };

  Object.keys(staffData).forEach(k => staffData[k] === undefined && delete staffData[k]);

  if (event === 'delete') {
    const existing = await base44.asServiceRole.entities.Staff.filter({ name: staffData.name, property_id: propertyId });
    if (existing.length > 0) {
      await base44.asServiceRole.entities.Staff.delete(existing[0].id);
    }
    return;
  }

  // Upsert by name + property_id + year
  const filter = { name: staffData.name };
  if (propertyId) filter.property_id = propertyId;
  if (staffData.year) filter.year = staffData.year;

  const existing = await base44.asServiceRole.entities.Staff.filter(filter);
  if (existing.length > 0) {
    await base44.asServiceRole.entities.Staff.update(existing[0].id, staffData);
  } else {
    await base44.asServiceRole.entities.Staff.create(staffData);
  }
}