import React, { useState } from 'react';
import {
  ChevronDown, ChevronRight, LayoutDashboard, ClipboardList,
  Building2, PieChart, DollarSign, Shield, Upload, HelpCircle,
  BookOpen
} from 'lucide-react';

const SECTIONS = [
  {
    id: 'getting-started',
    emoji: '🚀',
    title: 'Getting Started',
    icon: HelpCircle,
    content: <GettingStarted />,
  },
  {
    id: 'dashboard',
    emoji: '📊',
    title: 'Dashboard',
    icon: LayoutDashboard,
    content: <DashboardGuide />,
  },
  {
    id: 'scorecard',
    emoji: '🏨',
    title: 'Hotel Performance Scorecard',
    icon: ClipboardList,
    content: <ScorecardGuide />,
  },
  {
    id: 'kpi-reference',
    emoji: '📐',
    title: 'KPI Reference & Scoring',
    icon: BookOpen,
    content: <KpiReferenceGuide />,
  },
  {
    id: 'all-properties',
    emoji: '🏢',
    title: 'All Properties',
    icon: Building2,
    content: <AllPropertiesGuide />,
  },
  {
    id: 'kpi-breakdown',
    emoji: '🔍',
    title: 'KPI Breakdown',
    icon: PieChart,
    content: <KpiBreakdownGuide />,
  },
  {
    id: 'payouts',
    emoji: '💰',
    title: 'Payouts',
    icon: DollarSign,
    content: <PayoutsGuide />,
  },
  {
    id: 'admin',
    emoji: '👥',
    title: 'Admin & Setup',
    icon: Shield,
    content: <AdminGuide />,
  },
  {
    id: 'data-uploads',
    emoji: '📁',
    title: 'Data Uploads',
    icon: Upload,
    content: <DataUploadsGuide />,
  },
];

function Section({ section }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-border rounded-xl overflow-hidden print:border-gray-300 print:break-inside-avoid">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 bg-slate-50 hover:bg-slate-100 transition-colors text-left print:bg-gray-100"
      >
        <div className="flex items-center gap-3">
          <span className="text-xl leading-none">{section.emoji}</span>
          <span className="font-semibold text-foreground text-base">{section.title}</span>
        </div>
        {open
          ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
          : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
        }
      </button>
      {open && (
        <div className="px-6 py-5 bg-white text-sm text-foreground space-y-4 print:block">
          {section.content}
        </div>
      )}
    </div>
  );
}

function H3({ children }) {
  return <h3 className="font-semibold text-base text-foreground mt-4 mb-1 first:mt-0">{children}</h3>;
}
function P({ children }) {
  return <p className="text-muted-foreground leading-relaxed">{children}</p>;
}
function UL({ children }) {
  return <ul className="list-disc list-inside space-y-1 text-muted-foreground pl-1">{children}</ul>;
}
function LI({ children }) {
  return <li className="leading-relaxed">{children}</li>;
}
function InfoBox({ children }) {
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-blue-800 text-sm">
      {children}
    </div>
  );
}

