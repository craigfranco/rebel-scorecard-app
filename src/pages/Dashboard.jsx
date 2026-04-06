import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Save, User, ChevronRight } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import ScoreGauge from '@/components/scorecard/ScoreGauge';
import KpiRow from '@/components/scorecard/KpiRow';
import KickerBadge from '@/components/scorecard/KickerBadge';
import NotesPanel from '@/components/scorecard/NotesPanel';
import { calculateScorecard, MONTHS, getQuarterFromMonth } from '../lib/scoring';
import SeedOnMount from '../components/SeedOnMount';

const CURRENT_YEAR = 2026;
const CURRENT_MONTH = 3; // March (for demo)

export default function Dashboard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedPropertyId, setSelectedPropertyId] = useState('');
  const [timeFilter, setTimeFilter] = useState('month');
  const [selectedMonth, setSelectedMonth] = useState(CURRENT_MONTH);
  const [selectedYear, setSelectedYear] = useState(CURRENT_YEAR);
  const [notes, setNotes] = useState({ key_wins: '', previous_results: '', next_priorities: '' });
  const [preparedBy, setPreparedBy] = useState('');
  const [reviewedBy, setReviewedBy] = useState('');

  const { data: properties = [] } = useQuery({
    queryKey: ['properties'],
    queryFn: () => base44.entities.Property.list('name', 100),
  });

  const { data: entries = [] } = useQuery({
    queryKey: ['score-entries', selectedPropertyId, selectedYear],
    queryFn: () =>
      selectedPropertyId
        ? base44.entities.ScoreEntry.filter({ property_id: selectedPropertyId, year: selectedYear })
        : Promise.resolve([]),
    enabled: !!selectedPropertyId,
  });

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      const existing = entries.find(e => e.month === selectedMonth && e.year === selectedYear);
      if (existing) {
        return base44.entities.ScoreEntry.update(existing.id, data);
      } else {
        return base44.entities.ScoreEntry.create(data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['score-entries'] });
      toast({ title: 'Saved!', description: 'Scorecard data saved successfully.' });
    },
  });

  const selectedProperty = properties.find(p => p.id === selectedPropertyId);

  // Get entry for selected period
  const getActiveEntry = () => {
    if (timeFilter === 'month') {
      return entries.find(e => e.month === selectedMonth && e.year === selectedYear) || {};
    }
    if (timeFilter === 'quarter') {
      const q = getQuarterFromMonth(selectedMonth);
      const qEntries = entries.filter(e => getQuarterFromMonth(e.month) === q);
      return aggregateEntries(qEntries);
    }
    // YTD
    const ytdEntries = entries.filter(e => e.month <= selectedMonth);
    return aggregateEntries(ytdEntries);
  };

  const aggregateEntries = (arr) => {
    if (!arr.length) return {};
    const last = arr[arr.length - 1];
    const totalActualGOP = arr.reduce((s, e) => s + (e.budgeted_gop_actual || 0), 0);
    const totalTargetGOP = arr.reduce((s, e) => s + (e.budgeted_gop_target || 0), 0);
    return {
      ...last,
      budgeted_gop_actual: totalActualGOP,
      budgeted_gop_target: totalTargetGOP,
    };
  };

  const activeEntry = getActiveEntry();
  const scorecard = selectedProperty
    ? calculateScorecard(activeEntry, selectedProperty)
    : null;

  // Sync notes from entry
  useEffect(() => {
    if (activeEntry) {
      setNotes({
        key_wins: activeEntry.key_wins || '',
        previous_results: activeEntry.previous_results || '',
        next_priorities: activeEntry.next_priorities || '',
      });
      setPreparedBy(activeEntry.prepared_by || '');
      setReviewedBy(activeEntry.reviewed_by || '');
    }
  }, [selectedPropertyId, selectedMonth, selectedYear, timeFilter, entries.length]);

  const handleSaveNotes = () => {
    if (!selectedPropertyId) return;
    const existing = entries.find(e => e.month === selectedMonth && e.year === selectedYear);
    const data = {
      property_id: selectedPropertyId,
      month: selectedMonth,
      year: selectedYear,
      quarter: getQuarterFromMonth(selectedMonth),
      ...notes,
      prepared_by: preparedBy,
      reviewed_by: reviewedBy,
      ...(existing || {}),
    };
    saveMutation.mutate(data);
  };

  // Auto-select first property
  useEffect(() => {
    if (properties.length && !selectedPropertyId) {
      setSelectedPropertyId(properties[0].id);
    }
  }, [properties]);

  const kpiRows = scorecard ? [
    {
      measure: 'Budgeted GOP',
      weight: '35%',
      target: '100% of Budget',
      actual: activeEntry.budgeted_gop_actual != null ? `$${(activeEntry.budgeted_gop_actual / 1000).toFixed(0)}K` : '—',
      ytdActual: '—',
      score: scorecard.gop.score,
      maxScore: 35,
      pass: scorecard.gop.pass,
    },
    {
      measure: 'GOP Margin Improvement',
      weight: '35%',
      target: '+0.1% vs PY',
      actual: activeEntry.gop_margin_actual != null ? `${activeEntry.gop_margin_actual}%` : '—',
      ytdActual: activeEntry.gop_margin_prior != null ? `PY: ${activeEntry.gop_margin_prior}%` : '—',
      score: scorecard.gopMargin.score,
      maxScore: 35,
      pass: scorecard.gopMargin.pass,
    },
    {
      measure: 'RevPAR Index % Change (STR RGI)',
      weight: '15%',
      target: '0.1%-2.0% partial / 2.1%+ full',
      actual: activeEntry.revpar_index_change != null ? `${activeEntry.revpar_index_change.toFixed(2)}%` : '—',
      ytdActual: '—',
      score: scorecard.rgi.score,
      maxScore: 15,
      pass: scorecard.rgi.pass,
    },
    {
      measure: `GSS — ${scorecard.gssStd.label}`,
      weight: '15%',
      target: `+${scorecard.gssStd.target} YOY`,
      actual: activeEntry.gss_actual != null ? activeEntry.gss_actual : '—',
      ytdActual: activeEntry.gss_prior != null ? `PY: ${activeEntry.gss_prior}` : '—',
      score: scorecard.gss.score,
      maxScore: 15,
      pass: scorecard.gss.pass,
    },
  ] : [];

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-7xl mx-auto">
      <SeedOnMount />
      {/* Header */}
      <div className="rounded-2xl text-white p-6 shadow-lg" style={{ background: 'linear-gradient(135deg, #2d4b5e 0%, #1e3547 100%)' }}>
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-white/60 text-xs mb-1">
              <span>Balanced Scorecard</span>
              <ChevronRight className="w-3 h-3" />
              <span>Dashboard</span>
            </div>
            <h1 className="text-2xl font-bold">Hotel Performance Scorecard</h1>
            {selectedProperty && (
              <div className="flex items-center gap-2 mt-1">
                <span className="text-white/70 text-sm">{selectedProperty.city}, {selectedProperty.state}</span>
                {selectedProperty.gm_name && (
                  <>
                    <span className="text-white/40">·</span>
                    <User className="w-3.5 h-3.5 text-white/60" />
                    <span className="text-white/70 text-sm">GM: {selectedProperty.gm_name}</span>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <Select value={selectedPropertyId} onValueChange={setSelectedPropertyId}>
              <SelectTrigger className="w-full sm:w-72 bg-white/10 border-white/20 text-white">
                <SelectValue placeholder="Select property..." />
              </SelectTrigger>
              <SelectContent>
                {properties.map(p => (
                  <SelectItem key={p.id} value={p.id}>
                    <div>
                      <div className="font-medium text-sm">{p.name}</div>
                      <div className="text-xs text-muted-foreground">{p.city}, {p.state}</div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={String(selectedMonth)} onValueChange={v => setSelectedMonth(Number(v))}>
              <SelectTrigger className="w-full sm:w-40 bg-white/10 border-white/20 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map((m, i) => (
                  <SelectItem key={i + 1} value={String(i + 1)}>{m} {selectedYear}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Time filter tabs */}
      <Tabs value={timeFilter} onValueChange={setTimeFilter}>
        <TabsList className="bg-card border border-border shadow-sm">
          <TabsTrigger value="month">Month</TabsTrigger>
          <TabsTrigger value="quarter">Quarter</TabsTrigger>
          <TabsTrigger value="ytd">YTD</TabsTrigger>
        </TabsList>
      </Tabs>

      {!selectedProperty ? (
        <div className="bg-card rounded-2xl border border-border p-16 text-center shadow-sm">
          <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <h3 className="font-semibold text-lg mb-1">Select a Property</h3>
          <p className="text-muted-foreground text-sm">Choose a hotel from the dropdown to view its scorecard.</p>
        </div>
      ) : (
        <>
          {/* Score + KPI Table */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Gauge */}
            <div className="bg-card rounded-2xl border border-border p-6 shadow-sm flex flex-col items-center justify-center gap-4">
              <h2 className="font-bold text-sm text-muted-foreground uppercase tracking-wide">Overall Score</h2>
              {scorecard && (
                <ScoreGauge score={scorecard.total.total} pass={scorecard.total.pass} />
              )}
              <div className="w-full space-y-2">
                <KickerBadge type="forecast" hit={activeEntry.forecast_kicker || false} />
                <KickerBadge type="redzone" hit={activeEntry.red_zone_kicker || false} />
              </div>
            </div>

            {/* KPI Table */}
            <div className="lg:col-span-3 bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-border">
                <h2 className="font-bold text-foreground">
                  KPI Scorecard — {timeFilter === 'month' ? MONTHS[selectedMonth - 1] : timeFilter === 'quarter' ? `Q${getQuarterFromMonth(selectedMonth)}` : 'YTD'} {selectedYear}
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">{selectedProperty.name} · {selectedProperty.parent_brand}</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50 text-muted-foreground text-xs uppercase tracking-wide">
                      <th className="py-3 px-4 text-left font-semibold">Measure</th>
                      <th className="py-3 px-4 text-center font-semibold">Weight</th>
                      <th className="py-3 px-4 text-center font-semibold">Target</th>
                      <th className="py-3 px-4 text-center font-semibold">Actual</th>
                      <th className="py-3 px-4 text-center font-semibold">YTD</th>
                      <th className="py-3 px-4 text-center font-semibold">Score</th>
                      <th className="py-3 px-4 text-center font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {kpiRows.map((row, i) => (
                      <KpiRow key={i} {...row} />
                    ))}
                  </tbody>
                  {scorecard && (
                    <tfoot>
                      <tr style={{ backgroundColor: '#2d4b5e' }}>
                        <td colSpan={5} className="py-3 px-4 font-bold text-white text-sm">Total Score</td>
                        <td className="py-3 px-4 text-center font-black text-white text-lg">{scorecard.total.total}</td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold text-white"
                            style={{ backgroundColor: scorecard.total.pass ? '#4CAF50' : '#ef4444' }}
                          >
                            {scorecard.total.pass ? '✓ PASS' : '✗ FAIL'}
                          </span>
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          </div>

          {/* Notes panels */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <NotesPanel title="Key Wins & Risks" icon="🏆" value={notes.key_wins} onChange={v => setNotes(n => ({ ...n, key_wins: v }))} placeholder="Document key wins and risks for this period..." />
            <NotesPanel title="Previous Month Results" icon="📊" value={notes.previous_results} onChange={v => setNotes(n => ({ ...n, previous_results: v }))} placeholder="Summarize previous month performance..." />
            <NotesPanel title="Next Month Priorities" icon="🎯" value={notes.next_priorities} onChange={v => setNotes(n => ({ ...n, next_priorities: v }))} placeholder="List priorities for the upcoming month..." />
          </div>

          {/* Prepared/Reviewed + Save */}
          <div className="bg-card rounded-2xl border border-border p-5 shadow-sm">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
              <div className="flex-1 flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Prepared By</label>
                  <Input value={preparedBy} onChange={e => setPreparedBy(e.target.value)} placeholder="Name" className="text-sm" />
                </div>
                <div className="flex-1">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Reviewed By</label>
                  <Input value={reviewedBy} onChange={e => setReviewedBy(e.target.value)} placeholder="Name" className="text-sm" />
                </div>
              </div>
              <Button
                onClick={handleSaveNotes}
                disabled={saveMutation.isPending}
                className="gap-2 px-6"
                style={{ backgroundColor: '#2d4b5e' }}
              >
                <Save className="w-4 h-4" />
                {saveMutation.isPending ? 'Saving...' : 'Save Notes'}
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}