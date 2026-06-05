'use client';

import { StudentProfileDetail } from '@schoolos/core';
import { SectionCard } from '@/components/ui/section-card';
import { Heart, AlertCircle, Pill, ShieldAlert, User, Phone } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export function HealthTab({ profile }: { profile: StudentProfileDetail }) {
  const { student } = profile;
  
  return (
    <div className="grid gap-6 lg:grid-cols-2 animate-fade-in">
      <SectionCard title="Medical Records">
        <div className="space-y-6">
          <HealthItem 
            icon={<AlertCircle size={18} />} 
            label="Medical Conditions" 
            value={(student as any).medicalConditions || 'No conditions recorded'} 
            tone={(student as any).medicalConditions ? 'danger' : 'neutral'}
          />
          <HealthItem 
            icon={<ShieldAlert size={18} />} 
            label="Severe Allergies" 
            value={(student as any).severeAllergies || 'No known allergies'} 
            tone={(student as any).severeAllergies ? 'danger' : 'neutral'}
          />
          <HealthItem 
            icon={<Pill size={18} />} 
            label="Regular Medications" 
            value={(student as any).medications || 'No regular medications'} 
            tone={(student as any).medications ? 'warning' : 'neutral'}
          />
          <HealthItem 
            icon={<Heart size={18} />} 
            label="Special Needs" 
            value={(student as any).specialNeeds || 'No special needs recorded'} 
            tone={(student as any).specialNeeds ? 'admissions' : 'neutral'}
          />
        </div>
      </SectionCard>

      <SectionCard title="Emergency Contacts">
        <div className="grid gap-6">
          <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-5">
            <p className="text-[0.65rem] font-bold uppercase tracking-wider text-slate-500 mb-4">Primary Emergency Contact</p>
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--color-mod-admissions-border)] bg-white text-[var(--color-mod-admissions-accent)] shadow-sm">
                <User size={18} />
              </div>
              <div>
                <p className="font-bold text-slate-900">{student.emergencyName || 'Not recorded'}</p>
                <p className="text-sm text-slate-500 font-medium">{student.emergencyPhone || 'No phone recorded'}</p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-5">
            <p className="text-[0.65rem] font-bold uppercase tracking-wider text-slate-500 mb-4">Family Doctor</p>
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--color-mod-admissions-border)] bg-white text-[var(--color-mod-admissions-accent)] shadow-sm">
                <ShieldAlert size={18} />
              </div>
              <div>
                <p className="font-bold text-slate-900">{student.doctorName || 'Not recorded'}</p>
                <p className="text-sm text-slate-500 font-medium">{student.doctorPhone || 'No phone recorded'}</p>
              </div>
            </div>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}

function HealthItem({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone: 'danger' | 'warning' | 'admissions' | 'neutral' }) {
  const colors = {
    danger: 'text-danger-500 bg-danger-50',
    warning: 'text-warning-500 bg-warning-50',
    admissions: 'text-[var(--color-mod-admissions-accent)] bg-[var(--color-mod-admissions-bg)]',
    neutral: 'text-slate-400 bg-slate-50',
  };

  return (
    <div className="flex items-start gap-4">
      <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${colors[tone]}`}>
        {icon}
      </div>
      <div>
        <p className="text-[0.65rem] font-bold uppercase tracking-wider text-slate-400">{label}</p>
        <p className={`mt-0.5 font-bold ${tone === 'neutral' ? 'text-slate-500' : 'text-slate-900'}`}>{value}</p>
      </div>
    </div>
  );
}
