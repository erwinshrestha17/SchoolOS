'use client';

import { useEffect, useState } from 'react';
import { api } from '../../../lib/api';
import { TenantSettingSummary } from '@schoolos/core';
import { 
  Save, 
  Globe, 
  Palette, 
  Clock,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

export default function TenantSettingsPage() {
  const [settings, setSettings] = useState<TenantSettingSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    api.getTenantSettings()
      .then(setSettings)
      .finally(() => setLoading(false));
  }, []);

  const getSettingValue = (key: string, defaultValue: any) => {
    const setting = settings.find(s => s.key === key);
    return setting ? setting.value : defaultValue;
  };

  const updateSetting = async (key: string, value: any) => {
    setSaving(key);
    setMessage(null);
    try {
      await api.updateTenantSetting(key, value);
      const updated = await api.getTenantSettings();
      setSettings(updated);
      setMessage({ type: 'success', text: 'Setting updated successfully.' });
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to update setting.' });
    } finally {
      setSaving(null);
    }
  };

  if (loading) return <div className="p-8">Loading settings...</div>;

  return (
    <div className="max-w-4xl space-y-8 p-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">School Settings</h1>
        <p className="text-slate-500">Configure your school's branding, localization, and operational preferences.</p>
      </div>

      {message && (
        <div className={`flex items-center gap-2 rounded-xl p-4 text-sm ${
          message.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
        }`}>
          {message.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6">
        {/* Branding */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-center gap-2 text-slate-900">
            <Palette size={20} className="text-primary-600" />
            <h2 className="text-lg font-semibold">Branding</h2>
          </div>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Primary Branding Color</label>
              <div className="flex items-center gap-3">
                <input 
                  type="color" 
                  value={getSettingValue('branding_primary_color', '#6366f1')}
                  onChange={(e) => updateSetting('branding_primary_color', e.target.value)}
                  className="h-10 w-20 rounded-lg border border-slate-200 p-1 cursor-pointer"
                />
                <span className="text-sm font-mono text-slate-500 uppercase">
                  {getSettingValue('branding_primary_color', '#6366f1')}
                </span>
                {saving === 'branding_primary_color' && <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />}
              </div>
              <p className="mt-2 text-xs text-slate-400">This color will be used for buttons, links, and highlights across the platform.</p>
            </div>
          </div>
        </section>

        {/* Localization */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-center gap-2 text-slate-900">
            <Globe size={20} className="text-primary-600" />
            <h2 className="text-lg font-semibold">Localization</h2>
          </div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Timezone</label>
              <select 
                value={getSettingValue('timezone', 'Asia/Kathmandu')}
                onChange={(e) => updateSetting('timezone', e.target.value)}
                className="w-full rounded-xl border border-slate-200 py-2 px-3 text-sm focus:border-primary-500 focus:outline-none"
              >
                <option value="Asia/Kathmandu">Asia/Kathmandu (UTC+5:45)</option>
                <option value="UTC">UTC</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Currency</label>
              <select 
                value={getSettingValue('currency', 'NPR')}
                onChange={(e) => updateSetting('currency', e.target.value)}
                className="w-full rounded-xl border border-slate-200 py-2 px-3 text-sm focus:border-primary-500 focus:outline-none"
              >
                <option value="NPR">Nepalese Rupee (NPR)</option>
                <option value="USD">US Dollar (USD)</option>
              </select>
            </div>
          </div>
        </section>

        {/* Operations */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-center gap-2 text-slate-900">
            <Clock size={20} className="text-primary-600" />
            <h2 className="text-lg font-semibold">Operations</h2>
          </div>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Attendance Lock (Hours)</label>
              <div className="flex items-center gap-3">
                <input 
                  type="number" 
                  value={getSettingValue('attendance_lock_hours', 24)}
                  onChange={(e) => updateSetting('attendance_lock_hours', parseInt(e.target.value))}
                  className="w-24 rounded-xl border border-slate-200 py-2 px-3 text-sm focus:border-primary-500 focus:outline-none"
                />
                <span className="text-sm text-slate-500">hours after session start</span>
              </div>
              <p className="mt-2 text-xs text-slate-400">Attendance records will be locked for editing after this period.</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
