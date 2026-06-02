'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { SectionCard } from '@/components/ui/section-card';
import { PageHeader } from '@/components/ui/page-header';
import { Select, Input } from '@/components/ui/form-field';
import { Button } from '@/components/ui/button';
import { Toast, type ToastTone } from '@/components/ui/toast';
import { 
  ClipboardList, 
  Download, 
  FileSpreadsheet, 
  FileText, 
  Filter,
  Search,
  ChevronRight
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <PageHeader 
        title="Reports & Exports" 
        description="Consolidated reporting engine for academics, finance, students, and operations."
      />
      <ReportsWorkspace />
    </div>
  );
}

function ReportsWorkspace() {
  const [selectedReportKey, setSelectedReportKey] = useState<string | null>(null);
  const [filters, setFilters] = useState<Record<string, any>>({});
  const [exporting, setExporting] = useState<string | null>(null);
  const [exportNotice, setExportNotice] = useState<{
    title: string;
    description?: string;
    tone: ToastTone;
  } | null>(null);

  const reportsQuery = useQuery({
    queryKey: ['report-definitions'],
    queryFn: api.listReports,
  });

  const academicYearsQuery = useQuery({ queryKey: ['academic-years'], queryFn: api.listAcademicYears });
  const classesQuery = useQuery({ queryKey: ['classes'], queryFn: api.listClasses });
  const examsQuery = useQuery({ queryKey: ['exam-terms'], queryFn: api.listExamTerms });

  const reports = reportsQuery.data ?? [];
  const selectedReport = reports.find((r) => r.key === selectedReportKey);

  const handleExport = async (format: 'csv' | 'pdf' | 'json') => {
    if (!selectedReportKey) return;
    setExporting(format);
    try {
      await api.exportReport(selectedReportKey, {
        format,
        filters,
      });
      setExportNotice({
        title: 'Export ready',
        description: `${selectedReport?.name ?? 'Report'} ${format.toUpperCase()} export completed.`,
        tone: 'success',
      });
    } catch (error: unknown) {
      setExportNotice({
        title: 'Export failed',
        description:
          error instanceof Error ? error.message : 'The report export failed.',
        tone: 'danger',
      });
    } finally {
      setExporting(null);
    }
  };

  const handleFilterChange = (key: string, value: any) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Report List */}
      <div className="lg:col-span-1 space-y-4">
        <SectionCard title="Available Reports" description="Select a report to configure and export.">
          <div className="space-y-2">
            {reportsQuery.isLoading ? (
              <div className="py-8 text-center text-slate-500">Loading reports...</div>
            ) : (
              Object.entries(
                reports.reduce((acc, r) => {
                  const cat = r.category || 'general';
                  if (!acc[cat]) acc[cat] = [];
                  acc[cat].push(r);
                  return acc;
                }, {} as Record<string, any[]>)
              ).map(([category, items]) => (
                <div key={category} className="space-y-1">
                  <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 py-2 px-3">
                    {category}
                  </h4>
                  {items.map((report) => (
                    <button
                      key={report.key}
                      onClick={() => {
                        setSelectedReportKey(report.key);
                        setFilters({});
                      }}
                      className={cn(
                        "w-full flex items-center justify-between gap-3 px-4 py-3 rounded-2xl text-left text-sm transition-all",
                        selectedReportKey === report.key
                          ? "bg-primary-600 text-white shadow-lg shadow-primary-600/20 font-bold"
                          : "hover:bg-slate-50 text-slate-600"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <ClipboardList size={16} className={selectedReportKey === report.key ? "text-primary-200" : "text-slate-400"} />
                        <span>{report.name}</span>
                      </div>
                      <ChevronRight size={14} className={selectedReportKey === report.key ? "text-primary-300" : "text-slate-300"} />
                    </button>
                  ))}
                </div>
              ))
            )}
          </div>
        </SectionCard>
      </div>

      {/* Configuration & Actions */}
      <div className="lg:col-span-2 space-y-6">
        {exportNotice ? (
          <Toast
            title={exportNotice.title}
            description={exportNotice.description}
            tone={exportNotice.tone}
            onDismiss={() => setExportNotice(null)}
            className="max-w-none"
          />
        ) : null}

        {selectedReport ? (
          <SectionCard 
            title={selectedReport.name} 
            description={selectedReport.description}
          >
            <div className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                {selectedReport.filters.map((filter) => (
                  <div key={filter.key} className="space-y-2">
                    <label className="text-xs font-bold text-slate-700">{filter.label}</label>
                    {filter.type === 'class' ? (
                      <Select 
                        value={filters[filter.key] || ''} 
                        onChange={(e) => handleFilterChange(filter.key, e.target.value)}
                      >
                        <option value="">Select Class</option>
                        {classesQuery.data?.map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </Select>
                    ) : filter.type === 'select' && filter.key === 'academicYearId' ? (
                      <Select 
                        value={filters[filter.key] || ''} 
                        onChange={(e) => handleFilterChange(filter.key, e.target.value)}
                      >
                        <option value="">Select Year</option>
                        {academicYearsQuery.data?.map(y => (
                          <option key={y.id} value={y.id}>{y.name}</option>
                        ))}
                      </Select>
                    ) : filter.type === 'select' && filter.key === 'examTermId' ? (
                      <Select 
                        value={filters[filter.key] || ''} 
                        onChange={(e) => handleFilterChange(filter.key, e.target.value)}
                      >
                        <option value="">Select Term</option>
                        {examsQuery.data?.map(et => (
                          <option key={et.id} value={et.id}>{et.name}</option>
                        ))}
                      </Select>
                    ) : filter.type === 'select' && filter.options ? (
                      <Select 
                        value={filters[filter.key] || ''} 
                        onChange={(e) => handleFilterChange(filter.key, e.target.value)}
                      >
                        <option value="">Select Option</option>
                        {filter.options.map((opt: any) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </Select>
                    ) : (
                      <Input 
                        type={filter.type === 'date' ? 'date' : 'text'} 
                        placeholder={filter.label}
                        value={filters[filter.key] || ''}
                        onChange={(e) => handleFilterChange(filter.key, e.target.value)}
                      />
                    )}
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap gap-3 pt-4 border-t border-slate-100">
                {selectedReport.formats.includes('csv') && (
                  <Button
                    onClick={() => handleExport('csv')}
                    disabled={!!exporting}
                    variant="outline"
                    className="rounded-2xl"
                  >
                    <FileSpreadsheet size={16} className="mr-2 text-emerald-600" />
                    {exporting === 'csv' ? 'Exporting...' : 'Download CSV'}
                  </Button>
                )}
                {selectedReport.formats.includes('pdf') && (
                  <Button
                    onClick={() => handleExport('pdf')}
                    disabled={!!exporting}
                    variant="outline"
                    className="rounded-2xl"
                  >
                    <FileText size={16} className="mr-2 text-rose-600" />
                    {exporting === 'pdf' ? 'Exporting...' : 'Download PDF'}
                  </Button>
                )}
                {selectedReport.formats.includes('json') && (
                  <Button
                    onClick={() => handleExport('json')}
                    disabled={!!exporting}
                    variant="ghost"
                    className="rounded-2xl"
                  >
                    <Download size={16} className="mr-2" />
                    JSON Data
                  </Button>
                )}
              </div>
            </div>
          </SectionCard>
        ) : (
          <div className="flex flex-col items-center justify-center py-32 rounded-[3rem] bg-slate-50 border border-dashed border-slate-200 text-center">
            <div className="h-20 w-20 rounded-full bg-white shadow-xl flex items-center justify-center text-slate-300 mb-6">
              <Filter size={32} />
            </div>
            <h3 className="text-xl font-black text-slate-400 italic uppercase">Select a Report</h3>
            <p className="mt-2 text-sm text-slate-400 font-medium">Choose a report from the list to start configuration.</p>
          </div>
        )}
      </div>
    </div>
  );
}
