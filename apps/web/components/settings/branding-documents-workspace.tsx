'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, ChevronLeft, ImageUp, Save, ShieldCheck, Trash2 } from 'lucide-react';
import type {
  BrandingDocumentsSettings,
  UpdateBrandingDocumentsPayload,
} from '@schoolos/core';
import { formatBsDateTime } from '@schoolos/core';
import { PageHeader } from '../ui/page-header';
import { Button } from '../ui/button';
import { ConfirmDialog } from '../ui/confirm-dialog';
import { ErrorState } from '../ui/error-state';
import { ProtectedFileButton } from '../ui/protected-file';
import { schoolSettingsApi } from '../../lib/api/school-settings';
import { ApiRequestError } from '../../lib/api/client';

type BrandingForm = Omit<BrandingDocumentsSettings, 'logoFileAssetId' | 'updatedAt'>;

const emptyBranding: BrandingForm = {
  primaryColor: '#2563EB',
  receiptHeaderText: null,
  receiptFooterText: null,
  idCardFooterText: null,
  payslipFooterText: null,
  certificateFooterText: null,
  reportCardFooterText: null,
  defaultPaperSize: 'A4',
};

const supportedLogoTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const maxLogoBytes = 1024 * 1024;

export function BrandingDocumentsWorkspace() {
  const client = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const brandingQuery = useQuery({
    queryKey: ['school-settings', 'branding-documents'],
    queryFn: schoolSettingsApi.getBrandingDocuments,
  });
  const [form, setForm] = useState<BrandingForm>(emptyBranding);
  const [notice, setNotice] = useState<string | null>(null);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [confirmRemoval, setConfirmRemoval] = useState(false);

  useEffect(() => {
    if (brandingQuery.data) setForm(withoutFile(brandingQuery.data));
  }, [brandingQuery.data]);

  const changed = useMemo(() => brandingQuery.data
    ? JSON.stringify(form) !== JSON.stringify(withoutFile(brandingQuery.data))
    : false,
  [form, brandingQuery.data]);

  const saveMutation = useMutation({
    mutationFn: schoolSettingsApi.updateBrandingDocuments,
    onSuccess: async (branding) => {
      client.setQueryData(['school-settings', 'branding-documents'], branding);
      await client.invalidateQueries({ queryKey: ['school-settings', 'overview'] });
      setNotice('Branding and document defaults saved.');
    },
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => schoolSettingsApi.uploadSchoolLogo(file),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ['school-settings', 'branding-documents'] });
      await client.invalidateQueries({ queryKey: ['school-settings', 'overview'] });
      setNotice('Official school logo uploaded securely.');
      setLogoError(null);
    },
    onError: () => setLogoError('The logo could not be uploaded. Please try again.'),
  });

  const removeMutation = useMutation({
    mutationFn: schoolSettingsApi.removeSchoolLogo,
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ['school-settings', 'branding-documents'] });
      await client.invalidateQueries({ queryKey: ['school-settings', 'overview'] });
      setNotice('School logo removed.');
      setConfirmRemoval(false);
    },
  });

  if (brandingQuery.isLoading) {
    return <div className="space-y-4 p-6"><div className="h-24 animate-pulse rounded-2xl bg-slate-100" /><div className="h-[620px] animate-pulse rounded-2xl bg-slate-100" /></div>;
  }
  if (brandingQuery.isError || !brandingQuery.data) {
    const denied = brandingQuery.error instanceof ApiRequestError && brandingQuery.error.statusCode === 403;
    return <ErrorState
      title={denied ? 'Permission denied' : 'Could not load Branding & Documents'}
      message={denied ? 'You do not have permission to manage school branding and official document defaults.' : undefined}
      error={brandingQuery.error}
      onRetry={denied ? undefined : () => void brandingQuery.refetch()}
    />;
  }

  const branding = brandingQuery.data;
  const setValue = <K extends keyof BrandingForm>(key: K, value: BrandingForm[K]) => setForm((current) => ({ ...current, [key]: value }));
  const save = () => {
    const payload = changedPayload(form, withoutFile(branding));
    if (Object.keys(payload).length) saveMutation.mutate(payload);
  };
  const chooseLogo = () => fileInputRef.current?.click();
  const onLogoFile = (file: File | undefined) => {
    if (!file) return;
    if (!supportedLogoTypes.has(file.type)) {
      setLogoError('Use a JPG, PNG, or WebP logo file.');
      return;
    }
    if (file.size > maxLogoBytes) {
      setLogoError('The logo must be 1 MB or smaller.');
      return;
    }
    uploadMutation.mutate(file);
  };

  return <div className="space-y-6 p-6 pb-28">
    <PageHeader
      title="Branding & Official Documents"
      description="Manage the protected school logo and the official wording used on school documents."
      actions={<Link href="/dashboard/settings/overview" className="inline-flex items-center gap-1 text-sm font-semibold text-slate-600 hover:text-slate-950"><ChevronLeft className="h-4 w-4" /> Settings overview</Link>}
    />
    <section className="rounded-2xl border border-sky-100 bg-sky-50 p-5 text-sm text-sky-900"><div className="flex gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" /><div><p className="font-bold">Protected official files</p><p className="mt-1">School logos are stored through File Registry. Open or download them only through authenticated protected-file actions.</p></div></div></section>
    {notice ? <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800"><CheckCircle2 className="h-4 w-4" />{notice}</div> : null}
    {saveMutation.isError ? <ErrorState title="Could not save branding defaults" error={saveMutation.error} onRetry={save} className="min-h-[180px]" /> : null}
    {removeMutation.isError ? <ErrorState title="Could not remove the school logo" error={removeMutation.error} onRetry={() => removeMutation.mutate()} className="min-h-[180px]" /> : null}

    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 p-6"><h2 className="font-bold text-slate-950">Official school logo</h2><p className="mt-1 text-sm text-slate-600">Used only where the approved document template supports a school logo.</p></div>
      <div className="flex flex-col gap-5 p-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4"><div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50"><ImageUp className="h-7 w-7 text-slate-400" /></div><div><p className="font-semibold text-slate-900">{branding.logoFileAssetId ? 'Official logo is uploaded' : 'No school logo uploaded'}</p><p className="mt-1 text-sm text-slate-600">JPG, PNG, or WebP · maximum 1 MB</p>{logoError ? <p className="mt-2 text-sm font-semibold text-rose-700" role="alert">{logoError}</p> : null}</div></div>
        <div className="flex flex-wrap gap-2">
          <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(event) => onLogoFile(event.target.files?.[0])} />
          <Button type="button" onClick={chooseLogo} disabled={uploadMutation.isPending}><ImageUp className="h-4 w-4" />{uploadMutation.isPending ? 'Uploading…' : branding.logoFileAssetId ? 'Replace logo' : 'Upload logo'}</Button>
          <ProtectedFileButton fileAssetId={branding.logoFileAssetId} fileName="school-logo" action="preview" label="Open securely" />
          <ProtectedFileButton fileAssetId={branding.logoFileAssetId} fileName="school-logo" action="download" label="Download" />
          {branding.logoFileAssetId ? <Button type="button" variant="outline" onClick={() => setConfirmRemoval(true)}><Trash2 className="h-4 w-4" /> Remove</Button> : null}
        </div>
      </div>
    </section>

    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <Section title="Visual defaults" description="These values support approved SchoolOS document templates; they do not alter protected template files.">
        <label><span className="text-sm font-semibold text-slate-700">Primary colour</span><div className="mt-1.5 flex gap-2"><input type="color" value={form.primaryColor ?? '#2563EB'} onChange={(event) => setValue('primaryColor', event.target.value)} className="h-10 w-14 rounded-lg border border-slate-200 bg-white p-1" /><input value={form.primaryColor ?? ''} onChange={(event) => setValue('primaryColor', event.target.value)} maxLength={7} className="h-10 flex-1 rounded-lg border border-slate-200 px-3 text-sm" /></div></label>
        <SelectField label="Default paper size" value={form.defaultPaperSize ?? 'A4'} onChange={(value) => setValue('defaultPaperSize', value as BrandingForm['defaultPaperSize'])} options={[['A4', 'A4'], ['LEGAL', 'Legal'], ['80MM', 'Thermal receipt · 80 mm']]} />
      </Section>
      <Section title="Receipt wording" description="Keep official receipt text concise and consistent with school policy.">
        <TextField label="Receipt header" value={form.receiptHeaderText ?? ''} onChange={(value) => setValue('receiptHeaderText', value)} />
        <TextArea label="Receipt footer" value={form.receiptFooterText ?? ''} onChange={(value) => setValue('receiptFooterText', value)} />
      </Section>
      <Section title="Official document footers" description="These are used by eligible document generators. They do not publish a document by themselves.">
        <TextArea label="ID card footer" value={form.idCardFooterText ?? ''} onChange={(value) => setValue('idCardFooterText', value)} />
        <TextArea label="Payslip footer" value={form.payslipFooterText ?? ''} onChange={(value) => setValue('payslipFooterText', value)} />
        <TextArea label="Certificate footer" value={form.certificateFooterText ?? ''} onChange={(value) => setValue('certificateFooterText', value)} />
        <TextArea label="Report card footer" value={form.reportCardFooterText ?? ''} onChange={(value) => setValue('reportCardFooterText', value)} />
      </Section>
    </section>

    <p className="text-xs text-slate-500">Last updated: {branding.updatedAt ? formatBsDateTime(branding.updatedAt) : 'Not yet configured'}</p>
    {changed ? <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 px-6 py-4 shadow-lg backdrop-blur"><div className="mx-auto flex max-w-5xl items-center justify-between gap-4"><p className="text-sm font-semibold text-slate-700">You have unsaved branding changes.</p><div className="flex gap-2"><Button variant="outline" onClick={() => setForm(withoutFile(branding))}>Discard</Button><Button onClick={save} disabled={saveMutation.isPending}><Save className="h-4 w-4" />{saveMutation.isPending ? 'Saving…' : 'Save changes'}</Button></div></div></div> : null}
    <ConfirmDialog isOpen={confirmRemoval} title="Remove school logo?" description="This removes the current protected logo from school branding. Existing generated documents will not be rewritten." confirmLabel="Remove logo" destructive isConfirming={removeMutation.isPending} onConfirm={() => removeMutation.mutate()} onClose={() => setConfirmRemoval(false)} />
  </div>;
}

