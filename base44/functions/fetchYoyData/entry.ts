import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const DASHBOARD_APP_ID = '69d57633cdc86dba45d18ca2';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Discovery mode: try known entity names and return first few records
    const dashboardClient = createClientFromRequest(req, { appId: DASHBOARD_APP_ID });
    
    const candidates = [
      'HotelMonthly', 'hotelmonthly', 'hotel_monthly', 'HotelData', 'MonthlyData',
      'RevenuePLData', 'RevenuePL', 'PLData', 'revenue_pl_data', 'FinancialData',
      'STRData', 'StrData', 'RpiData', 'RevparData',
    ];
    
    const results = {};
    for (const name of candidates) {
      try {
        const data = await dashboardClient.asServiceRole.entities[name].list('id', 2);
        results[name] = { found: true, sample: data[0] || null };
      } catch (e) {
        results[name] = { found: false, error: e.message };
      }
    }
    
    return Response.json({ results });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});