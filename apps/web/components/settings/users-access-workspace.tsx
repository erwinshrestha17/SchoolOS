'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle2, CircleAlert, KeyRound, Plus, UserCog, UsersRound } from 'lucide-react';
import { Button } from '../ui/button';
import { ConfirmDialog } from '../ui/confirm-dialog';
import { ErrorState } from '../ui/error-state';
import { PageHeader } from '../ui/page-header';
import { api, type SchoolUserStatus } from '../../lib/api';

type CreateUserDraft = { email: string; phone: string; password: string; roleIds: string[] };

export function UsersAccessWorkspace() {
  const client = useQueryClient();
  const [draft, setDraft] = useState<CreateUserDraft>({ email: '', phone: '', password: '', roleIds: [] });
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const [pendingStatus, setPendingStatus] = useState<{ userId: string; status: SchoolUserStatus; email: string | null } | null>(null);
  const [pendingReset, setPendingReset] = useState<{ userId: string; email: string | null } | null>(null);
  const [resetPassword, setResetPassword] = useState('');

  const usersQuery = useQuery({ queryKey: ['settings', 'users'], queryFn: api.listUsers });
  const rolesQuery = useQuery({ queryKey: ['settings', 'roles'], queryFn: api.listRoleCatalog });

  const createMutation = useMutation({
    mutationFn: api.createUser,
    onSuccess: async () => {
      setDraft({ email: '', phone: '', password: '', roleIds: [] });
      setNotice({ kind: 'success', text: 'User account created and role assignments saved.' });
      await client.invalidateQueries({ queryKey: ['settings', 'users'] });
    },
    onError: () => setNotice({ kind: 'error', text: 'Could not create the user. Check the account details and selected roles.' }),
  });
  const statusMutation = useMutation({
    mutationFn: ({ userId, status }: { userId: string; status: SchoolUserStatus }) => api.updateUserStatus(userId, { status }),
    onSuccess: async (_, variables) => {
      setPendingStatus(null);
      setNotice({ kind: 'success', text: variables.status === 'SUSPENDED' ? 'User suspended and active sessions handled by the server.' : 'User account activated.' });
      await client.invalidateQueries({ queryKey: ['settings', 'users'] });
    },
    onError: () => setNotice({ kind: 'error', text: 'Could not update this user account status.' }),
  });
  const resetMutation = useMutation({
    mutationFn: ({ userId, password }: { userId: string; password: string }) => api.resetUserPassword(userId, password),
    onSuccess: async () => {
      setPendingReset(null);
      setResetPassword('');
      setNotice({ kind: 'success', text: 'Password reset. The user must change the temporary password at next sign in.' });
      await client.invalidateQueries({ queryKey: ['settings', 'users'] });
    },
    onError: () => setNotice({ kind: 'error', text: 'Could not reset this password. Check policy and permissions.' }),
  });

  const users = useMemo(() => usersQuery.data ?? [], [usersQuery.data]);
  const roles = rolesQuery.data ?? [];
  const counts = useMemo(() => ({ active: users.filter((user) => user.status === 'ACTIVE').length, pending: users.filter((user) => user.status === 'PENDING').length, suspended: users.filter((user) => user.status === 'SUSPENDED').length }), [users]);

  if (usersQuery.isLoading || rolesQuery.isLoading) return <div className="space-y-5 p-6"><div className="h-28 animate-pulse rounded-2xl bg-slate-100" /><div className="h-[520px] animate-pulse rounded-2xl bg-slate-100" /></div>;
  if (usersQuery.isError || rolesQuery.isError) return <div className="p-6"><ErrorState title="Could not load users and access" message="Please retry to load school accounts and roles." error={usersQuery.error ?? rolesQuery.error} onRetry={() => { void usersQuery.refetch(); void rolesQuery.refetch(); }} /></div>;

  const createUser = () => {
    setNotice(null);
    if (!draft.email.trim() || draft.password.length < 8 || !draft.roleIds.length) { setNotice({ kind: 'error', text: 'Enter an email, a password of at least 8 characters, and at least one school role.' }); return; }
    createMutation.mutate({ email: draft.email.trim(), phone: draft.phone.trim() || undefined, password: draft.password, roleIds: draft.roleIds });
  };
  const submitReset = () => {
    setNotice(null);
    if (!pendingReset) return;
    const issue = passwordPolicyIssue(resetPassword);
    if (issue) {
      setNotice({ kind: 'error', text: issue });
      return;
    }
    resetMutation.mutate({ userId: pendingReset.userId, password: resetPassword });
  };
  const toggleRole = (roleId: string) => setDraft((current) => ({ ...current, roleIds: current.roleIds.includes(roleId) ? current.roleIds.filter((id) => id !== roleId) : [...current.roleIds, roleId] }));

  return <div className="space-y-6 p-6 pb-24">
    <PageHeader title="Users & access" description="Manage school user accounts and role assignments. Access applies only to this school and remains backend-authorised." actions={<Link href="/dashboard/settings" className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"><ArrowLeft className="h-4 w-4" />All settings</Link>} />
    {notice ? <div className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold ${notice.kind === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-rose-200 bg-rose-50 text-rose-800'}`}>{notice.kind === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <CircleAlert className="h-4 w-4" />}{notice.text}</div> : null}
    <section className="grid gap-4 md:grid-cols-3"><Stat label="Active accounts" value={counts.active} icon={UsersRound} /><Stat label="Pending accounts" value={counts.pending} icon={KeyRound} /><Stat label="Suspended accounts" value={counts.suspended} icon={UserCog} /></section>
    <section className="grid gap-5 xl:grid-cols-[0.85fr_1.15fr]">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="font-bold text-slate-950">Add school user</h2><p className="mt-1 text-sm leading-6 text-slate-600">Create a staff or administrator account, then assign only the roles needed for school work.</p><div className="mt-5 space-y-4"><Field label="Email" value={draft.email} onChange={(value) => setDraft((current) => ({ ...current, email: value }))} placeholder="staff@school.edu.np" type="email" /><Field label="Phone (optional)" value={draft.phone} onChange={(value) => setDraft((current) => ({ ...current, phone: value }))} placeholder="98XXXXXXXX" /><Field label="Temporary password" value={draft.password} onChange={(value) => setDraft((current) => ({ ...current, password: value }))} placeholder="At least 8 characters" type="password" /><fieldset><legend className="text-sm font-bold text-slate-900">School roles</legend><div className="mt-2 flex max-h-48 flex-wrap gap-2 overflow-y-auto">{roles.map((role) => { const active = draft.roleIds.includes(role.id); return <button key={role.id} type="button" onClick={() => toggleRole(role.id)} className={`rounded-lg border px-3 py-2 text-sm font-semibold transition ${active ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-400'}`}>{role.name}</button>; })}</div></fieldset><Button type="button" className="w-full" onClick={createUser} disabled={createMutation.isPending}><Plus className="h-4 w-4" />{createMutation.isPending ? 'Creating…' : 'Create user account'}</Button></div></div>
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="flex items-center justify-between border-b border-slate-100 p-5"><div><h2 className="font-bold text-slate-950">School accounts</h2><p className="mt-1 text-sm text-slate-600">{users.length} accounts in this tenant.</p></div></div>{users.length === 0 ? <div className="p-10 text-center"><UsersRound className="mx-auto h-7 w-7 text-slate-400" /><p className="mt-3 font-semibold text-slate-900">No school user accounts</p><p className="mt-1 text-sm text-slate-600">Create an account and assign a school role.</p></div> : <div className="divide-y divide-slate-100">{users.map((user) => <div key={user.id} data-testid={`settings-user-row-${user.email ?? user.id}`} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center"><div className="min-w-0 flex-1"><p className="truncate font-bold text-slate-950">{user.email ?? user.phone ?? 'User account'}</p><p className="mt-1 text-sm text-slate-600">{user.roles.map((role) => role.name).join(' · ') || 'No role assigned'}</p><p className="mt-1 text-xs font-semibold text-slate-500">{user.profileType} · {user.mustChangePassword ? 'Temporary password' : user.lastLoginAt ? 'Signed in before' : 'No recorded sign-in'}</p></div><div className="flex flex-wrap items-center justify-between gap-3 sm:justify-end"><StatusBadge status={user.status} /><Button type="button" size="sm" variant="outline" onClick={() => setPendingReset({ userId: user.id, email: user.email })}>Reset password</Button><Button type="button" size="sm" variant="outline" onClick={() => setPendingStatus({ userId: user.id, status: user.status === 'SUSPENDED' ? 'ACTIVE' : 'SUSPENDED', email: user.email })}>{user.status === 'SUSPENDED' ? 'Activate' : 'Suspend'}</Button></div></div>)}</div>}</div>
    </section>
    <ConfirmDialog isOpen={Boolean(pendingStatus)} title={pendingStatus?.status === 'SUSPENDED' ? 'Suspend user account' : 'Activate user account'} description={pendingStatus?.status === 'SUSPENDED' ? `Suspend ${pendingStatus.email ?? 'this account'}? The backend will revoke its active sessions.` : `Activate ${pendingStatus?.email ?? 'this account'}?`} confirmLabel={pendingStatus?.status === 'SUSPENDED' ? 'Suspend account' : 'Activate account'} destructive={pendingStatus?.status === 'SUSPENDED'} isConfirming={statusMutation.isPending} onConfirm={() => { if (pendingStatus) statusMutation.mutate({ userId: pendingStatus.userId, status: pendingStatus.status }); }} onClose={() => setPendingStatus(null)} />
    {pendingReset ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4"><div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl"><h2 className="text-lg font-black text-slate-950">Reset password</h2><p className="mt-2 text-sm leading-6 text-slate-600">Generate a temporary password for {pendingReset.email ?? 'this user'}. The backend will revoke active sessions and require change on next login.</p><Field label="Temporary password" value={resetPassword} onChange={setResetPassword} placeholder="Minimum 8 characters, mixed case, number, symbol" type="password" /><div className="mt-5 flex flex-wrap justify-end gap-2"><Button type="button" variant="outline" onClick={() => { setPendingReset(null); setResetPassword(''); }}>Cancel</Button><Button type="button" onClick={submitReset} disabled={resetMutation.isPending}><KeyRound className="h-4 w-4" />{resetMutation.isPending ? 'Resetting...' : 'Confirm reset'}</Button></div></div></div> : null}
  </div>;
}

function Stat({ label, value, icon: Icon }: { label: string; value: number; icon: typeof UsersRound }) { return <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><p className="text-sm font-semibold text-slate-600">{label}</p><Icon className="h-5 w-5 text-slate-500" /></div><p className="mt-3 text-3xl font-black text-slate-950">{value}</p></div>; }
function Field({ label, value, onChange, placeholder, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; type?: 'text' | 'email' | 'password' }) { return <label><span className="text-sm font-bold text-slate-900">{label}</span><input type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="mt-2 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-900/5" /></label>; }
function StatusBadge({ status }: { status: SchoolUserStatus }) { const className = status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800' : status === 'PENDING' ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'; return <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${className}`}>{status.toLowerCase()}</span>; }
function passwordPolicyIssue(password: string) { if (password.length < 8) return 'Password must be at least 8 characters.'; if (!/[A-Z]/.test(password)) return 'Password needs an uppercase letter.'; if (!/[a-z]/.test(password)) return 'Password needs a lowercase letter.'; if (!/\d/.test(password)) return 'Password needs a number.'; if (!/[^A-Za-z0-9]/.test(password)) return 'Password needs a symbol.'; if (['admin123', 'password123', 'school123'].includes(password.toLowerCase())) return 'Password must not use a common school password.'; return null; }