function withoutFile(branding: BrandingDocumentsSettings): BrandingForm { const { logoFileAssetId: _file, updatedAt: _updated, ...form } = branding; return form; }
function changedPayload(next: BrandingForm, previous: BrandingForm): UpdateBrandingDocumentsPayload { return Object.fromEntries(Object.entries(next).filter(([key, value]) => value !== previous[key as keyof BrandingForm])) as UpdateBrandingDocumentsPayload; }
function Section({ title, description, children }: { title: string; description: string; children: ReactNode }) { return <div className="border-b border-slate-100 p-6 last:border-b-0"><h2 className="font-bold text-slate-950">{title}</h2><p className="mt-1 text-sm text-slate-600">{description}</p><div className="mt-5 grid gap-4 md:grid-cols-2">{children}</div></div>; }
function TextField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label><span className="text-sm font-semibold text-slate-700">{label}</span><input value={value} onChange={(event) => onChange(event.target.value)} maxLength={500} className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm" /></label>; }
function TextArea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label><span className="text-sm font-semibold text-slate-700">{label}</span><textarea value={value} onChange={(event) => onChange(event.target.value)} maxLength={1000} rows={4} className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></label>; }
function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Array<[string, string]> }) { return <label><span className="text-sm font-semibold text-slate-700">{label}</span><select value={value} onChange={(event) => onChange(event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm">{options.map(([optionValue, optionLabel]) => <option key={optionValue} value={optionValue}>{optionLabel}</option>)}</select></label>; }
