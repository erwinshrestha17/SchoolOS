'use client';

import * as React from 'react';
import Link from 'next/link';
import { 
  MapPin, 
  CheckCircle2, 
  AlertCircle, 
  Activity, 
  ArrowRight, 
  Lock, 
  Award, 
  FileSpreadsheet, 
  Settings,
  Layers,
  BookOpen,
  ClipboardCheck,
  WalletCards,
  Megaphone,
  UserRoundCheck,
  Building,
  GraduationCap,
  Calendar,
  ShieldCheck,
  Users,
  Bus,
  PlusCircle,
  Clock,
  ChevronRight,
  TrendingUp,
  FileText
} from 'lucide-react';

import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs';
import { Progress } from '../components/ui/progress';

import { DotPattern } from '../components/marketing/dot-pattern';
import { BorderBeam } from '../components/marketing/border-beam';
import { NumberTicker } from '../components/marketing/number-ticker';
import { BlurFade } from '../components/marketing/blur-fade';
import { MarketingSectionHeader } from '../components/marketing/section-header';
import { MarketingCard } from '../components/marketing/marketing-card';
import { MetricCard } from '../components/marketing/metric-card';

// ── DATA STRUCTURES ──

const painPoints = [
  {
    problem: 'Attendance scattered in registers',
    solution: 'Digital daily attendance with reports and parent alerts',
    desc: 'Traditional paper logs are prone to errors and leave parents in the dark. SchoolOS digitizes daily check-ins instantly.',
    icon: ClipboardCheck
  },
  {
    problem: 'Fees tracked manually',
    solution: 'Fee dues, receipts, collections, cashier close, and ledger-ready records',
    desc: 'Manual ledger books lead to tracking leaks and calculation errors. SchoolOS automates billing schedules and double-entry postings.',
    icon: WalletCards
  },
  {
    problem: 'Parents miss updates',
    solution: 'Notices, delivery tracking, parent portal, and communication history',
    desc: 'Paper circulars and unorganized chat groups get ignored. SchoolOS centralizes communications with receipts.',
    icon: Megaphone
  },
  {
    problem: 'Student records are fragmented',
    solution: 'One student profile with guardians, documents, attendance, fees, academics, and activity',
    desc: 'Academic, financial, and administrative records live in separate silos. SchoolOS aggregates everything under a single unified ID.',
    icon: UserRoundCheck
  }
];

const operatingLayers = [
  {
    title: 'Admin Command Center',
    desc: 'The central hub for administrative oversight, student lifecycle control, and automated school operations.',
    bullets: [
      'Interactive school stats feed',
      'Unified student lifecycle & approvals',
      'Institution-wide notices & alerts'
    ],
    icon: ShieldCheck,
    visual: 'activity'
  },
  {
    title: 'Finance & Accounts',
    desc: 'A robust financial system designed specifically for tuition fees, ledger entries, and audit-ready bookkeeping.',
    bullets: [
      'NPR fee billing customisation',
      'Cashier day-end closing audits',
      'Automated double-entry ledgers'
    ],
    icon: WalletCards,
    visual: 'progress'
  },
  {
    title: 'Academics & Attendance',
    desc: 'Tools designed for teachers to map schedules, mark attendance, and manage continuous assessment grading.',
    bullets: [
      'Clear attendance register workflow',
      'Timetables & substitution tracking',
      'CAS and terminal report cards'
    ],
    icon: GraduationCap,
    visual: 'chips'
  },
  {
    title: 'Parent & Campus Services',
    desc: 'The external layer connecting guardians, transport fleets, library inventory, and school canteen services.',
    bullets: [
      'Dedicated parent portal accounts',
      'Real-time transport vehicle logs',
      'Canteen meal planning & wallets'
    ],
    icon: Bus,
    visual: 'list'
  }
];

const modulesList = [
  { initials: 'AD', title: 'Admissions', desc: 'Applicant intake, documentation, and enrollment workflows.', tag: 'Core' },
  { initials: 'SD', title: 'Students', desc: 'Centralized profile database, sibling linking, and active files.', tag: 'Core' },
  { initials: 'AT', title: 'Attendance', desc: 'Student and staff attendance logs with real-time analytics.', tag: 'Core' },
  { initials: 'FR', title: 'Fees & Receipts', desc: 'Invoices, automated receipts, waivers, and dues tracking.', tag: 'Finance' },
  { initials: 'NC', title: 'Notices', desc: 'Notice boards, SMS integration, and push alerts.', tag: 'Core' },
  { initials: 'AC', title: 'Academics', desc: 'Exam configurations, marks cards, and continuous grading.', tag: 'Academic' },
  { initials: 'TT', title: 'Timetable', desc: 'Class schedules, teacher allotments, and substitution views.', tag: 'Academic' },
  { initials: 'HP', title: 'HR & Payroll', desc: 'Staff directory, salary processing, and expense records.', tag: 'Finance' },
  { initials: 'GL', title: 'Accounting', desc: 'Double-entry books, charts of accounts, and audit reports.', tag: 'Finance' },
  { initials: 'TR', title: 'Transport', desc: 'Route configurations, vehicles, and student logs.', tag: 'Operations' },
  { initials: 'LB', title: 'Library', desc: 'Catalog system, barcode scans, and overdue fees tracking.', tag: 'Operations' },
  { initials: 'CN', title: 'Canteen', desc: 'Menu setups, student wallet cards, and inventory levels.', tag: 'Operations' },
  { initials: 'RP', title: 'Reports', desc: 'Financial collections, enrollment graphs, and marks summaries.', tag: 'Core' },
  { initials: 'PP', title: 'Parent Portal', desc: 'Private guardian access to academic progress and dues.', tag: 'Portal' }
];

const nepalReadiness = [
  { title: 'NPR fee workflows', desc: 'Tailored specifically for local currency billing, cash collection receipts, and custom tax headers.' },
  { title: 'Nepali calendar readiness', desc: 'Supports both BS (Bikram Sambat) and AD calendars for class schedules, exams, and attendance.' },
  { title: 'SMS/email communication', desc: 'Integrated with local telecommunication gateways to broadcast alerts directly to parent phones.' },
  { title: 'Local school roles', desc: 'Pre-configured roles matching Nepalese schools, including Principal, Accountant, and Section Coordinator.' },
  { title: 'Multi-branch school readiness', desc: 'Enables unified management for institutions operating multiple branches across different locations.' },
  { title: 'Parent-first communication', desc: 'Bypasses internet limitations via SMS alerts while providing a full web dashboard for online portals.' },
  { title: 'School-level data separation', desc: 'Ensures each institution operates in a distinct, protected workspace safeguarding student privacy.' },
  { title: 'Audit trail design', desc: 'Built-in audit logging tracks every financial edit, invoice override, and grade change for accountability.' }
];

