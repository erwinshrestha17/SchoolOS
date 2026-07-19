'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { api } from '../../lib/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Button } from '../ui/button';
import { FormField, Input, Select, TextArea } from '../ui/form-field';
import { Toast } from '../ui/toast';
import { X, Shield } from 'lucide-react';
import { isValidDateOfBirth, isValidEmail, isValidPersonName, normalizeEmail, normalizeNepalPhone, normalizePersonName, tryNormalizeNepalPhone } from '@schoolos/core';
import { NepalAddressSelector, type NepalAddressValue } from '../geography/nepal-address-selector';

type StaffCreateDialogProps = {
  isOpen: boolean;
  onClose: () => void;
};

export function StaffCreateDialog({ isOpen, onClose }: StaffCreateDialogProps) {
  const queryClient = useQueryClient();
  const router = useRouter();

  const [toastError, setToastError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    employeeId: '',
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    phone: '',
    dateOfBirth: '',
    gender: '',
    address: '',
    joiningDate: new Date().toISOString().slice(0, 10),
    contractType: '',
    teacherRegistryId: '',
    citizenshipNo: '',
    panNumber: '',
    bankAccount: '',
    bankName: '',
    qualifications: '',
    experience: '',
    probationEndDate: '',
    roleIds: [] as string[],
  });

  // Structured, backend-validated address (Province -> District -> Local
  // Level -> Ward/Tole/Street/Landmark). Kept separate from the legacy
  // free-text `address` field above -- both are sent together so the legacy
  // text is preserved rather than replaced.
  const [nepalAddress, setNepalAddress] = useState<NepalAddressValue>({});

  const rolesQuery = useQuery({
    queryKey: ['roles'],
    queryFn: api.listRoles,
    enabled: isOpen,
  });

  const createMutation = useMutation({
    mutationFn: api.createStaff,
    onSuccess: (data: any) => {
      void queryClient.invalidateQueries({ queryKey: ['staff'] });
      onClose();
      if (data && data.id) {
        router.push(`/dashboard/hr/staff/${data.id}`);
      }
    },
    onError: (error: any) => {
      setToastError(error.message || 'Failed to create staff member.');
    },
  });

  const handleChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleRoleToggle = (roleId: string) => {
    setFormData((prev) => {
      const alreadySelected = prev.roleIds.includes(roleId);
      const newRoleIds = alreadySelected
        ? prev.roleIds.filter((id) => id !== roleId)
        : [...prev.roleIds, roleId];
      return { ...prev, roleIds: newRoleIds };
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setToastError(null);

    const requiredText = [
      formData.firstName,
      formData.lastName,
      formData.email,
      formData.password,
      formData.address,
    ];
    if (requiredText.some((value) => value.trim().length === 0) || !formData.dateOfBirth || !formData.gender || !formData.joiningDate || !formData.contractType) {
      setToastError('Please fill out all required fields.');
      return;
    }
    if (formData.password.trim().length < 8) {
      setToastError('Password must be at least 8 characters long.');
      return;
    }
    if (!isValidPersonName(formData.firstName) || !isValidPersonName(formData.lastName)) {
      setToastError('Enter valid staff names using Nepali or English letters.');
      return;
    }
    if (!isValidEmail(formData.email)) { setToastError('Enter a valid email address.'); return; }
    if (!isValidDateOfBirth(formData.dateOfBirth)) { setToastError('Date of birth cannot be future or more than 120 years ago.'); return; }
    if (formData.phone && !tryNormalizeNepalPhone(formData.phone)) { setToastError('Enter a valid NTC or Ncell mobile number.'); return; }
    if (formData.roleIds.length === 0) {
      setToastError('Please assign at least one role to the staff member.');
      return;
    }

    const optionalTrim = (value: string) => {
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : undefined;
    };

    const payload = {
      ...formData,
      employeeId: optionalTrim(formData.employeeId),
      firstName: normalizePersonName(formData.firstName),
      lastName: normalizePersonName(formData.lastName),
      email: normalizeEmail(formData.email),
      password: formData.password.trim(),
      address: formData.address.trim(),
      phone: formData.phone ? normalizeNepalPhone(formData.phone) : undefined,
      teacherRegistryId: optionalTrim(formData.teacherRegistryId),
      citizenshipNo: optionalTrim(formData.citizenshipNo),
      panNumber: optionalTrim(formData.panNumber),
      bankAccount: optionalTrim(formData.bankAccount),
      bankName: optionalTrim(formData.bankName),
      qualifications: optionalTrim(formData.qualifications),
      experience: optionalTrim(formData.experience),
      probationEndDate: optionalTrim(formData.probationEndDate),
      addresses: nepalAddress.localLevelId
        ? [{ addressType: 'PERMANENT' as const, ...nepalAddress }]
        : undefined,
    };

    createMutation.mutate(payload);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[85vh]">
        <DialogHeader className="flex justify-between items-center pr-12">
          <div>
            <DialogTitle>Add New Staff Member</DialogTitle>
            <p className="text-xs text-slate-500 mt-1">Create user credentials and configure initial HR profiles.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="absolute top-6 right-6 p-2 rounded-xl text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-colors"
          >
            <X size={16} />
          </button>
        </DialogHeader>

        {toastError && (
          <Toast
            title="Validation Error"
            description={toastError}
            tone="danger"
            onDismiss={() => setToastError(null)}
            className="m-6"
          />
        )}

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-8">
          {/* Section: Credentials */}
          <div className="space-y-4">
            <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 border-b pb-2 flex items-center gap-2">
              <Shield size={14} className="text-[var(--color-mod-hr-text)]" />
              Credentials & Security
            </h4>
            <div className="grid md:grid-cols-3 gap-4">
              <FormField label="Email (Required)">
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleChange('email', e.target.value)}
                  placeholder="name@school.com"
                  required
                />
              </FormField>
              <FormField label="Password (Required)">
                <Input
                  type="password"
                  value={formData.password}
                  onChange={(e) => handleChange('password', e.target.value)}
                  placeholder="Min 8 characters"
                  required
                />
              </FormField>
              <FormField label="Employee ID / Code">
                <Input
                  type="text"
                  value={formData.employeeId}
                  onChange={(e) => handleChange('employeeId', e.target.value)}
                  placeholder="Auto-generated if blank"
                />
              </FormField>
            </div>
          </div>

          {/* Section: Personal Info */}
          <div className="space-y-4">
            <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 border-b pb-2">
              Personal Information
            </h4>
            <div className="grid md:grid-cols-4 gap-4">
              <FormField label="First Name (Required)" className="md:col-span-2">
                <Input
                  type="text"
                  value={formData.firstName}
                  onChange={(e) => handleChange('firstName', e.target.value)}
                  placeholder="First name"
                  required
                />
              </FormField>
              <FormField label="Last Name (Required)" className="md:col-span-2">
                <Input
                  type="text"
                  value={formData.lastName}
                  onChange={(e) => handleChange('lastName', e.target.value)}
                  placeholder="Last name"
                  required
                />
              </FormField>
              <FormField label="Date of Birth (Required)">
                <Input
                  type="date"
                  value={formData.dateOfBirth}
                  onChange={(e) => handleChange('dateOfBirth', e.target.value)}
                  required
                />
              </FormField>
              <FormField label="Gender (Required)">
                <Select
                  value={formData.gender}
                  onChange={(e) => handleChange('gender', e.target.value)}
                >
                  <option value="">Select gender</option>
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                  <option value="OTHER">Other</option>
                </Select>
              </FormField>
              <FormField label="Phone Number" className="md:col-span-2">
                <Input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => handleChange('phone', e.target.value)}
                  placeholder="Contact phone"
                />
              </FormField>
              <FormField label="Residential Address (Required)" className="md:col-span-4">
                <Input
                  type="text"
                  value={formData.address}
                  onChange={(e) => handleChange('address', e.target.value)}
                  placeholder="Full address"
                  required
                />
              </FormField>
              <div className="md:col-span-4">
                <FormField label="Structured Address (Optional)">
                  <NepalAddressSelector
                    idPrefix="staff-create-address"
                    value={nepalAddress}
                    onChange={setNepalAddress}
                  />
                </FormField>
              </div>
            </div>
          </div>

          {/* Section: Contract */}
          <div className="space-y-4">
            <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 border-b pb-2">
              Employment Details
            </h4>
            <div className="grid md:grid-cols-3 gap-4">
              <FormField label="Joining Date (Required)">
                <Input
                  type="date"
                  value={formData.joiningDate}
                  onChange={(e) => handleChange('joiningDate', e.target.value)}
                  required
                />
              </FormField>
              <FormField label="Contract Type (Required)">
                <Select
                  value={formData.contractType}
                  onChange={(e) => handleChange('contractType', e.target.value)}
                >
                  <option value="">Select contract type</option>
                  <option value="PERMANENT">Permanent</option>
                  <option value="CONTRACT">Contract</option>
                  <option value="PROBATION">Probation</option>
                  <option value="TEMPORARY">Temporary</option>
                </Select>
              </FormField>
              <FormField label="Teacher Registry ID">
                <Input
                  type="text"
                  value={formData.teacherRegistryId}
                  onChange={(e) => handleChange('teacherRegistryId', e.target.value)}
                  placeholder="If teaching staff"
                />
              </FormField>
              <FormField label="Citizenship No">
                <Input
                  type="text"
                  value={formData.citizenshipNo}
                  onChange={(e) => handleChange('citizenshipNo', e.target.value)}
                  placeholder="National ID / Citizenship number"
                />
              </FormField>
              <FormField label="PAN Number">
                <Input
                  type="text"
                  value={formData.panNumber}
                  onChange={(e) => handleChange('panNumber', e.target.value)}
                  placeholder="Taxpayer identity (PAN)"
                />
              </FormField>
              <FormField label="Probation End Date">
                <Input
                  type="date"
                  value={formData.probationEndDate}
                  onChange={(e) => handleChange('probationEndDate', e.target.value)}
                />
              </FormField>
            </div>
          </div>

          {/* Section: Financials */}
          <div className="space-y-4">
            <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 border-b pb-2">
              Banking & Financials
            </h4>
            <div className="grid md:grid-cols-2 gap-4">
              <FormField label="Bank Name">
                <Input
                  type="text"
                  value={formData.bankName}
                  onChange={(e) => handleChange('bankName', e.target.value)}
                  placeholder="Standard bank name"
                />
              </FormField>
              <FormField label="Bank Account Number">
                <Input
                  type="text"
                  value={formData.bankAccount}
                  onChange={(e) => handleChange('bankAccount', e.target.value)}
                  placeholder="Disbursement account number"
                />
              </FormField>
            </div>
          </div>

          {/* Section: Roles */}
          <div className="space-y-4">
            <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 border-b pb-2">
              Assigned Security Roles (Min 1)
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {rolesQuery.isLoading ? (
                <div className="col-span-full text-xs text-slate-400 animate-pulse font-bold uppercase tracking-widest">
                  Loading available roles...
                </div>
              ) : (rolesQuery.data ?? []).length > 0 ? (
                (rolesQuery.data ?? []).map((role) => (
                  <label
                    key={role.id}
                    className={`flex items-center gap-3 p-3 rounded-2xl border transition-all cursor-pointer select-none ${
                      formData.roleIds.includes(role.id)
                        ? 'border-[var(--color-mod-hr-border)] bg-[var(--color-mod-hr-soft)]/60 font-bold text-[var(--color-mod-hr-text)]'
                        : 'border-slate-100 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={formData.roleIds.includes(role.id)}
                      onChange={() => handleRoleToggle(role.id)}
                      className="h-4 w-4 rounded border-slate-300 text-[var(--color-mod-hr-accent)] focus:ring-[var(--color-mod-hr-border)]/50"
                    />
                    <span className="text-xs font-medium uppercase tracking-tight">{role.name}</span>
                  </label>
                ))
              ) : (
                <div className="col-span-full text-xs text-rose-500 font-bold">
                  No security roles found. Ensure role configurations are synced.
                </div>
              )}
            </div>
          </div>

          {/* Section: Background */}
          <div className="space-y-4">
            <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 border-b pb-2">
              Experience & Qualifications
            </h4>
            <div className="grid md:grid-cols-2 gap-4">
              <FormField label="Academic Qualifications">
                <TextArea
                  value={formData.qualifications}
                  onChange={(e) => handleChange('qualifications', e.target.value)}
                  placeholder="Degrees, certifications, etc."
                />
              </FormField>
              <FormField label="Prior Experience">
                <TextArea
                  value={formData.experience}
                  onChange={(e) => handleChange('experience', e.target.value)}
                  placeholder="Employment record and history"
                />
              </FormField>
            </div>
          </div>
        </form>

        <DialogFooter className="bg-slate-50 border-t flex justify-end gap-3 p-6">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            onClick={handleSubmit}
            isLoading={createMutation.isPending}
            disabled={createMutation.isPending}
            className="bg-[var(--color-mod-hr-accent)] hover:bg-[var(--color-mod-hr-text)]"
          >
            Create Staff Member
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
