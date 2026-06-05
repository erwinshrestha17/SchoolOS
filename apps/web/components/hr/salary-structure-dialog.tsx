'use client';

import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Button } from '../ui/button';
import { FormField, Input, Select, TextArea } from '../ui/form-field';
import { Checkbox } from '../ui/checkbox';
import { Toast } from '../ui/toast';
import { X, Plus, Trash2, Calculator, Percent } from 'lucide-react';

type ComponentRow = {
  name: string;
  componentType: 'EARNING' | 'DEDUCTION';
  amount: number;
  taxable: boolean;
};

type SalaryStructureDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  lockedStaffId?: string;
  existingStructure?: {
    id: string;
    staffId: string;
    effectiveFrom: string;
    effectiveTo: string | null;
    basicSalary: number;
    allowances: number;
    deductions: number;
    pfEnabled: boolean;
    tdsEnabled: boolean;
    paymentMethod: string;
    bankName: string | null;
    bankAccount: string | null;
    components?: any[];
  } | null;
};

export function SalaryStructureDialog({
  isOpen,
  onClose,
  lockedStaffId,
  existingStructure,
}: SalaryStructureDialogProps) {
  const queryClient = useQueryClient();
  const [toastError, setToastError] = useState<string | null>(null);

  const isEdit = !!existingStructure;

  const [staffId, setStaffId] = useState(lockedStaffId ?? '');
  const [effectiveFrom, setEffectiveFrom] = useState(new Date().toISOString().slice(0, 10));
  const [effectiveTo, setEffectiveTo] = useState('');
  const [basicSalary, setBasicSalary] = useState<number>(0);
  const [pfEnabled, setPfEnabled] = useState(false);
  const [tdsEnabled, setTdsEnabled] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('BANK');
  const [bankName, setBankName] = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [notes, setNotes] = useState('');

  // Custom components list
  const [components, setComponents] = useState<ComponentRow[]>([]);

  // Local component row inputs
  const [newCompName, setNewCompName] = useState('');
  const [newCompType, setNewCompType] = useState<'EARNING' | 'DEDUCTION'>('EARNING');
  const [newCompAmount, setNewCompAmount] = useState<number>(0);
  const [newCompTaxable, setNewCompTaxable] = useState(true);

  const staffQuery = useQuery({
    queryKey: ['staff'],
    queryFn: api.listStaff,
    enabled: isOpen && !lockedStaffId && !isEdit,
  });

  useEffect(() => {
    if (existingStructure) {
      setStaffId(existingStructure.staffId);
      setEffectiveFrom(existingStructure.effectiveFrom.slice(0, 10));
      setEffectiveTo(existingStructure.effectiveTo ? existingStructure.effectiveTo.slice(0, 10) : '');
      setBasicSalary(existingStructure.basicSalary);
      setPfEnabled(existingStructure.pfEnabled);
      setTdsEnabled(existingStructure.tdsEnabled);
      setPaymentMethod(existingStructure.paymentMethod);
      setBankName(existingStructure.bankName ?? '');
      setBankAccount(existingStructure.bankAccount ?? '');
      
      const loadedComponents = existingStructure.components?.map((c) => ({
        name: c.name,
        componentType: c.componentType as 'EARNING' | 'DEDUCTION',
        amount: c.amount,
        taxable: c.taxable,
      })) ?? [];
      setComponents(loadedComponents);
    } else {
      // Defaults
      setEffectiveFrom(new Date().toISOString().slice(0, 10));
      setEffectiveTo('');
      setBasicSalary(0);
      setPfEnabled(false);
      setTdsEnabled(false);
      setPaymentMethod('BANK');
      setBankName('');
      setBankAccount('');
      setComponents([]);
      if (!lockedStaffId) setStaffId('');
    }
  }, [existingStructure, isOpen, lockedStaffId]);

  // Calculate allowances and deductions dynamically
  const allowancesSum = components
    .filter((c) => c.componentType === 'EARNING')
    .reduce((sum, c) => sum + c.amount, 0);

  const deductionsSum = components
    .filter((c) => c.componentType === 'DEDUCTION')
    .reduce((sum, c) => sum + c.amount, 0);

  const totalGross = basicSalary + allowancesSum;
  const totalNet = totalGross - deductionsSum;

  const saveMutation = useMutation({
    mutationFn: (payload: any) => {
      if (isEdit && existingStructure) {
        return api.updateSalaryStructure(existingStructure.id, payload);
      } else {
        return api.createSalaryStructure(payload);
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['salary-structures'] });
      void queryClient.invalidateQueries({ queryKey: ['staff-detail', lockedStaffId || staffId] });
      void queryClient.invalidateQueries({ queryKey: ['payroll-preview'] });
      onClose();
    },
    onError: (error: any) => {
      setToastError(error.message || 'Failed to save salary structure.');
    },
  });

  const handleAddComponent = () => {
    const trimmedName = newCompName.trim();
    if (!trimmedName) return;
    if (newCompAmount <= 0) return;

    setComponents((prev) => [
      ...prev,
      {
        name: trimmedName,
        componentType: newCompType,
        amount: newCompAmount,
        taxable: newCompTaxable,
      },
    ]);

    setNewCompName('');
    setNewCompAmount(0);
    setNewCompTaxable(true);
  };

  const handleRemoveComponent = (index: number) => {
    setComponents((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setToastError(null);

    const activeStaffId = lockedStaffId || staffId;

    if (!activeStaffId) {
      setToastError('Please select a staff member.');
      return;
    }
    if (basicSalary <= 0) {
      setToastError('Basic salary must be greater than 0.');
      return;
    }
    if (!effectiveFrom) {
      setToastError('Please specify an effective from date.');
      return;
    }

    const optionalTrim = (value: string) => {
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : undefined;
    };

    const payload = {
      staffId: activeStaffId,
      effectiveFrom: new Date(effectiveFrom).toISOString(),
      effectiveTo: effectiveTo ? new Date(effectiveTo).toISOString() : null,
      basicSalary,
      allowances: allowancesSum,
      deductions: deductionsSum,
      pfEnabled,
      tdsEnabled,
      paymentMethod,
      bankName: paymentMethod === 'BANK' ? optionalTrim(bankName) : undefined,
      bankAccount: paymentMethod === 'BANK' ? optionalTrim(bankAccount) : undefined,
      notes: optionalTrim(notes),
      components,
    };

    saveMutation.mutate(payload);
  };

  const staffList = staffQuery.data ?? [];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[85vh] rounded-2xl">
        <DialogHeader className="flex justify-between items-center pr-12">
          <div>
            <DialogTitle className="flex items-center gap-2">
              <Calculator size={20} className="text-[var(--color-mod-hr-text)]" />
              {isEdit ? 'Update Salary Structure' : 'Create Salary Structure'}
            </DialogTitle>
            <p className="text-xs text-slate-500 mt-1">
              Configure basic pay, custom allowances, deductions, and tax configurations.
            </p>
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
          <div className="grid md:grid-cols-3 gap-6">
            <div className="space-y-5 md:col-span-1">
              <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 border-b pb-2">
                Structure Rules
              </h4>

              {!lockedStaffId && !isEdit ? (
                <FormField label="Staff Member">
                  <Select value={staffId} onChange={(e) => setStaffId(e.target.value)}>
                    <option value="">Choose staff...</option>
                    {staffList.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.firstName} {s.lastName} ({s.employeeId})
                      </option>
                    ))}
                  </Select>
                </FormField>
              ) : null}

              <FormField label="Basic Salary (Required)">
                <Input
                  type="number"
                  value={basicSalary}
                  onChange={(e) => setBasicSalary(Number(e.target.value))}
                  placeholder="Basic component in NPR"
                  required
                />
              </FormField>

              <div className="grid grid-cols-2 gap-4">
                <FormField label="Effective From">
                  <Input
                    type="date"
                    value={effectiveFrom}
                    onChange={(e) => setEffectiveFrom(e.target.value)}
                    required
                  />
                </FormField>
                <FormField label="Effective To">
                  <Input
                    type="date"
                    value={effectiveTo}
                    onChange={(e) => setEffectiveTo(e.target.value)}
                  />
                </FormField>
              </div>

              <div className="space-y-3 pt-3 border-t">
                <label className="flex items-center gap-3 p-3 bg-slate-50/50 rounded-2xl cursor-pointer select-none hover:bg-slate-50 transition-colors border border-slate-100">
                  <input
                    type="checkbox"
                    checked={pfEnabled}
                    onChange={(e) => setPfEnabled(e.target.checked)}
                    className="rounded border-slate-300 text-[var(--color-mod-hr-accent)] focus:ring-[var(--color-mod-hr-border)]/50 h-4 w-4"
                  />
                  <div>
                    <p className="text-xs font-black uppercase tracking-wider text-slate-900">PF Contribution</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">Enable Provident Fund deduction</p>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3 bg-slate-50/50 rounded-2xl cursor-pointer select-none hover:bg-slate-50 transition-colors border border-slate-100">
                  <input
                    type="checkbox"
                    checked={tdsEnabled}
                    onChange={(e) => setTdsEnabled(e.target.checked)}
                    className="rounded border-slate-300 text-[var(--color-mod-hr-accent)] focus:ring-[var(--color-mod-hr-border)]/50 h-4 w-4"
                  />
                  <div>
                    <p className="text-xs font-black uppercase tracking-wider text-slate-900">TDS Deduction</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">Enable Tax Deducted at Source</p>
                  </div>
                </label>
              </div>
            </div>

            {/* Custom Components Configuration */}
            <div className="space-y-5 md:col-span-2 border-l pl-6">
              <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 border-b pb-2">
                Salary Components
              </h4>

              {/* Input row for custom components */}
              <div className="grid grid-cols-6 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-100 items-end">
                <div className="col-span-2">
                  <FormField label="Component Name">
                    <Input
                      type="text"
                      value={newCompName}
                      onChange={(e) => setNewCompName(e.target.value)}
                      placeholder="e.g. Travel, Housing"
                    />
                  </FormField>
                </div>
                <div>
                  <FormField label="Type">
                    <Select
                      value={newCompType}
                      onChange={(e) => setNewCompType(e.target.value as any)}
                    >
                      <option value="EARNING">Earning</option>
                      <option value="DEDUCTION">Deduction</option>
                    </Select>
                  </FormField>
                </div>
                <div>
                  <FormField label="Amount">
                    <Input
                      type="number"
                      value={newCompAmount}
                      onChange={(e) => setNewCompAmount(Number(e.target.value))}
                      placeholder="Amount"
                    />
                  </FormField>
                </div>
                <div className="flex flex-col justify-center items-center h-12 pb-2">
                  <span className="text-[9px] font-black uppercase text-slate-400 mb-2">Taxable</span>
                  <input
                    type="checkbox"
                    checked={newCompTaxable}
                    onChange={(e) => setNewCompTaxable(e.target.checked)}
                    className="rounded border-slate-300 text-[var(--color-mod-hr-accent)] focus:ring-[var(--color-mod-hr-border)]/50 h-4 w-4"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleAddComponent}
                  disabled={!newCompName.trim() || newCompAmount <= 0}
                  className="h-12 w-full rounded-2xl bg-[var(--color-mod-hr-accent)] hover:bg-[var(--color-mod-hr-text)] text-white font-bold flex items-center justify-center transition-all disabled:opacity-50"
                >
                  <Plus size={18} />
                </button>
              </div>

              {/* Added Components list */}
              <div className="rounded-2xl border border-slate-100 overflow-hidden">
                {components.length > 0 ? (
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-50/50 border-b border-slate-100">
                      <tr>
                        <th className="px-4 py-3 font-bold text-slate-500">Component Name</th>
                        <th className="px-4 py-3 font-bold text-slate-500">Type</th>
                        <th className="px-4 py-3 font-bold text-slate-500 text-right">Amount</th>
                        <th className="px-4 py-3 font-bold text-slate-500 text-center">Taxable</th>
                        <th className="px-4 py-3 font-bold text-slate-500 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {components.map((c, index) => (
                        <tr key={index} className="hover:bg-slate-50/30 transition-colors">
                          <td className="px-4 py-3 font-bold text-slate-900">{c.name}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex rounded-full px-2 py-0.5 text-[8px] font-black uppercase border ${
                              c.componentType === 'EARNING'
                                ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                                : 'bg-rose-50 text-rose-600 border-rose-100'
                            }`}>
                              {c.componentType}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-black text-slate-900">
                            NPR {c.amount.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {c.taxable ? <Percent size={12} className="text-[var(--color-mod-hr-text)] mx-auto" /> : '-'}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              type="button"
                              onClick={() => handleRemoveComponent(index)}
                              className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="py-8 text-center text-slate-400 italic">
                    No custom components configured. Basic salary is active.
                  </div>
                )}
              </div>

              {/* Totals Summary */}
              <div className="grid grid-cols-4 gap-3 bg-slate-50/80 p-4 border border-slate-100 rounded-2xl text-xs font-bold">
                <div>
                  <p className="text-slate-400 font-bold uppercase tracking-wider text-[9px]">Basic</p>
                  <p className="text-slate-900 mt-1">NPR {basicSalary.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-slate-400 font-bold uppercase tracking-wider text-[9px]">Allowances</p>
                  <p className="text-emerald-600 mt-1">+ NPR {allowancesSum.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-slate-400 font-bold uppercase tracking-wider text-[9px]">Deductions</p>
                  <p className="text-rose-600 mt-1">- NPR {deductionsSum.toLocaleString()}</p>
                </div>
                <div className="border-l pl-4 border-slate-200">
                  <p className="text-slate-400 font-bold uppercase tracking-wider text-[9px]">Est. Net Pay</p>
                  <p className="text-[var(--color-mod-hr-text)] text-sm mt-0.5">NPR {totalNet.toLocaleString()}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6 pt-6 border-t">
            <FormField label="Disbursement Details">
              <div className="grid grid-cols-2 gap-4">
                <Select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                  <option value="BANK">Bank Transfer</option>
                  <option value="CASH">Cash</option>
                  <option value="CHEQUE">Cheque</option>
                  <option value="TRANSFER">Online Transfer</option>
                  <option value="MOBILE">Mobile Wallet</option>
                </Select>
                {paymentMethod === 'BANK' && (
                  <Input
                    type="text"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    placeholder="Bank Name"
                  />
                )}
              </div>
            </FormField>

            {paymentMethod === 'BANK' ? (
              <FormField label="Account Number">
                <Input
                  type="text"
                  value={bankAccount}
                  onChange={(e) => setBankAccount(e.target.value)}
                  placeholder="Disbursement bank account number"
                />
              </FormField>
            ) : (
              <FormField label="Remarks / Note">
                <Input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Payment remarks"
                />
              </FormField>
            )}
          </div>
        </form>

        <DialogFooter className="bg-slate-50 border-t flex justify-end gap-3 p-6">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            onClick={handleSubmit}
            isLoading={saveMutation.isPending}
            disabled={saveMutation.isPending}
            className="bg-[var(--color-mod-hr-accent)] hover:bg-[var(--color-mod-hr-text)]"
          >
            {isEdit ? 'Update Structure' : 'Create Salary Structure'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
