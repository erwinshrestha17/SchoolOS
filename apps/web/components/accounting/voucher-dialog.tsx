'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { toast } from 'sonner';
import { Loader2, Plus, Trash2 } from 'lucide-react';

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
      toast.success(`${type} Voucher created successfully`);
      queryClient.invalidateQueries({ queryKey: ['accounting-report'] });
      onClose();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to create voucher');
    },
    onSettled: () => setLoading(false),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
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

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2 col-span-2">
              <Label>Voucher Type</Label>
              <Select value={type} onValueChange={(v: any) => setType(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="EXPENSE">Expense Voucher</SelectItem>
                  <SelectItem value="PAYMENT">Payment Voucher</SelectItem>
                  <SelectItem value="RECEIPT">Receipt Voucher</SelectItem>
                  <SelectItem value="CONTRA">Contra (Transfer)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Entry Date</Label>
              <Input
                type="date"
                value={formData.entryDate}
                onChange={(e) => setFormData({ ...formData, entryDate: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Amount</Label>
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
                  <Label>Expense Account</Label>
                  <Select 
                    value={formData.expenseAccountId} 
                    onValueChange={(v) => setFormData({ ...formData, expenseAccountId: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select account" />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts.filter(a => a.type === 'EXPENSE').map(a => (
                        <SelectItem key={a.id} value={a.id}>{a.code} - {a.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Payment Account (Bank/Cash)</Label>
                  <Select 
                    value={formData.paymentAccountId} 
                    onValueChange={(v) => setFormData({ ...formData, paymentAccountId: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select account" />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts.filter(a => ['ASSET', 'LIABILITY'].includes(a.type)).map(a => (
                        <SelectItem key={a.id} value={a.id}>{a.code} - {a.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {type === 'PAYMENT' && (
              <>
                <div className="space-y-2">
                  <Label>Payee Account (Vendor/Liability)</Label>
                  <Select 
                    value={formData.payeeAccountId} 
                    onValueChange={(v) => setFormData({ ...formData, payeeAccountId: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select account" />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts.map(a => (
                        <SelectItem key={a.id} value={a.id}>{a.code} - {a.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Payment Account (Bank/Cash)</Label>
                  <Select 
                    value={formData.paymentAccountId} 
                    onValueChange={(v) => setFormData({ ...formData, paymentAccountId: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select account" />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts.filter(a => ['ASSET', 'LIABILITY'].includes(a.type)).map(a => (
                        <SelectItem key={a.id} value={a.id}>{a.code} - {a.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {type === 'RECEIPT' && (
              <>
                <div className="space-y-2">
                  <Label>Receipt Account (Income/Client)</Label>
                  <Select 
                    value={formData.receiptAccountId} 
                    onValueChange={(v) => setFormData({ ...formData, receiptAccountId: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select account" />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts.map(a => (
                        <SelectItem key={a.id} value={a.id}>{a.code} - {a.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Deposit Account (Bank/Cash)</Label>
                  <Select 
                    value={formData.depositAccountId} 
                    onValueChange={(v) => setFormData({ ...formData, depositAccountId: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select account" />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts.filter(a => ['ASSET', 'LIABILITY'].includes(a.type)).map(a => (
                        <SelectItem key={a.id} value={a.id}>{a.code} - {a.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {type === 'CONTRA' && (
              <>
                <div className="space-y-2">
                  <Label>From Account (Source)</Label>
                  <Select 
                    value={formData.fromAccountId} 
                    onValueChange={(v) => setFormData({ ...formData, fromAccountId: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select account" />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts.filter(a => ['ASSET', 'LIABILITY'].includes(a.type)).map(a => (
                        <SelectItem key={a.id} value={a.id}>{a.code} - {a.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>To Account (Destination)</Label>
                  <Select 
                    value={formData.toAccountId} 
                    onValueChange={(v) => setFormData({ ...formData, toAccountId: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select account" />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts.filter(a => ['ASSET', 'LIABILITY'].includes(a.type)).map(a => (
                        <SelectItem key={a.id} value={a.id}>{a.code} - {a.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            <div className="space-y-2 col-span-2">
              <Label>Narration</Label>
              <Input
                value={formData.narration}
                onChange={(e) => setFormData({ ...formData, narration: e.target.value })}
                placeholder="Description of the transaction"
                required
              />
            </div>

            <div className="space-y-2 col-span-2">
              <Label>Reference (Optional)</Label>
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