function GettingStarted() {
  return (
    <>
      <H3>What is this app?</H3>
      <P>The REBEL Hotel Performance Scorecard is a portfolio-wide KPI tracking and bonus management tool. It helps regional leadership and general managers monitor performance across four key measures — Budgeted GOP, GOP Margin Improvement, RGI (RevPAR Index), and GSS (Guest Satisfaction Score) — and calculates quarterly bonus payouts based on performance.</P>

      <H3>Navigating the app</H3>
      <P>Use the left sidebar to move between pages. The main pages are:</P>
      <UL>
        <LI><strong>Dashboard</strong> — Portfolio-level KPI tracker overview (admin only)</LI>
        <LI><strong>Hotel Performance Scorecard</strong> — Property-level scorecard with full KPI detail</LI>
        <LI><strong>All Properties</strong> — Sortable table of all hotels with scores (admin only)</LI>
        <LI><strong>KPI Breakdown</strong> — Detailed KPI definitions and pass/fail logic</LI>
        <LI><strong>Payouts</strong> — Staff bonus calculations per quarter</LI>
        <LI><strong>KPI Reference</strong> — Quick-reference scoring table</LI>
        <LI><strong>Documents</strong> — Upload and manage data files</LI>
        <LI><strong>Admin Panel</strong> — User management and permissions (admin only)</LI>
      </UL>

      <H3>The Period Selector</H3>
      <P>At the top of every page, you can change the time period being viewed. There are four modes:</P>
      <UL>
        <LI><strong>Monthly</strong> — Data for a single month only</LI>
        <LI><strong>Quarterly (QTD)</strong> — Year-to-date within the current quarter (e.g. Q1 = Jan through selected month)</LI>
        <LI><strong>Full Quarter</strong> — All three months of a complete quarter</LI>
        <LI><strong>YTD</strong> — January through the selected month</LI>
      </UL>
      <InfoBox>💡 Changing the period selector updates all KPI calculations and scoring across every page simultaneously.</InfoBox>

      <H3>Filters</H3>
      <P>On pages like All Properties and the Dashboard, you can filter hotels by:</P>
      <UL>
        <LI><strong>Parent Brand</strong> — e.g. Marriott, Hilton, IHG, Choice, Independent</LI>
        <LI><strong>Sub-Brand</strong> — e.g. Courtyard, DoubleTree, Hampton Inn</LI>
        <LI><strong>City / State</strong> — Geographic filters</LI>
        <LI><strong>Lead Type</strong> — Classification from the deployment spreadsheet</LI>
      </UL>
    </>
  );
}

function DashboardGuide() {
  return (
    <>
      <H3>What the Dashboard shows</H3>
      <P>The Dashboard is a portfolio-level view of how all active properties are performing across each KPI. It is only visible to admin users.</P>

      <H3>KPI Tracker Cards</H3>
      <P>Each KPI has its own tracker card showing:</P>
      <UL>
        <LI><strong>Pass / Fail / N/A counts</strong> — how many hotels are passing, failing, or have missing data</LI>
        <LI><strong>Progress bar</strong> — visual representation of portfolio-wide performance</LI>
        <LI><strong>Hotel list</strong> — each hotel's individual status with a colored badge</LI>
      </UL>
      <P>The five KPI trackers are: <strong>Budgeted GOP</strong>, <strong>GOP Margin</strong>, <strong>RGI</strong>, <strong>GSS</strong>, and <strong>Forecast Kicker</strong>.</P>

      <H3>Drilling down</H3>
      <UL>
        <LI>Click any hotel name in a KPI tracker list → jumps to the Hotel Performance Scorecard for that property</LI>
        <LI>Each card shows a summary count (e.g. "12 Pass / 5 Fail / 3 N/A")</LI>
      </UL>

      <H3>GOP Performance Tile</H3>
      <P>A separate tile shows dollar-level GOP data: aggregate actual vs. budget, and prior year comparison. This tile is aggregated across all properties and the selected time period.</P>
    </>
  );
}

function ScorecardGuide() {
  return (
    <>
      <H3>Reading the Scorecard</H3>
      <P>The Hotel Performance Scorecard page shows a row per hotel (or detailed KPI blocks when a single hotel is expanded). Each row includes the four KPIs and a total score.</P>

      <H3>Column meanings</H3>
      <UL>
        <LI><strong>Actual</strong> — The real value achieved in the selected period</LI>
        <LI><strong>Target / Budget</strong> — The budgeted or goal value for the period</LI>
        <LI><strong>LY (Last Year)</strong> — The same metric from the prior year period</LI>
        <LI><strong>Variance</strong> — Difference between Actual and Target/LY</LI>
        <LI><strong>Score</strong> — Points earned for this KPI (0, 7.5, 15, or 35)</LI>
        <LI><strong>Pass / Fail</strong> — Green ✅ if the pass threshold is met, red ❌ if not</LI>
      </UL>

      <H3>Expanding a hotel row</H3>
      <P>Click a hotel name or the expand arrow to open the detailed scorecard for that property. The expanded view shows each KPI in its own card with full context — actual values, thresholds, and notes.</P>

      <H3>Score calculation</H3>
      <UL>
        <LI>Total score is out of 100 (or 85 if GSS data is missing — the threshold scales accordingly)</LI>
        <LI>Pass threshold: 70% of the maximum possible score</LI>
        <LI>A hotel passes overall if its total score ≥ 70 (or ≥ 59.5 when GSS is excluded)</LI>
      </UL>

      <H3>Trend arrows</H3>
      <UL>
        <LI><strong>▲</strong> — Improving vs. prior period</LI>
        <LI><strong>▼</strong> — Declining vs. prior period</LI>
        <LI><strong>→</strong> — Flat / unchanged</LI>
      </UL>

      <H3>PDF Export</H3>
      <P>Use the "Export PDF" button on the scorecard to generate a print-ready PDF of the current hotel's scorecard for the selected period. This is useful for weekly reviews and board reporting.</P>
    </>
  );
}

