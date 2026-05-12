'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Input } from '../ui/input';
import { Select } from '../ui/select';
import { Loader2, Plus, Trash2, AlertCircle } from 'lucide-react';
import { cn } from '../../lib/utils';

type VoucherType = 'EXPENSE' | 'PAYMENT' | 'RECEIPT' | 'CONTRA';

interface VoucherDialogProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: any[];
}

export function VoucherDialog({ isOpen, onClose, accounts }: VoucherDialogProps) {
  const queryClient = useQueryClient();
  const [type, setType] = useState<VoucherType>('EXPENSE');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    expenseAccountId: '',
    paymentAccountId: '',
    payeeAccountId: '',
    receiptAccountId: '',
    depositAccountId: '',
    fromAccountId: '',
    toAccountId: '',
    amount: 0,
    entryDate: new Date().toISOString().split('T')[0],
    narration: '',
    reference: '',
  });

  const mutation = useMutation({
    mutationFn: (data: any) => {
      if (type === 'EXPENSE') return api.createExpenseVoucher(data);
      if (type === 'PAYMENT') return api.createPaymentVoucher(data);
      if (type === 'RECEIPT') return api.createReceiptVoucher(data);
      return api.createContraVoucher(data);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['ledger-entries'] });
      void queryClient.invalidateQueries({ queryKey: ['accounting-summary'] });
      void queryClient.invalidateQueries({ queryKey: ['accounting-report'] });
      onClose();
    },
    onError: (err: any) => {
      setError(err.message || 'Failed to create voucher');
    },
    onSettled: () => setLoading(false),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    
    const payload: any = {
      amount: Number(formData.amount),
      entryDate: formData.entryDate,
      narration: formData.narration,
      reference: formData.reference,
    };

    if (type === 'EXPENSE') {
      payload.expenseAccountId = formData.expenseAccountId;
      payload.paymentAccountId = formData.paymentAccountId;
    } else if (type === 'PAYMENT') {
      payload.payeeAccountId = formData.payeeAccountId;
      payload.paymentAccountId = formData.paymentAccountId;
    } else if (type === 'RECEIPT') {
      payload.receiptAccountId = formData.receiptAccountId;
      payload.depositAccountId = formData.depositAccountId;
    } else if (type === 'CONTRA') {
      payload.fromAccountId = formData.fromAccountId;
      payload.toAccountId = formData.toAccountId;
    }

    mutation.mutate(payload);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create New Voucher</DialogTitle>
        </DialogHeader>

        {error && (
          <div className="mt-4 rounded-xl bg-rose-50 border border-rose-100 p-4 text-sm font-medium text-rose-800 flex items-center gap-2">
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2 col-span-2">
              <label className="text-sm font-medium text-slate-700">Voucher Type</label>
              <Select value={type} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setType(e.target.value as VoucherType)}>
                <option value="EXPENSE">Expense Voucher</option>
                <option value="PAYMENT">Payment Voucher</option>
                <option value="RECEIPT">Receipt Voucher</option>
                <option value="CONTRA">Contra (Transfer)</option>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Entry Date</label>
              <Input
                type="date"
                value={formData.entryDate}
                onChange={(e) => setFormData({ ...formData, entryDate: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Amount</label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: Number(e.target.value) })}
                required
              />
            </div>

            {type === 'EXPENSE' && (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Expense Account</label>
                  <Select 
                    value={formData.expenseAccountId} 
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFormData({ ...formData, expenseAccountId: e.target.value })}
                  >
                    <option value="">Select account</option>
                    {accounts.filter(a => a.type === 'EXPENSE').map(a => (
                      <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Payment Account (Bank/Cash)</label>
                  <Select 
                    value={formData.paymentAccountId} 
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFormData({ ...formData, paymentAccountId: e.target.value })}
                  >
                    <option value="">Select account</option>
                    {accounts.filter(a => ['ASSET', 'LIABILITY'].includes(a.type)).map(a => (
                      <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                    ))}
                  </Select>
                </div>
              </>
            )}

            {type === 'PAYMENT' && (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Payee Account (Vendor/Liability)</label>
                  <Select 
                    value={formData.payeeAccountId} 
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFormData({ ...formData, payeeAccountId: e.target.value })}
                  >
                    <option value="">Select account</option>
                    {accounts.map(a => (
                      <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Payment Account (Bank/Cash)</label>
                  <Select 
                    value={formData.paymentAccountId} 
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFormData({ ...formData, paymentAccountId: e.target.value })}
                  >
                    <option value="">Select account</option>
                    {accounts.filter(a => ['ASSET', 'LIABILITY'].includes(a.type)).map(a => (
                      <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                    ))}
                  </Select>
                </div>
              </>
            )}

            {type === 'RECEIPT' && (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Receipt Account (Income/Client)</label>
                  <Select 
                    value={formData.receiptAccountId} 
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFormData({ ...formData, receiptAccountId: e.target.value })}
                  >
                    <option value="">Select account</option>
                    {accounts.map(a => (
                      <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Deposit Account (Bank/Cash)</label>
                  <Select 
                    value={formData.depositAccountId} 
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFormData({ ...formData, depositAccountId: e.target.value })}
                  >
                    <option value="">Select account</option>
                    {accounts.filter(a => ['ASSET', 'LIABILITY'].includes(a.type)).map(a => (
                      <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                    ))}
                  </Select>
                </div>
              </>
            )}

            {type === 'CONTRA' && (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">From Account (Source)</label>
                  <Select 
                    value={formData.fromAccountId} 
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFormData({ ...formData, fromAccountId: e.target.value })}
                  >
                    <option value="">Select account</option>
                    {accounts.filter(a => ['ASSET', 'LIABILITY'].includes(a.type)).map(a => (
                      <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">To Account (Destination)</label>
                  <Select 
                    value={formData.toAccountId} 
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFormData({ ...formData, toAccountId: e.target.value })}
                  >
                    <option value="">Select account</option>
                    {accounts.filter(a => ['ASSET', 'LIABILITY'].includes(a.type)).map(a => (
                      <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                    ))}
                  </Select>
                </div>
              </>
            )}

            <div className="space-y-2 col-span-2">
              <label className="text-sm font-medium text-slate-700">Narration</label>
              <Input
                value={formData.narration}
                onChange={(e) => setFormData({ ...formData, narration: e.target.value })}
                placeholder="Description of the transaction"
                required
              />
            </div>

            <div className="space-y-2 col-span-2">
              <label className="text-sm font-medium text-slate-700">Reference (Optional)</label>
              <Input
                value={formData.reference}
                onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                placeholder="Cheque No, Invoice No, etc."
              />
            </div>
          </div>

          <DialogFooter className="pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-6 py-2 text-sm font-semibold text-white shadow-lg transition-all hover:bg-slate-800 disabled:opacity-50"
            >
              {loading && <Loader2 size={16} className="animate-spin" />}
              Create Voucher
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
