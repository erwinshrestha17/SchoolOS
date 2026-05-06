'use client';

import { useState } from 'react';
import { StudentProfileDetail, UpdateStudentProfilePayload } from '@schoolos/core';
import { SectionCard } from '@/components/ui/section-card';
import { Badge } from '@/components/ui/badge';
import { User, Calendar, Hash, MapPin, Heart, Phone, ShieldAlert, Save, X } from 'lucide-react';
import { cn } from '@/lib/utils';

type StudentEditCardProps = {
  profile: StudentProfileDetail;
  isSaving: boolean;
  error: any;
  onCancel: () => void;
  onSave: (body: UpdateStudentProfilePayload) => void;
};

export function StudentEditCard({ profile, isSaving, error, onCancel, onSave }: StudentEditCardProps) {
  const { student } = profile;
  
  const [firstNameEn, setFirstNameEn] = useState(student.firstNameEn ?? '');
  const [lastNameEn, setLastNameEn] = useState(student.lastNameEn ?? '');
  const [dateOfBirth, setDateOfBirth] = useState(student.dateOfBirth ? student.dateOfBirth.slice(0, 10) : '');
  const [gender, setGender] = useState(student.gender ?? 'FEMALE');
  const [nationalStudentId, setNationalStudentId] = useState(student.nationalStudentId ?? '');
  const [disabilityStatus, setDisabilityStatus] = useState(student.disabilityFlag ? 'yes' : 'no');
  const [disabilityFlag, setDisabilityFlag] = useState(student.disabilityFlag ?? '');
  const [medicalConditions, setMedicalConditions] = useState(student.medicalConditions ?? '');
  const [severeAllergies, setSevereAllergies] = useState(student.severeAllergies ?? '');
  const [emergencyName, setEmergencyName] = useState(student.emergencyName ?? '');
  const [emergencyPhone, setEmergencyPhone] = useState(student.emergencyPhone ?? '');

  const [validationError, setValidationError] = useState('');

  const handleSave = () => {
    setValidationError('');
    if (!firstNameEn.trim() || !lastNameEn.trim()) {
      setValidationError('First name and last name are required.');
      return;
    }
    if (!dateOfBirth) {
      setValidationError('Date of birth is required.');
      return;
    }
    
    onSave({
      firstNameEn: firstNameEn.trim(),
      lastNameEn: lastNameEn.trim(),
      dateOfBirth,
      gender,
      nationalStudentId: nationalStudentId.trim() || null,
      disabilityFlag: disabilityStatus === 'yes' ? disabilityFlag.trim() : null,
      confirmNoDisability: disabilityStatus === 'no',
      medicalConditions: medicalConditions.trim() || null,
      severeAllergies: severeAllergies.trim() || null,
      emergencyName: emergencyName.trim() || null,
      emergencyPhone: emergencyPhone.trim() || null,
    });
  };

  return (
    <SectionCard title="Edit Profile" description={`Updating record for ${student.studentSystemId}`} className="animate-in fade-in slide-in-from-top-4">
      <div className="grid gap-8">
        <div className="grid gap-6 md:grid-cols-2">
           <FormField label="First Name (EN)">
             <input className="premium-input" value={firstNameEn} onChange={(e) => setFirstNameEn(e.target.value)} />
           </FormField>
           <FormField label="Last Name (EN)">
             <input className="premium-input" value={lastNameEn} onChange={(e) => setLastNameEn(e.target.value)} />
           </FormField>
           <FormField label="Date of Birth">
             <input type="date" className="premium-input" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} />
           </FormField>
           <FormField label="Gender">
             <select className="premium-input" value={gender} onChange={(e) => setGender(e.target.value)}>
               <option value="FEMALE">Female</option>
               <option value="MALE">Male</option>
               <option value="OTHER">Other</option>
             </select>
           </FormField>
        </div>

        <div className="rounded-[2rem] bg-slate-50 p-6 space-y-6">
           <p className="text-sm font-bold text-slate-900 flex items-center gap-2">
             <Heart size={18} className="text-danger-500" />
             Health & Special Needs
           </p>
           <div className="grid gap-6 md:grid-cols-2">
              <FormField label="Medical Conditions">
                <input className="premium-input bg-white" value={medicalConditions} onChange={(e) => setMedicalConditions(e.target.value)} placeholder="e.g. Asthma" />
              </FormField>
              <FormField label="Severe Allergies">
                <input className="premium-input bg-white" value={severeAllergies} onChange={(e) => setSevereAllergies(e.target.value)} placeholder="e.g. Peanuts" />
              </FormField>
           </div>
           
           <div className="space-y-3">
              <label className="text-[0.65rem] font-bold uppercase tracking-wider text-slate-500 ml-1">Disability Status</label>
              <div className="grid gap-4 sm:grid-cols-2">
                 <label className={cn(
                   "flex cursor-pointer items-center gap-3 rounded-xl border p-4 transition-all bg-white",
                   disabilityStatus === 'no' ? "border-primary-500 ring-1 ring-primary-500" : "border-slate-200"
                 )}>
                   <input type="radio" checked={disabilityStatus === 'no'} onChange={() => setDisabilityStatus('no')} />
                   <span className="text-sm font-bold text-slate-900">No known disability</span>
                 </label>
                 <label className={cn(
                   "flex cursor-pointer items-center gap-3 rounded-xl border p-4 transition-all bg-white",
                   disabilityStatus === 'yes' ? "border-primary-500 ring-1 ring-primary-500" : "border-slate-200"
                 )}>
                   <input type="radio" checked={disabilityStatus === 'yes'} onChange={() => setDisabilityStatus('yes')} />
                   <span className="text-sm font-bold text-slate-900">Disability Present</span>
                 </label>
              </div>
              {disabilityStatus === 'yes' && (
                <input className="premium-input bg-white" value={disabilityFlag} onChange={(e) => setDisabilityFlag(e.target.value)} placeholder="Specify details..." />
              )}
           </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
           <FormField label="Emergency Contact Name">
             <input className="premium-input" value={emergencyName} onChange={(e) => setEmergencyName(e.target.value)} />
           </FormField>
           <FormField label="Emergency Phone">
             <input className="premium-input" value={emergencyPhone} onChange={(e) => setEmergencyPhone(e.target.value)} />
           </FormField>
        </div>

        {validationError && <p className="text-sm font-bold text-danger-500">{validationError}</p>}
        {error && <p className="text-sm font-bold text-danger-500">{error.message}</p>}

        <div className="flex items-center justify-end gap-3 pt-6 border-t border-slate-100">
           <button type="button" onClick={onCancel} className="flex items-center gap-2 px-6 py-2.5 text-sm font-bold text-slate-500 hover:text-slate-900">
             <X size={18} />
             Cancel
           </button>
           <button 
             type="button" 
             onClick={handleSave} 
             disabled={isSaving}
             className="flex items-center gap-2 rounded-xl bg-slate-900 px-8 py-2.5 text-sm font-bold text-white shadow-lg transition hover:bg-slate-800 disabled:opacity-50"
            >
             <Save size={18} />
             {isSaving ? 'Saving...' : 'Save Changes'}
           </button>
        </div>
      </div>
    </SectionCard>
  );
}

function FormField({ label, children, error }: { label: string; children: React.ReactNode; error?: string }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[0.65rem] font-bold uppercase tracking-wider text-slate-500 ml-1">{label}</label>
      {children}
      {error && <p className="text-[0.7rem] font-bold text-danger-500 ml-1">{error}</p>}
    </div>
  );
}