function KpiReferenceGuide() {
  return (
    <>
      <H3>Official KPI Scoring Table</H3>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ backgroundColor: '#2d4b5e' }}>
              <th className="text-left px-4 py-3 text-white font-semibold">Measure</th>
              <th className="text-center px-4 py-3 text-white font-semibold">Weight</th>
              <th className="text-left px-4 py-3 text-white font-semibold">Target & Scoring</th>
            </tr>
          </thead>
          <tbody>
            {[
              { measure: 'Budgeted GOP', weight: '35%', scoring: '100% or > of budget = 35 pts (binary pass/fail)' },
              { measure: 'GOP Margin Improvement*', weight: '35%', scoring: '0.1%+ improvement vs LY = 35 pts (binary pass/fail)' },
              { measure: 'RGI Improvement**', weight: '15%', scoring: '0.1–2.0% vs LY = 7.5 pts (partial)\n2.1%+ vs LY = 15 pts (full pass)' },
              { measure: 'GSS Improvement', weight: '15%', scoring: 'Any YOY improvement (TY > LY after normalization) = 15 pts' },
            ].map((row, i) => (
              <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                <td className="px-4 py-3 font-medium text-foreground">{row.measure}</td>
                <td className="px-4 py-3 text-center font-bold text-primary">{row.weight}</td>
                <td className="px-4 py-3 text-muted-foreground whitespace-pre-line">{row.scoring}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground mt-2">* GOP Margin: avg of monthly (actual − prior) ≥ 0.1% to pass. &nbsp;** RGI: avg of monthly RevPAR Index % change.</p>

      <H3>Budgeted GOP</H3>
      <P>Measures whether the hotel achieved or exceeded its budgeted gross operating profit in dollar terms. Actual GOP ≥ Budget GOP = 35 pts. Below budget = 0 pts. This is the largest single KPI and acts as a financial gatekeeper.</P>

      <H3>GOP Margin Improvement</H3>
      <P>Measures whether the hotel improved its GOP profit margin percentage vs. the prior year. Calculated as: avg of (Actual Margin % − Prior Year Margin %) across months in the period. A 0.1% or better improvement earns the full 35 pts.</P>

      <H3>RGI (RevPAR Index) Improvement</H3>
      <P>Measures competitive performance using STR data. RGI (also called RevPAR Growth Index) tracks whether the hotel is gaining or losing share vs. its competitive set. Improvement thresholds:</P>
      <UL>
        <LI>Below 0.1% change — 0 pts (Fail)</LI>
        <LI>0.1% to 2.0% improvement — 7.5 pts (Partial)</LI>
        <LI>2.1%+ improvement — 15 pts (Full Pass)</LI>
      </UL>

      <H3>GSS (Guest Satisfaction Score) Improvement</H3>
      <P>Measures year-over-year guest satisfaction improvement. Any positive improvement (TY avg &gt; LY avg) earns 15 pts. The score uses brand-normalized averages across all months in the period:</P>
      <UL>
        <LI><strong>Marriott, Hilton, IHG, Hyatt</strong> — values used as-is (100-point scale)</LI>
        <LI><strong>Choice Hotels</strong> — raw score × 10 (converts 10-pt scale to 100-pt equivalent)</LI>
        <LI><strong>Independent (Revinate)</strong> — raw score × 20 (converts 5-pt scale to 100-pt equivalent)</LI>
      </UL>
      <InfoBox>💡 GSS normalization ensures fair comparison across brands. A Choice hotel scoring 8.5 → 85 is directly comparable to a Marriott hotel scoring 85.</InfoBox>

      <H3>Quarterly Aggregation Rules</H3>
      <UL>
        <LI><strong>GOP (dollar)</strong> — Summed across all months in the quarter</LI>
        <LI><strong>GOP Margin %</strong> — Averaged across months; improvement = avg of monthly (actual − prior)</LI>
        <LI><strong>RGI %</strong> — Averaged across months in the quarter</LI>
        <LI><strong>GSS</strong> — Each field (TY and LY) averaged independently across all valid months, then normalized and compared</LI>
      </UL>
    </>
  );
}

function AllPropertiesGuide() {
  return (
    <>
      <H3>What this page shows</H3>
      <P>The All Properties page is a sortable, filterable table of every active hotel in the portfolio. Each row shows the hotel's name, brand, location, total KPI score, and pass/fail status for each individual KPI — all for the currently selected time period.</P>

      <H3>Using the filters</H3>
      <UL>
        <LI>Use the <strong>search bar</strong> to find a hotel by name or city</LI>
        <LI>Use <strong>Brand</strong>, <strong>Sub-Brand</strong>, <strong>City</strong>, <strong>State</strong>, and <strong>Lead Type</strong> dropdowns to filter the list</LI>
        <LI>All filters combine — e.g. Marriott + Texas = only Marriott hotels in Texas</LI>
      </UL>

      <H3>Column meanings</H3>
      <UL>
        <LI><strong>Hotel</strong> — Name, brand badge, and city/state</LI>
        <LI><strong>Score</strong> — Total KPI score out of 100 (or 85 if GSS excluded)</LI>
        <LI><strong>GOP</strong> — Pass ✅ / Fail ❌ for Budgeted GOP</LI>
        <LI><strong>Margin</strong> — Pass / Fail for GOP Margin Improvement</LI>
        <LI><strong>RGI</strong> — Full ✅ / Partial ⚡ / Fail ❌ for RevPAR Index</LI>
        <LI><strong>GSS</strong> — Pass / Fail for Guest Satisfaction</LI>
      </UL>
      <P>Click any row to navigate to that hotel's full scorecard detail.</P>
    </>
  );
}

function KpiBreakdownGuide() {
  return (
    <>
      <H3>What the KPI Breakdown shows</H3>
      <P>The KPI Breakdown page provides a granular, side-by-side analysis of each KPI for a specific hotel and time period. It is designed for deep dives into why a hotel passed or failed a particular metric.</P>

      <H3>Reading the breakdown</H3>
      <UL>
        <LI>Each KPI is shown in its own section with actual values, targets, and the calculated result</LI>
        <LI>The <strong>reference table</strong> at the top shows the scoring thresholds for the current period type</LI>
        <LI>Color-coded results: green = pass, red = fail, yellow = partial (RGI only)</LI>
      </UL>

      <H3>Pass criteria quick reference</H3>
      <UL>
        <LI><strong>GOP</strong>: Actual ≥ Budget</LI>
        <LI><strong>Margin</strong>: Avg monthly improvement ≥ 0.1 percentage points vs. prior year</LI>
        <LI><strong>RGI</strong>: Average index change ≥ 0.1% vs. prior year (partial at 0.1–2.0%, full at 2.1%+)</LI>
        <LI><strong>GSS</strong>: Normalized TY average &gt; Normalized LY average (any improvement)</LI>
      </UL>
    </>
  );
}

function PayoutsGuide() {
  return (
    <>
      <H3>Adding a staff member</H3>
      <P>On the Payouts page, click "Add Staff Member" and fill in:</P>
      <UL>
        <LI>Name, property assignment, and job classification</LI>
        <LI>Quarterly salary for each quarter (Q1–Q4) — enter only the quarters that have closed</LI>
      </UL>

      <H3>How bonus is calculated</H3>
      <P>For each quarter, the system:</P>
      <UL>
        <LI>Calculates the KPI scorecard for that hotel and quarter</LI>
        <LI>For each KPI that passes, earns: <strong>quarterly salary × bonus percentage for that KPI</strong></LI>
        <LI>Sums the individual KPI bonuses for a quarterly total</LI>
      </UL>
      <InfoBox>💡 KPIs are <strong>independent</strong> — a hotel can pass GOP and fail GSS, earning only the GOP portion. There is no gatekeeper.</InfoBox>

      <H3>Job Classification Bonus Structures</H3>
      <div className="overflow-x-auto rounded-lg border border-border mt-2">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ backgroundColor: '#2d4b5e' }}>
              <th className="text-left px-4 py-2.5 text-white font-semibold">Classification</th>
              <th className="text-center px-3 py-2.5 text-white font-semibold">GOP</th>
              <th className="text-center px-3 py-2.5 text-white font-semibold">Margin</th>
              <th className="text-center px-3 py-2.5 text-white font-semibold">RGI</th>
              <th className="text-center px-3 py-2.5 text-white font-semibold">GSS</th>
              <th className="text-center px-3 py-2.5 text-white font-semibold">Max Bonus</th>
            </tr>
          </thead>
          <tbody>
            {[
              { title: 'General Manager', gop: '10%', margin: '10%', rgi: '15%', gss: '15%', max: '50%' },
              { title: 'AGM / EC Member', gop: '10%', margin: '10%', rgi: '10%', gss: '10%', max: '40%' },
              { title: 'Department Head', gop: '5%', margin: '5%', rgi: '2%', gss: '8%', max: '20%' },
            ].map((row, i) => (
              <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                <td className="px-4 py-2.5 font-medium text-foreground">{row.title}</td>
                <td className="px-3 py-2.5 text-center text-muted-foreground">{row.gop}</td>
                <td className="px-3 py-2.5 text-center text-muted-foreground">{row.margin}</td>
                <td className="px-3 py-2.5 text-center text-muted-foreground">{row.rgi}</td>
                <td className="px-3 py-2.5 text-center text-muted-foreground">{row.gss}</td>
                <td className="px-3 py-2.5 text-center font-bold text-primary">{row.max}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground mt-1.5">RGI partial (0.1–2.0%): earns 50% of the RGI bonus percentage. Full (2.1%+): earns 100%.</p>

      <H3>50/50 Payout Split</H3>
      <UL>
        <LI><strong>50% paid quarterly</strong> — paid out at the end of each quarter based on that quarter's performance</LI>
        <LI><strong>50% held to year-end</strong> — held until Q4 closes, then released as a year-end reconciliation payment</LI>
      </UL>

      <H3>Annual running total</H3>
      <P>The annual total shown in Payouts is the <strong>sum of actual completed quarters only</strong>. No projections or estimates are made for future quarters. A quarter is only included once its salary and scorecard data are entered.</P>
    </>
  );
}

function AdminGuide() {
  return (
    <>
      <H3>Adding users and assigning hotels</H3>
      <P>Go to <strong>Admin Panel</strong> in the sidebar. From there you can:</P>
      <UL>
        <LI>View all registered users and their roles (Admin, Full View, Property User)</LI>
        <LI>Assign specific hotels to a Property User — they will only see their assigned hotels</LI>
        <LI>Promote a user to Full View (sees all hotels, no admin features) or Admin (full access)</LI>
        <LI>Deactivate users to remove their access without deleting their record</LI>
      </UL>

      <H3>Sending invites</H3>
      <UL>
        <LI>Add a new user profile in the Admin Panel with their email and role</LI>
        <LI>Click "Send Invite" — they will receive an email with a login link</LI>
        <LI>Invite status tracks: Not Invited → Invited → Active</LI>
      </UL>

      <H3>Syncing the deployment spreadsheet</H3>
      <P>The deployment spreadsheet from the REBEL Dashboard App contains the master hotel list and staff assignments. To sync it:</P>
      <UL>
        <LI>Go to <strong>Documents</strong> and upload the deployment spreadsheet file</LI>
        <LI>The system will automatically match hotels by STR ID and update property records, Lead Type classifications, and active/inactive status</LI>
      </UL>

      <H3>What data is needed each month</H3>
      <UL>
        <LI><strong>STR file</strong> — competitive set data (updates RGI/RevPAR index fields)</LI>
        <LI><strong>Scorecard upload</strong> — GOP, margins, GSS scores, forecast data</LI>
        <LI><strong>Deployment spreadsheet</strong> — only needed when hotel list or staff changes</LI>
      </UL>
    </>
  );
}

function DataUploadsGuide() {
  return (
    <>
      <H3>Where to upload files</H3>
      <P>All data files are uploaded from the <strong>Documents</strong> page in the sidebar. Select the appropriate document type and period before uploading.</P>

      <H3>STR Data (RGI / RevPAR Index)</H3>
      <UL>
        <LI>Source: STR monthly competitive set report</LI>
        <LI>File type: CSV or Excel</LI>
        <LI>Updates: <code>revpar_index</code>, <code>revpar_index_prior</code>, <code>revpar_index_change</code> fields on each hotel's ScoreEntry</LI>
        <LI>Required columns: Property STR ID, period, RGI actual, RGI prior</LI>
      </UL>

      <H3>Scorecard Data (GOP, Margins, GSS, Forecast)</H3>
      <UL>
        <LI>Source: Monthly hotel financial scorecard spreadsheet</LI>
        <LI>File type: Excel or CSV</LI>
        <LI>Updates: GOP actual/target/prior, GOP margin %, GSS scores, forecast actual/primary</LI>
        <LI>One row per hotel per month — the importer matches on hotel name or STR ID</LI>
      </UL>

      <H3>Deployment Spreadsheet</H3>
      <UL>
        <LI>Source: REBEL Dashboard App export</LI>
        <LI>Updates: Hotel list, parent brand, sub-brand, GM name, Lead Type, active status</LI>
        <LI>Run after any hotel openings, closings, or staff changes</LI>
      </UL>

      <H3>Monthly upload checklist</H3>
      <div className="rounded-lg border border-border overflow-hidden">
        {[
          { step: '1', label: 'Upload STR file for the month', note: 'Updates RGI for all hotels' },
          { step: '2', label: 'Upload scorecard / financial data', note: 'Updates GOP, Margin, GSS, Forecast' },
          { step: '3', label: 'Verify data in Hotel Scorecard', note: 'Check each KPI shows expected values' },
          { step: '4', label: 'Update Payouts salary entries', note: 'Add Q salary for each staff member once quarter closes' },
          { step: '5', label: 'Export PDFs for review meetings', note: 'Use the Export button on individual scorecards' },
        ].map((item, i) => (
          <div key={i} className={`flex items-start gap-3 px-4 py-3 ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50'} ${i < 4 ? 'border-b border-border' : ''}`}>
            <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 mt-0.5" style={{ backgroundColor: '#2d4b5e' }}>{item.step}</span>
            <div>
              <div className="font-medium text-foreground text-sm">{item.label}</div>
              <div className="text-xs text-muted-foreground">{item.note}</div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

export default function HelpGuide() {
  const [allOpen, setAllOpen] = useState(false);

  const handleExpandAll = () => {
    setAllOpen(o => !o);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 print:px-0 print:py-4">
      {/* Header */}
      <div className="mb-8 print:mb-6">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Help &amp; User Guide</h1>
            <p className="text-muted-foreground mt-1">How to use the REBEL Hotel Performance Scorecard</p>
          </div>
          <button
            onClick={handleExpandAll}
            className="print:hidden text-sm text-primary border border-border rounded-lg px-4 py-2 hover:bg-muted transition-colors"
          >
            {allOpen ? 'Collapse all sections' : 'Expand all sections'}
          </button>
        </div>
      </div>

      {/* Sections */}
      <div className="space-y-3">
        {SECTIONS.map(section => (
          <ExpandableSection key={section.id} section={section} forceOpen={allOpen} />
        ))}
      </div>

      {/* Footer */}
      <div className="mt-10 pt-4 border-t border-border text-xs text-muted-foreground flex items-center justify-between">
        <span>REBEL Hotel Performance Scorecard — Help &amp; User Guide</span>
        <span>Last Updated: June 2026</span>
      </div>
    </div>
  );
}

function ExpandableSection({ section, forceOpen }) {
  const [localOpen, setLocalOpen] = useState(false);
  const open = forceOpen || localOpen;

  return (
    <div className="border border-border rounded-xl overflow-hidden print:border-gray-300 print:break-inside-avoid">
      <button
        onClick={() => setLocalOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 bg-slate-50 hover:bg-slate-100 transition-colors text-left print:bg-gray-100"
      >
        <div className="flex items-center gap-3">
          <span className="text-xl leading-none">{section.emoji}</span>
          <span className="font-semibold text-foreground text-base">{section.title}</span>
        </div>
        {open
          ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
          : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
        }
      </button>
      {open && (
        <div className="px-6 py-5 bg-white text-sm text-foreground space-y-4 print:block">
          {section.content}
        </div>
      )}
    </div>
  );
}