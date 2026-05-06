'use client';

import { GuardianProfile, UpdateStudentGuardianPayload } from '@schoolos/core';
import { SectionCard } from '@/components/ui/section-card';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';
import { Phone, Mail, MapPin, Edit3 } from 'lucide-react';

type GuardiansTabProps = {
  guardians: GuardianProfile[];
  editingGuardianId: string | null;
  isSaving: boolean;
  error: unknown;
  onCancelEdit: () => void;
  onEditGuardian: (guardianId: string) => void;
  onSaveGuardian: (guardianId: string, body: UpdateStudentGuardianPayload) => void;
};

export function GuardiansTab({
  guardians,
  editingGuardianId,
  isSaving,
  error,
  onCancelEdit,
  onEditGuardian,
  onSaveGuardian,
}: GuardiansTabProps) {
  return (
    <div className="grid gap-6 md:grid-cols-2 animate-fade-in">
      {guardians.length > 0 ? (
        guardians.map((guardian) => (
          <SectionCard 
            key={guardian.id}
            title={guardian.fullName}
            description={guardian.relation}
            headerAction={
              <div className="flex items-center gap-2">
                {guardian.isPrimary && <Badge variant="success">Primary</Badge>}
                <button
                  type="button"
                  className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-500 hover:bg-primary-500 hover:text-white transition-colors"
                  onClick={() => onEditGuardian(guardian.id)}
                >
                  <Edit3 size={14} />
                </button>
              </div>
            }
          >
            <div className="space-y-4">
               <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex items-center gap-3 text-sm text-slate-600">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-50 text-slate-400">
                      <Phone size={14} />
                    </div>
                    <span>{guardian.primaryPhone || 'No phone'}</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-slate-600">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-50 text-slate-400">
                      <Mail size={14} />
                    </div>
                    <span className="truncate">{guardian.email || 'No email'}</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-slate-600">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-50 text-slate-400">
                      <MapPin size={14} />
                    </div>
                    <span>Ward {guardian.wardNumber || 'N/A'}</span>
                  </div>
               </div>
            </div>
          </SectionCard>
        ))
      ) : (
        <div className="col-span-2 py-12 text-center bg-white rounded-[2rem] border border-slate-200">
          <p className="text-slate-400 font-medium">No guardian records found.</p>
        </div>
      )}
    </div>
  );
}