const differentiators = [
  {
    title: 'School-level data separation',
    desc: 'Each school operates in its own protected workspace. There is no shared storage risk, ensuring absolute privacy compliance.'
  },
  {
    title: 'Finance-connected operations',
    desc: 'Fees collected, canteen balances topped up, and payroll disbursed flow directly into the school ledger, keeping books automatically reconciled.'
  },
  {
    title: 'Role-aware access',
    desc: 'Admins, teachers, accountants, parents, and students log into the exact interface they need, hiding complex options from normal users.'
  },
  {
    title: 'Guided onboarding',
    desc: 'No automated self-registration forms. Every school workspace is individually configured, loaded with existing student sheets, and launch-tested.'
  },
  {
    title: 'Full student lifecycle',
    desc: 'From primary admission interviews to graduation certificates, student files gather fees, grades, and attendance logs under one profile.'
  }
];

const onboardingSteps = [
  {
    step: '01',
    title: 'Request Demo',
    desc: 'Tell us about your school, student count, and priority modules. We review the intake parameters.',
    icon: FileText
  },
  {
    step: '02',
    title: 'Verification & Planning',
    desc: 'Our team verifies school details and coordinates a custom product demo, mapping out the rollout scope.',
    icon: Calendar
  },
  {
    step: '03',
    title: 'School Workspace Setup',
    desc: 'We configure academic year, classes, sections, roles, and local fee structures.',
    icon: Settings
  },
  {
    step: '04',
    title: 'Pilot Launch',
    desc: 'Admins, teachers, accountants, and parents start using SchoolOS with direct, hands-on guided support.',
    icon: CheckCircle2
  }
];

const plansList = [
  {
    name: 'Starter School',
    desc: 'For schools starting with admissions, students, attendance, notices, and basic fee workflows.',
    features: [
      'Student database & files',
      'Admissions pipeline',
      'Daily attendance logs',
      'School notices & announcements',
      'Core fee invoicing & collections'
    ]
  },
  {
    name: 'Growing School',
    desc: 'For schools needing academics, timetable, HR, payroll, accounting, and advanced reporting.',
    features: [
      'Everything in Starter School',
      'Terminal exam builder & marks cards',
      'Subject timetables & substitutions',
      'HR profiles & payroll calculations',
      'Double-entry accounting ledger',
      'Detailed billing & collections reports'
    ],
    highlighted: true
  },
  {
    name: 'Full Operations',
    desc: 'For schools needing parent portal, transport, library, canteen, and custom workflow operations.',
    features: [
      'Everything in Growing School',
      'Dedicated Parent Portal accounts',
      'Library cataloguing & QR issue logs',
      'Transport routes & student mapping',
      'Canteen menus & prepaid student wallets',
      'Custom role-based permissions & audit feeds'
    ]
  }
];

const securityCards = [
  { title: 'Secure login', desc: 'Equipped with robust session handling, cryptographic credentials, and access locks.' },
  { title: 'Role-based access', desc: 'Allows coordinators, accountants, and teachers to see only data assigned to their roles.' },
  { title: 'School-level data separation', desc: 'Each school workspace operates within separate query boundaries to ensure complete isolation.' },
  { title: 'Audit trail design', desc: 'System automatically logs modifications to fee receipts, invoice lines, and academic grades.' },
  { title: 'Private documents', desc: 'Secures scanned guardian registrations, student medical files, and payment invoices.' },
  { title: 'Controlled onboarding', desc: 'Protects the system from public bot sign-ups and unverified school workspace setups.' }
];

