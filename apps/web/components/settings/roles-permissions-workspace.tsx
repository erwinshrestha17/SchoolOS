'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, KeyRound, Search, ShieldCheck, UsersRound } from 'lucide-react';
import { ErrorState } from '../ui/error-state';
import { PageHeader } from '../ui/page-header';
import { api } from '../../lib/api';

export function RolesPermissionsWorkspace() {
  const [query, setQuery] = useState('');
  const rolesQuery = useQuery({ queryKey: ['settings', 'roles'], queryFn: api.listRoleCatalog });
  const permissionsQuery = useQuery({ queryKey: ['settings', 'permissions'], queryFn: api.listPermissionCatalog });

  if (rolesQuery.isLoading || permissionsQuery.isLoading) return <div className="space-y-5 p-6"><div className="h-28 animate-pulse rounded-2xl bg-slate-100" /><div className="h-[520px] animate-pulse rounded-2xl bg-slate-100" /></div>;
  if (rolesQuery.isError || permissionsQuery.isError) return <div className="p-6"><ErrorState title="Could not load roles and permissions" message="Please retry to load this school’s role catalog and permission coverage." error={rolesQuery.error ?? permissionsQuery.error} onRetry={() => { void rolesQuery.refetch(); void permissionsQuery.refetch(); }} /></div>;

  const roles = rolesQuery.data ?? [];
  const permissions = permissionsQuery.data ?? [];
  const searchable = query.trim().toLowerCase();
  const filteredRoles = useMemo(() => roles.filter((role) => !searchable || `${role.name} ${role.permissions.map((permission) => permission.key).join(' ')}`.toLowerCase().includes(searchable)), [roles, searchable]);
  const resources = new Set(permissions.map((permission) => permission.resource)).size;

  return <div className="space-y-6 p-6 pb-24">
    <PageHeader title="Roles & permissions" description="Review the roles available to this school and the permission coverage granted by each role. Backend authorization remains the source of truth." actions={<Link href="/dashboard/settings" className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"><ArrowLeft className="h-4 w-4" />All settings</Link>} />
    <section className="grid gap-4 md:grid-cols-3"><Stat label="School roles" value={roles.length} icon={UsersRound} /><Stat label="Permission keys" value={permissions.length} icon={KeyRound} /><Stat label="Protected resources" value={resources} icon={ShieldCheck} /></section>
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="flex flex-col gap-4 border-b border-slate-100 p-5 lg:flex-row lg:items-center lg:justify-between"><div><h2 className="font-bold text-slate-950">Role coverage</h2><p className="mt-1 text-sm text-slate-600">Use this view when assigning user roles. Do not grant broad access where a focused role is sufficient.</p></div><label className="relative block w-full lg:w-80"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search roles or permissions" className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-900/5" /></label></div>{filteredRoles.length === 0 ? <div className="p-10 text-center"><KeyRound className="mx-auto h-7 w-7 text-slate-400" /><p className="mt-3 font-semibold text-slate-900">No matching roles</p><p className="mt-1 text-sm text-slate-600">Try a different role or permission keyword.</p></div> : <div className="grid gap-4 p-5 lg:grid-cols-2">{filteredRoles.map((role) => <article key={role.id} className="rounded-xl border border-slate-200 p-4"><div className="flex items-start justify-between gap-3"><div><h3 className="font-bold text-slate-950">{role.name}</h3><p className="mt-1 text-sm text-slate-600">{role.permissions.length} permission keys</p></div><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">Role</span></div><div className="mt-4 flex flex-wrap gap-2">{role.permissions.length ? role.permissions.map((permission) => <span key={permission.id} className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700">{permission.key}</span>) : <span className="text-sm text-slate-500">No permissions are assigned to this role.</span>}</div></article>)}</div>}</section>
    <section className="rounded-2xl border border-sky-100 bg-sky-50 p-5 text-sm text-sky-900"><div className="flex gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" /><div><p className="font-bold">Role assignment is not a frontend security control</p><p className="mt-1 leading-6">The school dashboard may hide actions for a role, but every backend route must also verify the user’s tenant, role, permission, and module entitlement.</p></div></div></section>
  </div>;
}

function Stat({ label, value, icon: Icon }: { label: string; value: number; icon: typeof KeyRound }) { return <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><p className="text-sm font-semibold text-slate-600">{label}</p><Icon className="h-5 w-5 text-slate-500" /></div><p className="mt-3 text-3xl font-black text-slate-950">{value}</p></div>; }
