"use client";

import {
  formatBsDate,
  getNepalSchoolDay,
  type PlatformSaaSInvoiceSummary,
} from "@schoolos/core";
import { CreditCard, FileClock, Plus, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import {
  PlatformBoundaryNote,
  PlatformEmptyState,
  PlatformInlineError,
  PlatformSectionSkeleton,
} from "@/app/platform/_components/platform-operator-states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useSession } from "@/components/session-provider";
import { platformApi } from "@/lib/api/platform";
import { hasPermission } from "@/lib/session";
import { useTenantDetail } from "./tenant-detail-page";

type InvoiceAction =
  | { mode: "view"; invoice: PlatformSaaSInvoiceSummary }
  | { mode: "payment"; invoice: PlatformSaaSInvoiceSummary }
  | { mode: "cancel"; invoice: PlatformSaaSInvoiceSummary };

export function TenantBilling() {
  const { tenant, refreshTenant } = useTenantDetail();
  const { session } = useSession();
  const canManageBilling = hasPermission(session, "platform:billing:manage");
  const [invoices, setInvoices] = useState<PlatformSaaSInvoiceSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false);
  const [invoiceForm, setInvoiceForm] = useState(makeDefaultInvoiceForm);
  const [invoiceAction, setInvoiceAction] = useState<InvoiceAction | null>(
    null,
  );
  const [paymentForm, setPaymentForm] = useState(makeDefaultPaymentForm);
  const [cancelReason, setCancelReason] = useState("");
  const [billingDialogOpen, setBillingDialogOpen] = useState(false);
  const [billingForm, setBillingForm] = useState(makeDefaultBillingForm);

  const loadInvoices = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const items = await platformApi.listPlatformSaaSInvoices(tenant.id);
      setInvoices(Array.isArray(items) ? items : []);
    } catch (caught) {
      setLoadError(getErrorMessage(caught));
    } finally {
      setLoading(false);
    }
  }, [tenant.id]);

  useEffect(() => {
    void loadInvoices();
  }, [loadInvoices]);

  function openBillingProfile() {
    if (!canManageBilling) return;
    setBillingForm({
      billingContactName: tenant.billingProfile?.billingContactName ?? "",
      billingEmail: tenant.billingProfile?.billingEmail ?? "",
      billingPhone: tenant.billingProfile?.billingPhone ?? "",
      billingAddress: tenant.billingProfile?.billingAddress ?? "",
      panVatNumber:
        tenant.billingProfile?.panVatNumber ?? tenant.panNumber ?? "",
      preferredBillingCycle:
        tenant.billingProfile?.preferredBillingCycle ?? "MONTHLY",
      notes: tenant.billingProfile?.notes ?? "",
    });
    setBillingDialogOpen(true);
  }

  async function createInvoice() {
    if (
      !canManageBilling ||
      !invoiceForm.description.trim() ||
      invoiceForm.dueDate < invoiceForm.issueDate
    ) {
      return;
    }
    setSaving(true);
    setActionError(null);
    try {
      await platformApi.createPlatformSaaSInvoice(tenant.id, {
        issueDate: toIsoDate(invoiceForm.issueDate),
        dueDate: toIsoDate(invoiceForm.dueDate),
        notes: invoiceForm.notes.trim() || undefined,
        planId: tenant.subscription?.planId,
        subscriptionId: tenant.subscription?.id,
        lines: [
          {
            lineType: invoiceForm.lineType,
            description: invoiceForm.description.trim(),
            quantity: Number(invoiceForm.quantity),
            unitAmount: invoiceForm.unitAmount,
          },
        ],
      });
      await loadInvoices();
      setMessage("SchoolOS subscription invoice created.");
      setInvoiceDialogOpen(false);
      setInvoiceForm(makeDefaultInvoiceForm());
    } catch (caught) {
      setActionError(getErrorMessage(caught));
    } finally {
      setSaving(false);
    }
  }

  async function recordPayment() {
    if (
      !canManageBilling ||
      !invoiceAction ||
      invoiceAction.mode !== "payment"
    ) {
      return;
    }
    setSaving(true);
    setActionError(null);
    try {
      await platformApi.recordPlatformSaaSPayment(
        tenant.id,
        invoiceAction.invoice.id,
        {
          amount: paymentForm.amount,
          paymentDate: toIsoDate(paymentForm.paymentDate),
          method: paymentForm.method,
          reference: paymentForm.reference.trim() || undefined,
          notes: paymentForm.notes.trim() || undefined,
        },
      );
      await loadInvoices();
      setMessage("SaaS payment recorded.");
      setInvoiceAction(null);
      setPaymentForm(makeDefaultPaymentForm());
    } catch (caught) {
      setActionError(getErrorMessage(caught));
    } finally {
      setSaving(false);
    }
  }

  async function cancelInvoice() {
    if (
      !canManageBilling ||
      !invoiceAction ||
      invoiceAction.mode !== "cancel" ||
      cancelReason.trim().length < 5
    ) {
      return;
    }
    setSaving(true);
    setActionError(null);
    try {
      await platformApi.cancelPlatformSaaSInvoice(
        tenant.id,
        invoiceAction.invoice.id,
        {
          reason: cancelReason.trim(),
        },
      );
      await loadInvoices();
      setMessage("SaaS invoice cancelled.");
      setInvoiceAction(null);
      setCancelReason("");
    } catch (caught) {
      setActionError(getErrorMessage(caught));
    } finally {
      setSaving(false);
    }
  }

  async function saveBillingProfile() {
    if (!canManageBilling) return;
    if (
      billingForm.billingEmail &&
      !EMAIL_PATTERN.test(billingForm.billingEmail)
    ) {
      setActionError("Enter a valid billing email address.");
      return;
    }
    setSaving(true);
    setActionError(null);
    try {
      await platformApi.updatePlatformBillingProfile(
        tenant.id,
        compactPayload(billingForm),
      );
      await refreshTenant();
      setMessage("Billing profile updated.");
      setBillingDialogOpen(false);
    } catch (caught) {
      setActionError(getErrorMessage(caught));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-7">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-2xl font-black text-slate-900">SaaS billing</h2>
          <p className="mt-1 text-sm text-slate-500">
            SchoolOS invoices, payments, cancellations, and billing contact
            details.
          </p>
        </div>
        {canManageBilling ? (
          <Button
            variant="outline"
            className="rounded-2xl font-bold"
            onClick={() => setInvoiceDialogOpen(true)}
            data-testid="new-saas-invoice-button"
          >
            <Plus className="mr-2" size={17} /> New invoice
          </Button>
        ) : null}
      </div>

      <PlatformBoundaryNote title="SaaS billing boundary">
        This is SchoolOS-to-school subscription billing. It is not M3 student
        fee collection, and it does not post school ledger entries into M11
        Accounting.
      </PlatformBoundaryNote>

      {message || actionError ? (
        <div
          className={`rounded-2xl border p-4 text-sm font-bold ${actionError ? "border-rose-200 bg-rose-50 text-rose-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}
        >
          {actionError ?? message}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
        <Card className="rounded-3xl border-slate-100 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl font-black">
              <CreditCard size={20} /> Subscription invoices
            </CardTitle>
            <CardDescription>
              Real platform billing records returned for this tenant.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <PlatformSectionSkeleton rows={5} />
            ) : loadError ? (
              <PlatformInlineError
                title="SaaS invoices unavailable"
                message={loadError}
                onRetry={() => void loadInvoices()}
              />
            ) : invoices.length === 0 ? (
              <PlatformEmptyState
                icon={FileClock}
                title="No SaaS invoices yet"
                description="Create the first SchoolOS subscription invoice when billing is approved."
              />
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-slate-100">
                <table className="w-full min-w-[780px] text-left text-sm">
                  <thead className="border-b border-slate-100 bg-slate-50">
                    <tr>
                      <th className="px-5 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">
                        Invoice
                      </th>
                      <th className="px-5 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">
                        Issued
                      </th>
                      <th className="px-5 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">
                        Amount
                      </th>
                      <th className="px-5 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">
                        Balance
                      </th>
                      <th className="px-5 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">
                        Status
                      </th>
                      <th className="px-5 py-4">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {invoices.map((invoice) => (
                      <tr key={invoice.id}>
                        <td className="px-5 py-4 font-mono text-xs font-black text-slate-900">
                          {invoice.invoiceNumber}
                        </td>
                        <td className="px-5 py-4 text-slate-600">
                          {formatDate(invoice.issueDate)}
                        </td>
                        <td className="px-5 py-4 font-black text-slate-900">
                          {formatMoney(invoice.currency, invoice.amount)}
                        </td>
                        <td className="px-5 py-4 font-black text-slate-900">
                          {formatMoney(invoice.currency, invoice.balanceAmount)}
                        </td>
                        <td className="px-5 py-4">
                          <Badge
                            variant={
                              invoice.status === "PAID"
                                ? "success"
                                : invoice.status === "OVERDUE"
                                  ? "destructive"
                                  : "neutral"
                            }
                          >
                            {invoice.status}
                          </Badge>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                setInvoiceAction({ mode: "view", invoice })
                              }
                            >
                              View
                            </Button>
                            {canManageBilling ? (
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={
                                  invoice.status === "PAID" ||
                                  invoice.status === "CANCELLED"
                                }
                                onClick={() => {
                                  setPaymentForm({
                                    ...makeDefaultPaymentForm(),
                                    amount: invoice.balanceAmount,
                                  });
                                  setInvoiceAction({
                                    mode: "payment",
                                    invoice,
                                  });
                                }}
                              >
                                Payment
                              </Button>
                            ) : null}
                            {canManageBilling ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-rose-700"
                                disabled={
                                  invoice.status === "PAID" ||
                                  invoice.status === "CANCELLED"
                                }
                                onClick={() =>
                                  setInvoiceAction({ mode: "cancel", invoice })
                                }
                              >
                                Cancel
                              </Button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="h-fit rounded-3xl border-slate-100 shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl font-black">
              Billing profile
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <ProfileValue
              label="Billing email"
              value={
                tenant.billingProfile?.billingEmail ?? "Same as school admin"
              }
            />
            <ProfileValue
              label="Billing address"
              value={tenant.billingProfile?.billingAddress ?? "Not provided"}
            />
            <ProfileValue
              label="Billing cycle"
              value={
                tenant.billingProfile?.preferredBillingCycle ?? "Not configured"
              }
            />
            {canManageBilling ? (
              <Button
                variant="outline"
                className="w-full rounded-2xl font-bold"
                onClick={openBillingProfile}
                data-testid="billing-profile-edit-button"
              >
                Update profile
              </Button>
            ) : null}
          </CardContent>
        </Card>
      </div>

      {canManageBilling ? (
        <Dialog open={invoiceDialogOpen} onOpenChange={setInvoiceDialogOpen}>
          <DialogContent className="rounded-3xl sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create SchoolOS subscription invoice</DialogTitle>
              <DialogDescription>
                Create a platform SaaS invoice only. This does not create a
                school fee invoice.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4 sm:grid-cols-2">
              <Field
                label="Issue date"
                type="date"
                value={invoiceForm.issueDate}
                onChange={(value) =>
                  setInvoiceForm({ ...invoiceForm, issueDate: value })
                }
              />
              <Field
                label="Due date"
                type="date"
                value={invoiceForm.dueDate}
                onChange={(value) =>
                  setInvoiceForm({ ...invoiceForm, dueDate: value })
                }
              />
              <Field
                label="Description"
                value={invoiceForm.description}
                onChange={(value) =>
                  setInvoiceForm({ ...invoiceForm, description: value })
                }
              />
              <Field
                label="Unit amount (NPR)"
                type="number"
                value={invoiceForm.unitAmount}
                onChange={(value) =>
                  setInvoiceForm({ ...invoiceForm, unitAmount: value })
                }
              />
              <Field
                label="Quantity"
                type="number"
                value={invoiceForm.quantity}
                onChange={(value) =>
                  setInvoiceForm({ ...invoiceForm, quantity: value })
                }
              />
              <div className="space-y-2">
                <Label htmlFor="invoice-line-type">Line type</Label>
                <Select
                  id="invoice-line-type"
                  value={invoiceForm.lineType}
                  onChange={(event) =>
                    setInvoiceForm({
                      ...invoiceForm,
                      lineType: event.target.value,
                    })
                  }
                >
                  <option value="SUBSCRIPTION">Subscription</option>
                  <option value="ADD_ON">Add-on</option>
                  <option value="ADJUSTMENT">Adjustment</option>
                </Select>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="invoice-notes">Notes</Label>
                <Textarea
                  id="invoice-notes"
                  value={invoiceForm.notes}
                  onChange={(event) =>
                    setInvoiceForm({
                      ...invoiceForm,
                      notes: event.target.value,
                    })
                  }
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setInvoiceDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                disabled={
                  saving ||
                  !invoiceForm.description.trim() ||
                  !invoiceForm.unitAmount ||
                  invoiceForm.dueDate < invoiceForm.issueDate
                }
                onClick={() => void createInvoice()}
              >
                {saving ? (
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Create invoice
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}

      <Dialog
        open={invoiceAction?.mode === "view"}
        onOpenChange={(open: boolean) => {
          if (!open) setInvoiceAction(null);
        }}
      >
        <DialogContent className="rounded-3xl sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>
              Invoice {invoiceAction?.invoice.invoiceNumber}
            </DialogTitle>
          </DialogHeader>
          {invoiceAction ? (
            <InvoiceDetail invoice={invoiceAction.invoice} />
          ) : null}
        </DialogContent>
      </Dialog>

      {canManageBilling ? (
        <Dialog
          open={invoiceAction?.mode === "payment"}
          onOpenChange={(open: boolean) => {
            if (!open) setInvoiceAction(null);
          }}
        >
          <DialogContent className="rounded-3xl sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Record SaaS payment</DialogTitle>
              <DialogDescription>
                Record a SchoolOS subscription payment against{" "}
                {invoiceAction?.invoice.invoiceNumber}.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4 sm:grid-cols-2">
              <Field
                label="Amount"
                type="number"
                value={paymentForm.amount}
                onChange={(value) =>
                  setPaymentForm({ ...paymentForm, amount: value })
                }
              />
              <Field
                label="Payment date"
                type="date"
                value={paymentForm.paymentDate}
                onChange={(value) =>
                  setPaymentForm({ ...paymentForm, paymentDate: value })
                }
              />
              <div className="space-y-2">
                <Label htmlFor="payment-method">Method</Label>
                <Select
                  id="payment-method"
                  value={paymentForm.method}
                  onChange={(event) =>
                    setPaymentForm({
                      ...paymentForm,
                      method: event.target.value,
                    })
                  }
                >
                  <option value="BANK_TRANSFER">Bank transfer</option>
                  <option value="CASH">Cash</option>
                  <option value="CHEQUE">Cheque</option>
                  <option value="ONLINE">Online</option>
                </Select>
              </div>
              <Field
                label="Reference"
                value={paymentForm.reference}
                onChange={(value) =>
                  setPaymentForm({ ...paymentForm, reference: value })
                }
              />
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="payment-notes">Notes</Label>
                <Textarea
                  id="payment-notes"
                  value={paymentForm.notes}
                  onChange={(event) =>
                    setPaymentForm({
                      ...paymentForm,
                      notes: event.target.value,
                    })
                  }
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setInvoiceAction(null)}>
                Cancel
              </Button>
              <Button
                disabled={saving || !paymentForm.amount}
                onClick={() => void recordPayment()}
              >
                {saving ? (
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Record payment
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}

      {canManageBilling ? (
        <Dialog
          open={invoiceAction?.mode === "cancel"}
          onOpenChange={(open: boolean) => {
            if (!open) setInvoiceAction(null);
          }}
        >
          <DialogContent className="rounded-3xl sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Cancel SaaS invoice</DialogTitle>
              <DialogDescription>
                This preserves the invoice record and marks it cancelled.
                Provide an audit reason.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2 py-4">
              <Label htmlFor="invoice-cancel-reason">Audit reason</Label>
              <Textarea
                id="invoice-cancel-reason"
                value={cancelReason}
                onChange={(event) => setCancelReason(event.target.value)}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setInvoiceAction(null)}>
                Keep invoice
              </Button>
              <Button
                variant="destructive"
                disabled={saving || cancelReason.trim().length < 5}
                onClick={() => void cancelInvoice()}
              >
                {saving ? (
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Confirm cancellation
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}

      {canManageBilling ? (
        <Dialog open={billingDialogOpen} onOpenChange={setBillingDialogOpen}>
          <DialogContent className="rounded-3xl sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit billing profile</DialogTitle>
              <DialogDescription>
                Platform SaaS billing contact details for {tenant.name}.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4 sm:grid-cols-2">
              <Field
                label="Billing contact"
                value={billingForm.billingContactName}
                onChange={(value) =>
                  setBillingForm({ ...billingForm, billingContactName: value })
                }
              />
              <Field
                label="Billing email"
                type="email"
                value={billingForm.billingEmail}
                onChange={(value) =>
                  setBillingForm({ ...billingForm, billingEmail: value })
                }
              />
              <Field
                label="Billing phone"
                value={billingForm.billingPhone}
                onChange={(value) =>
                  setBillingForm({ ...billingForm, billingPhone: value })
                }
              />
              <Field
                label="PAN / VAT number"
                value={billingForm.panVatNumber}
                onChange={(value) =>
                  setBillingForm({ ...billingForm, panVatNumber: value })
                }
              />
              <div className="space-y-2">
                <Label htmlFor="billing-cycle">Preferred billing cycle</Label>
                <Select
                  id="billing-cycle"
                  value={billingForm.preferredBillingCycle}
                  onChange={(event) =>
                    setBillingForm({
                      ...billingForm,
                      preferredBillingCycle: event.target.value,
                    })
                  }
                >
                  <option value="MONTHLY">Monthly</option>
                  <option value="QUARTERLY">Quarterly</option>
                  <option value="ANNUAL">Annual</option>
                </Select>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="billing-address">Billing address</Label>
                <Textarea
                  id="billing-address"
                  value={billingForm.billingAddress}
                  onChange={(event) =>
                    setBillingForm({
                      ...billingForm,
                      billingAddress: event.target.value,
                    })
                  }
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="billing-notes">Notes</Label>
                <Textarea
                  id="billing-notes"
                  value={billingForm.notes}
                  onChange={(event) =>
                    setBillingForm({
                      ...billingForm,
                      notes: event.target.value,
                    })
                  }
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setBillingDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                disabled={saving}
                onClick={() => void saveBillingProfile()}
              >
                {saving ? (
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Save billing profile
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  const id = `billing-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

function ProfileValue({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
        {label}
      </p>
      <p className="mt-1 text-sm font-bold leading-6 text-slate-900">{value}</p>
    </div>
  );
}

function InvoiceDetail({ invoice }: { invoice: PlatformSaaSInvoiceSummary }) {
  return (
    <div className="space-y-4 py-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <ProfileValue label="Status" value={invoice.status} />
        <ProfileValue label="Issued" value={formatDate(invoice.issueDate)} />
        <ProfileValue label="Due" value={formatDate(invoice.dueDate)} />
      </div>
      <div className="rounded-2xl border border-slate-100">
        {invoice.lines.map((line) => (
          <div
            key={line.id}
            className="flex items-center justify-between border-b border-slate-50 p-4 last:border-b-0"
          >
            <div>
              <p className="font-bold text-slate-900">{line.description}</p>
              <p className="text-xs text-slate-500">
                {line.lineType} · Qty {line.quantity}
              </p>
            </div>
            <p className="font-black text-slate-900">
              {formatMoney(invoice.currency, line.totalAmount)}
            </p>
          </div>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <ProfileValue
          label="Total"
          value={formatMoney(invoice.currency, invoice.amount)}
        />
        <ProfileValue
          label="Paid"
          value={formatMoney(invoice.currency, invoice.paidAmount)}
        />
        <ProfileValue
          label="Balance"
          value={formatMoney(invoice.currency, invoice.balanceAmount)}
        />
      </div>
    </div>
  );
}

function makeDefaultInvoiceForm() {
  const today = getNepalSchoolDay().gregorianDate;
  return {
    issueDate: today,
    dueDate: addDays(today, 15),
    lineType: "SUBSCRIPTION",
    description: "SchoolOS subscription billing",
    quantity: "1",
    unitAmount: "",
    notes: "",
  };
}

function makeDefaultPaymentForm() {
  return {
    amount: "",
    paymentDate: getNepalSchoolDay().gregorianDate,
    method: "BANK_TRANSFER",
    reference: "",
    notes: "",
  };
}

function makeDefaultBillingForm() {
  return {
    billingContactName: "",
    billingEmail: "",
    billingPhone: "",
    billingAddress: "",
    panVatNumber: "",
    preferredBillingCycle: "MONTHLY",
    notes: "",
  };
}

function addDays(value: string, days: number) {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function toIsoDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`).toISOString();
}

function compactPayload(values: Record<string, string>) {
  return Object.fromEntries(
    Object.entries(values).filter(([, value]) => value.trim() !== ""),
  );
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Date not recorded"
    : formatBsDate(date);
}

function formatMoney(currency: string, value: string) {
  return `${currency} ${Number(value).toLocaleString()}`;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "This billing action could not be completed.";
}