export default function RedesignedLandingPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans antialiased selection:bg-primary-500 selection:text-white">
      
      {/* ── 1. Navbar ── */}
      <header className="sticky top-0 z-50 border-b border-slate-200/60 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-500 text-sm font-black text-white shadow-sm">S</span>
            <div className="flex flex-col">
              <span className="text-lg font-black tracking-tight leading-none text-slate-900">SchoolOS</span>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">School ERP for Nepal</span>
            </div>
          </div>
          <nav className="hidden lg:flex items-center gap-8 text-sm font-semibold text-slate-500">
            <a href="#product" className="hover:text-primary-500 transition-colors">Product</a>
            <a href="#modules" className="hover:text-primary-500 transition-colors">Modules</a>
            <a href="#for-schools" className="hover:text-primary-500 transition-colors">For Schools</a>
            <a href="#onboarding" className="hover:text-primary-500 transition-colors">Onboarding</a>
            <a href="#security" className="hover:text-primary-500 transition-colors">Security</a>
            <a href="#plans" className="hover:text-primary-500 transition-colors">Plans</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm font-bold text-slate-600 hover:text-slate-900 transition-colors px-3 py-2">
              Sign in
            </Link>
            <Link
              href="/request-demo"
              className="inline-flex items-center justify-center whitespace-nowrap rounded-xl text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 shadow-sm h-9 px-4 active:scale-[0.98] transition-all"
            >
              Request Demo
            </Link>
          </div>
        </div>
      </header>

      {/* ── 2. Hero Section ── */}
      <section id="product" className="relative overflow-hidden bg-slate-950 px-6 py-20 lg:py-28 text-white">
        {/* Subtle grid pattern background */}
        <DotPattern className="opacity-15" width={24} height={24} />
        
        <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-primary-500 opacity-20 blur-3xl" />
        <div className="absolute -left-32 -bottom-32 h-96 w-96 rounded-full bg-indigo-600 opacity-15 blur-3xl" />

        <div className="relative mx-auto max-w-6xl grid lg:grid-cols-[1.15fr_0.85fr] gap-12 lg:gap-16 items-center">
          
          {/* Left Column: Headline and CTAs */}
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900/60 px-4 py-1.5 text-xs font-semibold tracking-wider text-primary-300 uppercase">
              🇳🇵 Built for Nepal schools · Montessori to Class 10
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-[1.1] text-white">
              Run your school from one connected operating system.
            </h1>

            <p className="text-base sm:text-lg leading-relaxed text-slate-400 max-w-2xl">
              SchoolOS brings admissions, attendance, fees, academics, notices, staff, accounting, transport, library, canteen, and parent communication into one secure workspace for Nepal-based schools.
            </p>

            <div className="flex flex-wrap items-center gap-4 pt-2">
              <Link
                href="/request-demo"
                className="inline-flex items-center justify-center whitespace-nowrap rounded-3xl text-base font-bold bg-primary-500 hover:bg-primary-600 shadow-lg shadow-primary-500/25 text-white h-13 px-10 active:scale-[0.98] transition-all"
              >
                Request Demo
              </Link>
              <a
                href="#modules"
                className="inline-flex items-center justify-center whitespace-nowrap rounded-3xl text-base font-bold border-2 border-slate-700 bg-slate-900/40 text-slate-300 hover:border-slate-500 hover:text-white h-13 px-10 active:scale-[0.98] transition-all"
              >
                View Modules
              </a>
            </div>

            <p className="text-xs text-slate-500 font-medium">
              School workspaces are created after verification and guided onboarding.
            </p>
          </div>

          {/* Right Column: Custom Product Preview UI */}
          <div className="relative lg:mt-0" id="for-schools">
            <div className="absolute inset-0 bg-gradient-to-r from-primary-500 to-indigo-500 transform rotate-1 rounded-3xl opacity-20 blur-xl" />
            
            {/* Desktop Window Shell */}
            <div className="relative bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
              {/* BorderBeam overlay */}
              <BorderBeam colorFrom="#2563EB" colorTo="#168C8C" duration={6} borderWidth={2} />
              
              {/* Window Controls */}
              <div className="bg-slate-950/80 border-b border-slate-800 px-6 py-3.5 flex items-center justify-between">
                <div className="flex gap-2">
                  <span className="h-3 w-3 rounded-full bg-slate-700" />
                  <span className="h-3 w-3 rounded-full bg-slate-700" />
                  <span className="h-3 w-3 rounded-full bg-slate-700" />
                </div>
                <div className="text-[10px] text-slate-500 tracking-widest uppercase">SchoolOS Admin Engine</div>
                <div className="h-2 w-8 bg-transparent" />
              </div>

              {/* Main Preview Shell Layout */}
              <div className="flex min-h-[380px] text-slate-300">
                {/* Visual Sidebar */}
                <div className="w-[80px] sm:w-[120px] bg-slate-950/40 border-r border-slate-800/80 p-3 hidden sm:flex flex-col gap-4 text-[10px] font-bold text-slate-500">
                  <div className="space-y-1">
                    <span className="text-[8px] uppercase tracking-wider block text-slate-600 px-2">Core</span>
                    <div className="p-2 rounded-lg bg-primary-950/40 text-primary-400 border border-primary-900/30 flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-primary-500" />
                      <span>Console</span>
                    </div>
                    <div className="p-2 rounded-lg hover:text-slate-300 transition-colors">Students</div>
                    <div className="p-2 rounded-lg hover:text-slate-300 transition-colors">Attendance</div>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[8px] uppercase tracking-wider block text-slate-600 px-2">Finance</span>
                    <div className="p-2 rounded-lg hover:text-slate-300 transition-colors">Fees Desk</div>
                    <div className="p-2 rounded-lg hover:text-slate-300 transition-colors">Ledger</div>
                  </div>
                </div>

                {/* Main Content Dashboard Area */}
                <div className="flex-1 p-5 md:p-6 space-y-5">
                  {/* Dashboard Header */}
                  <div className="flex justify-between items-start border-b border-slate-800/60 pb-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-sm font-black tracking-tight text-white">Shree Janata Secondary School</span>
                      </div>
                      <div className="flex items-center gap-1 text-slate-500 text-[11px] font-semibold">
                        <MapPin size={11} className="text-primary-500 shrink-0" />
                        <span>Pokhara, Gandaki Province</span>
                      </div>
                    </div>
                    <Badge variant="success" className="text-[9px] font-bold py-0.5 px-2 flex items-center gap-1 shrink-0">
                      <CheckCircle2 size={10} />
                      Verified school workspace
                    </Badge>
                  </div>

                  {/* KPI Cards Grid */}
                  <div className="grid grid-cols-2 gap-3.5">
                    <MetricCard label="Students" value={1248} />
                    <MetricCard label="Attendance" value={93.6} formatter={(val) => val.toFixed(1) + '%'} textColor="text-emerald-400" />
                    <MetricCard label="Fee Collected" value={3245600} prefix="NPR " />
                    <MetricCard label="Outstanding" value={742850} prefix="NPR " textColor="text-amber-400" />
                  </div>

                  {/* Layout split: Chart and Recent Activity */}
                  <div className="grid grid-cols-1 md:grid-cols-[1.1fr_0.9fr] gap-4">
                    {/* SVG Mini Chart (Collections Trend) */}
                    <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-3.5 space-y-2">
                      <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Monthly Fee Inflow</span>
                      <div className="h-20 w-full flex items-end">
                        <svg className="w-full h-full" viewBox="0 0 160 80">
                          <defs>
                            <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#2563EB" stopOpacity="0.4"/>
                              <stop offset="100%" stopColor="#2563EB" stopOpacity="0"/>
                            </linearGradient>
                          </defs>
                          <path
                            d="M 10,70 L 35,55 L 60,60 L 85,35 L 110,40 L 135,15 L 150,10"
                            fill="none"
                            stroke="#2563EB"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                          />
                          <path
                            d="M 10,70 L 35,55 L 60,60 L 85,35 L 110,40 L 135,15 L 150,10 L 150,80 L 10,80 Z"
                            fill="url(#chartGrad)"
                          />
                          <circle cx="135" cy="15" r="3.5" fill="#2563EB" stroke="#17324D" strokeWidth="1.5" />
                          <circle cx="150" cy="10" r="3.5" fill="#27875A" stroke="#17324D" strokeWidth="1.5" />
                        </svg>
                      </div>
                      <div className="flex justify-between text-[8px] text-slate-500 font-bold px-1">
                        <span>Poush</span>
                        <span>Magh</span>
                        <span>Falgun</span>
                        <span>Chaitra</span>
                      </div>
                    </div>

                    {/* Recent Activity Logs */}
                    <div className="bg-slate-950/40 border border-slate-800/60 rounded-2xl p-3.5 space-y-2.5 text-[11px]">
                      <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Workspace Feed</span>
                      <div className="space-y-2 text-slate-300">
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1.5 truncate">
                            <span className="h-1.5 w-1.5 rounded-full bg-primary-500 shrink-0" />
                            <span className="truncate">Admission approved (Class 5)</span>
                          </span>
                          <span className="text-[9px] text-slate-500 font-medium shrink-0 ml-1">Just now</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1.5 truncate">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                            <span className="truncate">Attendance marked (Class 10B)</span>
                          </span>
                          <span className="text-[9px] text-slate-500 font-medium shrink-0 ml-1">4m ago</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1.5 truncate">
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
                            <span className="truncate">Receipt posted (#1245)</span>
                          </span>
                          <span className="text-[9px] text-slate-500 font-medium shrink-0 ml-1">12m ago</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1.5 truncate">
                            <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 shrink-0" />
                            <span className="truncate">PTM notice published</span>
                          </span>
                          <span className="text-[9px] text-slate-500 font-medium shrink-0 ml-1">1h ago</span>
                        </div>
                      </div>
                    </div>
                  </div>

                </div>
              </div>

            </div>
          </div>

        </div>
      </section>

      {/* ── 3. Interactive Role Preview ── */}
      <section className="py-20 px-6 max-w-6xl mx-auto border-b border-slate-200/50">
        <BlurFade delay={0.1}>
          <MarketingSectionHeader
            tag="Workspace Customization"
            title="Every role gets the right workspace."
            description="SchoolOS maps features directly to user roles. Staff and guardians see only the controls they need."
            className="mb-12"
          />
        </BlurFade>

        <BlurFade delay={0.2}>
          <Tabs defaultValue="admin" className="w-full">
            <div className="flex justify-center mb-8">
              <TabsList className="bg-slate-100 p-1 border border-slate-200/50 rounded-2xl">
                <TabsTrigger value="admin" className="px-5 py-2 text-xs font-bold rounded-xl data-[state=active]:bg-white data-[state=active]:text-slate-950">Admin</TabsTrigger>
                <TabsTrigger value="teacher" className="px-5 py-2 text-xs font-bold rounded-xl data-[state=active]:bg-white data-[state=active]:text-slate-950">Teacher</TabsTrigger>
                <TabsTrigger value="accountant" className="px-5 py-2 text-xs font-bold rounded-xl data-[state=active]:bg-white data-[state=active]:text-slate-950">Accountant</TabsTrigger>
                <TabsTrigger value="parent" className="px-5 py-2 text-xs font-bold rounded-xl data-[state=active]:bg-white data-[state=active]:text-slate-950">Parent</TabsTrigger>
                <TabsTrigger value="operations" className="px-5 py-2 text-xs font-bold rounded-xl data-[state=active]:bg-white data-[state=active]:text-slate-950">Operations</TabsTrigger>
              </TabsList>
            </div>

            {/* TAB CONTENT: ADMIN */}
            <TabsContent value="admin" className="grid lg:grid-cols-[1.1fr_0.9fr] gap-8 focus-visible:ring-0">
              <div className="space-y-6">
                <div className="space-y-2">
                  <h3 className="text-2xl font-black text-slate-900">Admin Command Center</h3>
                  <p className="text-sm text-slate-500">Complete oversight of institutional structure, student files, notice boards, and staff assignments.</p>
                </div>
                
                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Core Focus Areas</h4>
                  <ul className="space-y-3">
                    <li className="flex items-center gap-3 text-sm text-slate-700 font-semibold bg-white p-3.5 border border-slate-100 rounded-2xl shadow-sm">
                      <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                      <span>Student lifecycle tracking & documentation</span>
                    </li>
                    <li className="flex items-center gap-3 text-sm text-slate-700 font-semibold bg-white p-3.5 border border-slate-100 rounded-2xl shadow-sm">
                      <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                      <span>School-wide notice publication & broadcast</span>
                    </li>
                    <li className="flex items-center gap-3 text-sm text-slate-700 font-semibold bg-white p-3.5 border border-slate-100 rounded-2xl shadow-sm">
                      <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                      <span>Global analytics, reporting, & audit logs</span>
                    </li>
                  </ul>
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 text-white space-y-6 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 h-40 w-40 rounded-full bg-primary-500 opacity-10 blur-2xl" />
                <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                  <span className="text-xs font-bold uppercase text-slate-500">Live Dashboard Preview</span>
                  <Badge variant="phase2">Admin role</Badge>
                </div>
                {/* 3 KPI Cards */}
                <div className="grid grid-cols-3 gap-3">
                  <MetricCard label="Total Students" value={1248} className="p-3 text-xs" />
                  <MetricCard label="Active Staff" value={84} className="p-3 text-xs" />
                  <MetricCard label="Open Requests" value={3} textColor="text-amber-400" className="p-3 text-xs" />
                </div>
                {/* Mini Panel */}
                <div className="bg-slate-950/40 border border-slate-800 p-4 rounded-2xl space-y-3">
                  <span className="text-[9px] font-bold text-slate-500 uppercase block tracking-wider">Recent Registrations</span>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-xs p-2 bg-slate-900 border border-slate-800/50 rounded-xl">
                      <span className="font-semibold">Aarav Sharma (Class 3A)</span>
                      <span className="text-[9px] text-slate-500 font-bold bg-slate-800 px-1.5 py-0.5 rounded uppercase">Pending Approval</span>
                    </div>
                    <div className="flex justify-between items-center text-xs p-2 bg-slate-900 border border-slate-800/50 rounded-xl">
                      <span className="font-semibold">Nisha Adhikari (Class 8B)</span>
                      <span className="text-[9px] text-emerald-500 font-bold bg-emerald-950/40 border border-emerald-900/30 px-1.5 py-0.5 rounded uppercase font-bold">Approved</span>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* TAB CONTENT: TEACHER */}
            <TabsContent value="teacher" className="grid lg:grid-cols-[1.1fr_0.9fr] gap-8 focus-visible:ring-0">
              <div className="space-y-6">
                <div className="space-y-2">
                  <h3 className="text-2xl font-black text-slate-900">Teacher Workspace</h3>
                  <p className="text-sm text-slate-500">Designed for fast classroom management, easy attendance tracking, and marksheet entry.</p>
                </div>
                
                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Core Focus Areas</h4>
                  <ul className="space-y-3">
                    <li className="flex items-center gap-3 text-sm text-slate-700 font-semibold bg-white p-3.5 border border-slate-100 rounded-2xl shadow-sm">
                      <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                      <span>3-Tap daily attendance check-ins</span>
                    </li>
                    <li className="flex items-center gap-3 text-sm text-slate-700 font-semibold bg-white p-3.5 border border-slate-100 rounded-2xl shadow-sm">
                      <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                      <span>Class homework assignment & syllabus tracking</span>
                    </li>
                    <li className="flex items-center gap-3 text-sm text-slate-700 font-semibold bg-white p-3.5 border border-slate-100 rounded-2xl shadow-sm">
                      <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                      <span>Direct exam entry & continuous assessment logs</span>
                    </li>
                  </ul>
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 text-white space-y-6 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 h-40 w-40 rounded-full bg-primary-500 opacity-10 blur-2xl" />
                <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                  <span className="text-xs font-bold uppercase text-slate-500">Live Dashboard Preview</span>
                  <Badge variant="phase2">Teacher role</Badge>
                </div>
                {/* 3 KPI Cards */}
                <div className="grid grid-cols-3 gap-3">
                  <MetricCard label="Attendance today" value={95.2} formatter={(val) => val.toFixed(1) + '%'} textColor="text-emerald-400" className="p-3 text-xs" />
                  <MetricCard label="Unmarked Classes" value={0} className="p-3 text-xs" />
                  <MetricCard label="Today's Periods" value={4} className="p-3 text-xs" />
                </div>
                {/* Mini Panel */}
                <div className="bg-slate-950/40 border border-slate-800 p-4 rounded-2xl space-y-3">
                  <span className="text-[9px] font-bold text-slate-500 uppercase block tracking-wider">Class 10A Attendance Check</span>
                  <div className="flex justify-between items-center text-xs p-2 bg-slate-900 border border-slate-800/50 rounded-xl">
                    <span className="font-semibold">All 32 Students Marked</span>
                    <span className="text-[9px] text-emerald-500 font-bold bg-emerald-950/40 border border-emerald-900/30 px-1.5 py-0.5 rounded uppercase font-bold">Submitted</span>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* TAB CONTENT: ACCOUNTANT */}
            <TabsContent value="accountant" className="grid lg:grid-cols-[1.1fr_0.9fr] gap-8 focus-visible:ring-0">
              <div className="space-y-6">
                <div className="space-y-2">
                  <h3 className="text-2xl font-black text-slate-900">Accountant Dashboard</h3>
                  <p className="text-sm text-slate-500">Robust tools built for double-entry school ledgers, cashier day-ends, and custom NPR invoices.</p>
                </div>
                
                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Core Focus Areas</h4>
                  <ul className="space-y-3">
                    <li className="flex items-center gap-3 text-sm text-slate-700 font-semibold bg-white p-3.5 border border-slate-100 rounded-2xl shadow-sm">
                      <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                      <span>Custom NPR fee structuring & invoice schedules</span>
                    </li>
                    <li className="flex items-center gap-3 text-sm text-slate-700 font-semibold bg-white p-3.5 border border-slate-100 rounded-2xl shadow-sm">
                      <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                      <span>Fee receipt logs with partial waiver allocation</span>
                    </li>
                    <li className="flex items-center gap-3 text-sm text-slate-700 font-semibold bg-white p-3.5 border border-slate-100 rounded-2xl shadow-sm">
                      <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                      <span>Cashier end-of-day close out checks & audit books</span>
                    </li>
                  </ul>
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 text-white space-y-6 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 h-40 w-40 rounded-full bg-primary-500 opacity-10 blur-2xl" />
                <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                  <span className="text-xs font-bold uppercase text-slate-500">Live Dashboard Preview</span>
                  <Badge variant="phase2">Accountant role</Badge>
                </div>
                {/* 3 KPI Cards */}
                <div className="grid grid-cols-3 gap-3">
                  <MetricCard label="Collected Today" value={45200} prefix="NPR " formatter={(val) => (val / 1000).toFixed(1) + 'K'} className="p-3 text-xs" />
                  <MetricCard label="Ledger Status" value="Reconciled" textColor="text-emerald-400" className="p-3 text-xs" />
                  <MetricCard label="Pending overrides" value={0} className="p-3 text-xs" />
                </div>
                {/* Mini Panel */}
                <div className="bg-slate-950/40 border border-slate-800 p-4 rounded-2xl space-y-3">
                  <span className="text-[9px] font-bold text-slate-500 uppercase block tracking-wider">Fee Receipt Feed</span>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-xs p-2 bg-slate-900 border border-slate-800/50 rounded-xl">
                      <span className="font-semibold">Receipt #10425 (Aditya B.)</span>
                      <span className="text-[10px] text-slate-300 font-bold">NPR 12,500</span>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* TAB CONTENT: PARENT */}
            <TabsContent value="parent" className="grid lg:grid-cols-[1.1fr_0.9fr] gap-8 focus-visible:ring-0">
              <div className="space-y-6">
                <div className="space-y-2">
                  <h3 className="text-2xl font-black text-slate-900">Parent Portal</h3>
                  <p className="text-sm text-slate-500">Clean, mobile-optimized hub keeping guardians fully connected to student progress and dues.</p>
                </div>
                
                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Core Focus Areas</h4>
                  <ul className="space-y-3">
                    <li className="flex items-center gap-3 text-sm text-slate-700 font-semibold bg-white p-3.5 border border-slate-100 rounded-2xl shadow-sm">
                      <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                      <span>Notices board & real-time message feeds</span>
                    </li>
                    <li className="flex items-center gap-3 text-sm text-slate-700 font-semibold bg-white p-3.5 border border-slate-100 rounded-2xl shadow-sm">
                      <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                      <span>Daily attendance calendar & academic report cards</span>
                    </li>
                    <li className="flex items-center gap-3 text-sm text-slate-700 font-semibold bg-white p-3.5 border border-slate-100 rounded-2xl shadow-sm">
                      <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                      <span>Online fee summary & transit fleet updates</span>
                    </li>
                  </ul>
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 text-white space-y-6 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 h-40 w-40 rounded-full bg-primary-500 opacity-10 blur-2xl" />
                <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                  <span className="text-xs font-bold uppercase text-slate-500">Live Dashboard Preview</span>
                  <Badge variant="phase2">Parent view</Badge>
                </div>
                {/* 3 KPI Cards */}
                <div className="grid grid-cols-3 gap-3">
                  <MetricCard label="Attendance Rate" value={98.4} formatter={(val) => val.toFixed(1) + '%'} textColor="text-emerald-400" className="p-3 text-xs" />
                  <MetricCard label="Pending Fees" value="NPR 0" className="p-3 text-xs" />
                  <MetricCard label="Active Buses" value={1} className="p-3 text-xs" />
                </div>
                {/* Mini Panel */}
                <div className="bg-slate-950/40 border border-slate-800 p-4 rounded-2xl space-y-3">
                  <span className="text-[9px] font-bold text-slate-500 uppercase block tracking-wider">Latest School Notice</span>
                  <div className="text-xs p-3 bg-slate-900 border border-slate-800/50 rounded-xl space-y-1">
                    <p className="font-bold text-white">First Terminal Exams Schedule</p>
                    <p className="text-[10px] text-slate-400">Exams start from next Sunday (Ashadh 15).</p>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* TAB CONTENT: OPERATIONS */}
            <TabsContent value="operations" className="grid lg:grid-cols-[1.1fr_0.9fr] gap-8 focus-visible:ring-0">
              <div className="space-y-6">
                <div className="space-y-2">
                  <h3 className="text-2xl font-black text-slate-900">Operations Control</h3>
                  <p className="text-sm text-slate-500">Coordinates campus services: student transit tracking, libraries, canteens, and HR operations.</p>
                </div>
                
                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Core Focus Areas</h4>
                  <ul className="space-y-3">
                    <li className="flex items-center gap-3 text-sm text-slate-700 font-semibold bg-white p-3.5 border border-slate-100 rounded-2xl shadow-sm">
                      <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                      <span>Transport fleet route logging & dispatch schedules</span>
                    </li>
                    <li className="flex items-center gap-3 text-sm text-slate-700 font-semibold bg-white p-3.5 border border-slate-100 rounded-2xl shadow-sm">
                      <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                      <span>Canteen meal configurations & prepaid student wallets</span>
                    </li>
                    <li className="flex items-center gap-3 text-sm text-slate-700 font-semibold bg-white p-3.5 border border-slate-100 rounded-2xl shadow-sm">
                      <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                      <span>Library barcode book tracking & issues catalog</span>
                    </li>
                  </ul>
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 text-white space-y-6 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 h-40 w-40 rounded-full bg-primary-500 opacity-10 blur-2xl" />
                <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                  <span className="text-xs font-bold uppercase text-slate-500">Live Dashboard Preview</span>
                  <Badge variant="phase2">Operations role</Badge>
                </div>
                {/* 3 KPI Cards */}
                <div className="grid grid-cols-3 gap-3">
                  <MetricCard label="Active Routes" value={6} className="p-3 text-xs" />
                  <MetricCard label="Books Issued" value={320} className="p-3 text-xs" />
                  <MetricCard label="Wallet Cards" value={450} textColor="text-indigo-400" className="p-3 text-xs" />
                </div>
                {/* Mini Panel */}
                <div className="bg-slate-950/40 border border-slate-800 p-4 rounded-2xl space-y-3">
                  <span className="text-[9px] font-bold text-slate-500 uppercase block tracking-wider">Transport Route Status</span>
                  <div className="flex justify-between items-center text-xs p-2 bg-slate-900 border border-slate-800/50 rounded-xl">
                    <span className="font-semibold">Bus Route 2 (Prithvi Chowk)</span>
                    <span className="text-[9px] text-emerald-400 font-bold bg-emerald-950/40 border border-emerald-900/30 px-1.5 py-0.5 rounded uppercase font-bold">Transit</span>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </BlurFade>
      </section>

      {/* ── 4. Why SchoolOS Section ── */}
      <section className="py-20 px-6 max-w-6xl mx-auto">
        <BlurFade delay={0.1}>
          <MarketingSectionHeader
            tag="Operation Scoping"
            title="Schools need more than separate tools."
            description="SchoolOS connects daily operations, academic records, finance, and parent communication so administrators can run the school from one place."
          />
        </BlurFade>

        <div className="grid gap-6 md:grid-cols-2">
          {painPoints.map((item, idx) => (
            <BlurFade key={idx} delay={0.1 * idx} className="h-full">
              <div className="rounded-3xl border border-slate-200/60 bg-white p-6 shadow-sm flex flex-col justify-between h-full hover:shadow-md hover:border-slate-350 transition-all duration-300">
                <div className="space-y-4">
                  {/* Problem row */}
                  <div className="flex gap-3 bg-rose-50/50 border border-rose-100/50 rounded-2xl p-4">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-600 mt-0.5">
                      <AlertCircle size={15} />
                    </div>
                    <div>
                      <span className="text-[10px] font-black text-rose-800 uppercase tracking-wide block">The Problem</span>
                      <p className="text-sm font-semibold text-slate-700 mt-1">{item.problem}</p>
                    </div>
                  </div>

                  {/* Solution row */}
                  <div className="flex gap-3 bg-primary-50/50 border border-primary-100/30 rounded-2xl p-4">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-primary-105 text-primary-600 mt-0.5">
                      <item.icon size={15} />
                    </div>
                    <div>
                      <span className="text-[10px] font-black text-primary-800 uppercase tracking-wide block">SchoolOS Solution</span>
                      <p className="text-sm font-bold text-slate-900 mt-1">{item.solution}</p>
                    </div>
                  </div>
                </div>

                <p className="text-xs text-slate-500 mt-5 px-1 leading-relaxed">{item.desc}</p>
              </div>
            </BlurFade>
          ))}
        </div>
      </section>

      {/* ── 5. Bento Feature Grid ── */}
      <section className="bg-slate-900 text-white py-20 px-6">
        <div className="max-w-6xl mx-auto space-y-16">
          <BlurFade delay={0.1}>
            <MarketingSectionHeader
              tag="System Blueprint"
              title="One SchoolOS, four operating layers."
              description="Our software structure is engineered to divide permissions and database entities into logical operational categories."
              dark
            />
          </BlurFade>

          <div className="grid gap-6 md:grid-cols-2">
            {operatingLayers.map((layer, idx) => (
              <BlurFade key={idx} delay={0.1 * idx} className="h-full">
                <div className="rounded-3xl border border-slate-800 bg-slate-950/60 p-8 space-y-6 hover:border-slate-700 transition-all duration-300 flex flex-col justify-between h-full">
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 border border-slate-800 text-primary-400">
                        <layer.icon size={20} />
                      </div>
                      <h3 className="text-xl font-bold text-white">{layer.title}</h3>
                    </div>
                    
                    <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">{layer.desc}</p>
                    
                    <div className="border-t border-slate-850 pt-4 space-y-2">
                      {layer.bullets.map((bullet, bIdx) => (
                        <div key={bIdx} className="flex items-center gap-2 text-xs text-slate-300">
                          <span className="h-1 w-1.5 rounded bg-primary-500 shrink-0" />
                          <span>{bullet}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Bento Mini visual detail */}
                  <div className="pt-2">
                    {layer.visual === 'activity' && (
                      <div className="bg-slate-900/60 border border-slate-800 p-3 rounded-2xl space-y-2">
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="text-slate-500 font-bold uppercase">System Uptime</span>
                          <span className="text-emerald-400 font-bold">99.9%</span>
                        </div>
                        <div className="flex gap-1 h-3">
                          {Array.from({ length: 24 }).map((_, i) => (
                            <span key={i} className="flex-1 bg-emerald-500/90 rounded-sm" />
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {layer.visual === 'progress' && (
                      <div className="bg-slate-900/60 border border-slate-800 p-3.5 rounded-2xl space-y-2">
                        <div className="flex justify-between items-center text-[10px]">
                          <span className="text-slate-500 font-bold uppercase">Fee billing collection progress</span>
                          <span className="text-primary-400 font-bold">81.4%</span>
                        </div>
                        <Progress value={81.4} className="h-2 bg-slate-800" />
                      </div>
                    )}

                    {layer.visual === 'chips' && (
                      <div className="flex flex-wrap gap-1.5">
                        <Badge variant="later" className="bg-slate-900 border-slate-800 text-slate-400 font-semibold">Class 10-B</Badge>
                        <Badge variant="later" className="bg-slate-900 border-slate-800 text-slate-400 font-semibold">Class 9-A</Badge>
                        <Badge variant="later" className="bg-slate-900 border-slate-800 text-slate-400 font-semibold">Class 8-C</Badge>
                      </div>
                    )}

                    {layer.visual === 'list' && (
                      <div className="text-[10px] text-slate-500 space-y-1 font-semibold">
                        <div className="flex justify-between bg-slate-900/40 p-1 px-2 border border-slate-800/40 rounded-lg">
                          <span>Primary Bus Route</span>
                          <span className="text-emerald-500 font-bold">On Schedule</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </BlurFade>
            ))}
          </div>
        </div>
      </section>

      {/* ── 6. Modules Section ── */}
      <section id="modules" className="py-20 px-6 max-w-6xl mx-auto">
        <BlurFade delay={0.1}>
          <MarketingSectionHeader
            tag="Integrated Capabilities"
            title="Modules built around real school workflows."
            description="Each workspace can selectively toggle features, keeping interfaces simple for staff members who only handle core actions."
          />
        </BlurFade>

        <div className="grid gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {modulesList.map((m, idx) => (
            <BlurFade key={m.title} delay={0.05 * idx} className="h-full">
              <MarketingCard
                title={m.title}
                description={m.desc}
                initials={m.initials}
                badge={m.tag}
                badgeVariant={
                  m.tag === 'Finance' 
                    ? 'warning' 
                    : m.tag === 'Academic' 
                    ? 'info'
                    : m.tag === 'Operations'
                    ? 'neutral'
                    : m.tag === 'Portal'
                    ? 'success'
                    : 'default'
                }
              />
            </BlurFade>
          ))}
        </div>
      </section>

      {/* ── 7. Nepal Readiness Section ── */}
      <section className="bg-white border-y border-slate-200/50 py-20 px-6">
        <div className="max-w-6xl mx-auto space-y-16">
          <BlurFade delay={0.1}>
            <MarketingSectionHeader
              tag="Local Integration"
              title="Designed for Nepal-school operations."
              description="SchoolOS maps specifically to regional constraints, fee schemas, address contexts, and standard reporting structures."
            />
          </BlurFade>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {nepalReadiness.map((item, idx) => (
              <BlurFade key={idx} delay={0.08 * idx} className="h-full">
                <div className="rounded-2xl border border-slate-200/60 bg-[#F8FAFC] p-5 shadow-sm hover:border-slate-300 transition-all duration-300 space-y-2 h-full">
                  <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5 font-semibold">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary-500 animate-pulse" />
                    {item.title}
                  </h3>
                  <p className="text-[11px] leading-relaxed text-slate-500">{item.desc}</p>
                </div>
              </BlurFade>
            ))}
          </div>
        </div>
      </section>

      {/* ── 8. Product Differentiation Section ── */}
      <section className="py-20 px-6 max-w-6xl mx-auto">
        <div className="max-w-6xl mx-auto space-y-16">
          <BlurFade delay={0.1}>
            <MarketingSectionHeader
              tag="Key Distinctions"
              title="What makes SchoolOS different?"
              description="Unlike legacy local databases or unverified software systems, our architecture is optimized for institutional data protection and financial integrity."
            />
          </BlurFade>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {differentiators.map((d, idx) => (
              <BlurFade key={idx} delay={0.1 * idx} className="h-full">
                <MarketingCard
                  title={d.title}
                  description={d.desc}
                />
              </BlurFade>
            ))}
          </div>
        </div>
      </section>

      {/* ── 9. Guided Onboarding Section ── */}
      <section id="onboarding" className="bg-[#F8FAFC] border-y border-slate-200/50 py-20 px-6">
        <div className="max-w-6xl mx-auto space-y-16">
          <BlurFade delay={0.1}>
            <MarketingSectionHeader
              tag="Deployment Roadmap"
              title="From demo to pilot launch."
              description="We guide your team through each step of the rollout, handling data imports and role mapping."
            />
          </BlurFade>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 relative">
            {onboardingSteps.map((step, idx) => (
              <BlurFade key={idx} delay={0.1 * idx} className="h-full">
                <Card className="relative rounded-2xl border border-slate-200/60 bg-white p-6 shadow-sm space-y-3 flex flex-col justify-between h-full">
                  <CardContent className="p-0 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-3xl font-black text-primary-500/25 block">{step.step}</span>
                      <div className="h-8 w-8 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-650 font-bold">
                        <step.icon size={16} />
                      </div>
                    </div>
                    <h3 className="text-sm font-bold text-slate-900">{step.title}</h3>
                    <p className="text-xs text-slate-500 leading-relaxed">{step.desc}</p>
                  </CardContent>
                </Card>
              </BlurFade>
            ))}
          </div>

          <BlurFade delay={0.3} className="text-center">
            <Link
              href="/request-demo"
              className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-3xl text-base font-bold bg-slate-900 text-white hover:bg-slate-800 shadow-sm h-13 px-10 active:scale-[0.98] transition-all"
            >
              <span>Request Demo</span>
              <ArrowRight size={15} />
            </Link>
          </BlurFade>
        </div>
      </section>

      {/* ── 10. Plans Section ── */}
      <section id="plans" className="bg-slate-950 text-white py-20 px-6">
        <div className="max-w-6xl mx-auto space-y-16">
          <BlurFade delay={0.1}>
            <MarketingSectionHeader
              tag="Licensing Structures"
              title="Flexible plans for different school sizes."
              description="Workspaces are licensed annually according to active student count and enabled operational layers."
              dark
            />
          </BlurFade>

          <div className="grid gap-8 lg:grid-cols-3">
            {plansList.map((plan, idx) => (
              <BlurFade key={idx} delay={0.1 * idx} className="h-full">
                <div 
                  className={`rounded-3xl p-8 border flex flex-col justify-between h-full ${
                    plan.highlighted 
                      ? 'border-primary-500 bg-slate-900 shadow-xl' 
                      : 'border-slate-800 bg-slate-900/40'
                  }`}
                >
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-xl font-bold text-white">{plan.name}</h3>
                      <p className="text-slate-400 mt-2 text-xs leading-relaxed">{plan.desc}</p>
                    </div>
                    <ul className="space-y-3 text-xs text-slate-300 font-semibold">
                      {plan.features.map((feat, fIdx) => (
                        <li key={fIdx} className="flex gap-2.5 items-center">
                          <CheckCircle2 size={14} className="text-primary-500 shrink-0" />
                          <span>{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="pt-8">
                    <Link
                      href="/request-demo"
                      className={`inline-flex items-center justify-center w-full rounded-2xl font-bold h-11 px-6 py-2.5 text-xs transition-all active:scale-[0.98] ${
                        plan.highlighted
                          ? 'bg-primary-500 text-white hover:bg-primary-600 shadow-md shadow-primary-500/10'
                          : 'bg-slate-800 text-white hover:bg-slate-700'
                      }`}
                    >
                      Request Pricing
                    </Link>
                  </div>
                </div>
              </BlurFade>
            ))}
          </div>
        </div>
      </section>

      {/* ── 11. Security Section ── */}
      <section id="security" className="py-20 px-6 max-w-6xl mx-auto">
        <div className="grid lg:grid-cols-[0.8fr_1.2fr] gap-12 items-center">
          <BlurFade delay={0.1} className="space-y-4">
            <span className="text-xs font-bold uppercase tracking-wider text-primary-500">Security Parameters</span>
            <h2 className="text-3xl font-black tracking-tight text-slate-900 leading-tight">
              Built with school data boundaries in mind.
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
              SchoolOS is designed around strict isolation limits, supports secure staff authentication, and is prepared for private file encryptions to protect academic and accounting operations.
            </p>
          </BlurFade>
          
          <div className="grid gap-4 sm:grid-cols-2">
            {securityCards.map((sec, idx) => (
              <BlurFade key={idx} delay={0.08 * idx}>
                <div className="rounded-2xl border border-slate-200/60 bg-white p-5 shadow-sm space-y-1 hover:border-slate-350 transition-all duration-300">
                  <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5 font-semibold">
                    <Lock size={12} className="text-primary-500 shrink-0 mt-0.5" />
                    {sec.title}
                  </h3>
                  <p className="text-[11px] text-slate-400 leading-relaxed">{sec.desc}</p>
                </div>
              </BlurFade>
            ))}
          </div>
        </div>
      </section>

      {/* ── 12. Final CTA Section ── */}
      <section className="bg-primary-50/50 border-y border-primary-100/30 px-6 py-20 text-center">
        <BlurFade delay={0.1} className="mx-auto max-w-3xl space-y-6">
          <h2 className="text-3xl sm:text-4xl font-black text-slate-900 leading-tight">
            Ready to bring SchoolOS to your school?
          </h2>
          <p className="text-sm text-slate-500 max-w-lg mx-auto">
            Request a demo and the SchoolOS team will help you plan a verified pilot workspace.
          </p>
          <div className="flex flex-wrap justify-center gap-4 pt-2">
            <Link
              href="/request-demo"
              className="inline-flex items-center justify-center whitespace-nowrap rounded-3xl text-base font-bold bg-primary-500 hover:bg-primary-600 text-white shadow-md h-13 px-10 active:scale-[0.98] transition-all"
            >
              Request Demo
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center justify-center whitespace-nowrap rounded-3xl text-base font-bold border-2 border-slate-200 bg-white hover:bg-slate-50 text-slate-700 h-13 px-10 active:scale-[0.98] transition-all"
            >
              Sign in
            </Link>
          </div>
        </BlurFade>
      </section>

      {/* ── 13. Footer ── */}
      <footer className="bg-slate-950 px-6 py-12 border-t border-slate-900 text-slate-500 text-xs">
        <div className="mx-auto max-w-6xl flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded bg-primary-500 text-[10px] font-black text-white">S</span>
            <span className="font-bold text-white">SchoolOS</span>
            <span className="text-slate-650 font-medium">· School ERP for Nepal</span>
          </div>
          <div className="flex flex-wrap items-center gap-6 font-semibold">
            <a href="#product" className="hover:text-white transition-colors">Product</a>
            <a href="#modules" className="hover:text-white transition-colors">Modules</a>
            <Link href="/request-demo" className="hover:text-white transition-colors">Request Demo</Link>
            <Link href="/login" className="hover:text-white transition-colors">Login</Link>
            <a href="#" className="hover:text-white transition-colors">Privacy</a>
            <a href="#" className="hover:text-white transition-colors">Terms</a>
            <a href="mailto:support@schoolos.com.np" className="hover:text-white transition-colors">Contact</a>
          </div>
        </div>
      </footer>

    </div>
  );
}
