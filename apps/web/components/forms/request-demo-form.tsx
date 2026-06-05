'use client';

import * as React from 'react';
import { useState } from 'react';
import Link from 'next/link';
import { 
  Check, 
  CheckCircle2, 
  Building, 
  User, 
  Briefcase, 
  Layout, 
  ArrowLeft,
  Phone,
  Mail,
  MapPin,
  ClipboardList,
  ChevronDown
} from 'lucide-react';

import { Button } from '../ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../ui/card';
import { Input } from '../ui/input';
import { Select } from '../ui/select';
import { Textarea } from '../ui/textarea';
import { Progress } from '../ui/progress';
import { api } from '../../lib/api';

const MODULES = [
  'Admissions',
  'Students',
  'Attendance',
  'Fees & Receipts',
  'Notices',
  'Academics',
  'Timetable',
  'HR & Payroll',
  'Accounting',
  'Transport',
  'Library',
  'Canteen',
  'Parent Portal',
  'Reports',
];

export function RequestDemoForm() {
  const [formData, setFormData] = useState({
    schoolName: '',
    schoolType: '',
    location: '',
    studentsCount: '',
    branchesCount: '',
    contactName: '',
    role: '',
    phone: '',
    email: '',
    preferredContact: '',
    currentSystem: '',
    expectedTimeline: '',
    message: '',
  });

  const [selectedModules, setSelectedModules] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submittedRequestId, setSubmittedRequestId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  const handleModuleToggle = (moduleName: string) => {
    setSelectedModules((prev) =>
      prev.includes(moduleName)
        ? prev.filter((m) => m !== moduleName)
        : [...prev, moduleName]
    );
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.schoolName.trim()) newErrors.schoolName = 'School Name is required';
    if (!formData.schoolType) newErrors.schoolType = 'School Type is required';
    if (!formData.location.trim()) newErrors.location = 'School Location is required';
    if (!formData.studentsCount) newErrors.studentsCount = 'Number of Students is required';
    
    if (!formData.contactName.trim()) newErrors.contactName = 'Contact Person Name is required';
    if (!formData.role.trim()) newErrors.role = 'Role / Designation is required';
    if (!formData.phone.trim()) newErrors.phone = 'Phone Number is required';
    
    if (!formData.email.trim()) {
      newErrors.email = 'Email Address is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Enter a valid email address';
    }
    
    if (!formData.expectedTimeline) newErrors.expectedTimeline = 'Expected Timeline is required';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    setErrors({});

    try {
      const result = await api.submitDemoRequest({
        ...formData,
        interestedModules: selectedModules,
      });
      setSubmittedRequestId(result.id);
      setIsSubmitted(true);
    } catch (error) {
      setErrors({
        form:
          error instanceof Error
            ? error.message
            : 'Could not submit the demo request. Please try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Compute form completion progress
  const requiredFields = [
    formData.schoolName,
    formData.schoolType,
    formData.location,
    formData.studentsCount,
    formData.contactName,
    formData.role,
    formData.phone,
    formData.email,
    formData.expectedTimeline
  ];
  const filledCount = requiredFields.filter(f => f.trim() !== '').length;
  const progressPercent = Math.round((filledCount / requiredFields.length) * 100);

  if (isSubmitted) {
    return (
      <Card className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm text-center space-y-6 relative z-10 max-w-xl mx-auto">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 text-blue-600 border border-blue-100">
          <CheckCircle2 size={28} />
        </div>
        
        <div className="space-y-2">
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Demo request submitted.
          </h1>
          <p className="text-slate-500 max-w-md mx-auto text-xs leading-relaxed">
            Thank you. The SchoolOS team will contact you for verification and onboarding planning.
          </p>
        </div>

        <div className="rounded-xl bg-slate-50 p-5 text-left border border-slate-100 space-y-3 text-xs">
          <div className="flex justify-between border-b border-slate-200/50 pb-2">
            <span className="text-slate-400 font-semibold">School Name:</span>
            <span className="text-slate-900 font-bold">{formData.schoolName}</span>
          </div>
          <div className="flex justify-between border-b border-slate-200/50 pb-2">
            <span className="text-slate-400 font-semibold">Contact Person:</span>
            <span className="text-slate-900 font-bold">{formData.contactName} ({formData.role})</span>
          </div>
          <div className="flex justify-between border-b border-slate-200/50 pb-2">
            <span className="text-slate-400 font-semibold">Preferred Contact:</span>
            <span className="text-slate-900 font-bold">
              {formData.preferredContact ? `${formData.preferredContact} (${formData.phone})` : formData.phone}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400 font-semibold">Expected Timeline:</span>
            <span className="text-slate-900 font-bold">{formData.expectedTimeline}</span>
          </div>
          {submittedRequestId && (
            <div className="flex justify-between border-t border-slate-200/50 pt-2">
              <span className="text-slate-400 font-semibold">Request ID:</span>
              <span className="text-slate-900 font-bold">{submittedRequestId}</span>
            </div>
          )}
        </div>

        <div className="pt-2 flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/"
            className="inline-flex items-center justify-center whitespace-nowrap rounded-xl text-xs font-bold border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 text-slate-700 h-9 px-5 active:scale-[0.98] transition-all"
          >
            <ArrowLeft size={12} className="mr-1.5" />
            Back to website
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center justify-center whitespace-nowrap rounded-xl text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 shadow-sm h-9 px-5 active:scale-[0.98] transition-all"
          >
            Sign in
          </Link>
        </div>
      </Card>
    );
  }

  return (
    <Card className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
      <CardHeader className="border-b border-slate-100 bg-slate-50/50 px-6 py-4">
        <CardTitle className="text-base font-bold text-slate-950">School details</CardTitle>
        <CardDescription className="text-xs text-slate-500">Required fields are marked with *</CardDescription>
      </CardHeader>
      
      <CardContent className="p-6 space-y-6">
        {/* Form Progress */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center text-[10px] text-slate-500 font-semibold">
            <span>COMPLETION PROGRESS</span>
            <span className="text-blue-600 font-bold">{progressPercent}%</span>
          </div>
          <Progress value={progressPercent} className="h-1 bg-slate-100" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {errors.form && (
            <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-xs font-semibold text-red-700">
              {errors.form}
            </div>
          )}
          
          {/* Section 1: School Information */}
          <div className="space-y-3.5">
            <div className="pb-1 border-b border-slate-150 flex items-center gap-2">
              <Building size={14} className="text-slate-500" />
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">1. School Information</h3>
            </div>
            
            <div className="grid gap-3.5 sm:grid-cols-2">
              <div className="space-y-1">
                <label htmlFor="schoolName" className="text-xs font-semibold text-slate-700 block">
                  School Name *
                </label>
                <Input
                  id="schoolName"
                  name="schoolName"
                  type="text"
                  placeholder="e.g. Shree Janata Secondary School"
                  value={formData.schoolName}
                  onChange={handleInputChange}
                  className={`h-9 text-xs focus:ring-blue-600 focus:border-blue-600 ${errors.schoolName ? 'border-red-300 bg-red-50/10 focus:ring-red-500' : 'border-slate-200'}`}
                  aria-required="true"
                />
                {errors.schoolName && <p className="text-[10px] text-red-650 font-medium">{errors.schoolName}</p>}
              </div>

              <div className="space-y-1">
                <label htmlFor="location" className="text-xs font-semibold text-slate-700 block">
                  School Location *
                </label>
                <Input
                  id="location"
                  name="location"
                  type="text"
                  placeholder="e.g. Pokhara, Gandaki"
                  value={formData.location}
                  onChange={handleInputChange}
                  className={`h-9 text-xs focus:ring-blue-600 focus:border-blue-600 ${errors.location ? 'border-red-300 bg-red-50/10 focus:ring-red-500' : 'border-slate-200'}`}
                  aria-required="true"
                />
                {errors.location && <p className="text-[10px] text-red-650 font-medium">{errors.location}</p>}
              </div>

              <div className="space-y-1">
                <label htmlFor="schoolType" className="text-xs font-semibold text-slate-700 block">
                  School Type *
                </label>
                <div className="relative">
                  <Select
                    id="schoolType"
                    name="schoolType"
                    value={formData.schoolType}
                    onChange={handleInputChange}
                    className={`h-9 text-xs focus:ring-blue-600 focus:border-blue-600 ${errors.schoolType ? 'border-red-300 bg-red-50/10 focus:ring-red-500' : 'border-slate-200'}`}
                    aria-required="true"
                  >
                    <option value="" disabled>Select Type</option>
                    <option value="Montessori / Pre-primary">Montessori / Pre-primary</option>
                    <option value="Basic School">Basic School</option>
                    <option value="Secondary School">Secondary School</option>
                    <option value="Higher Secondary">Higher Secondary</option>
                    <option value="Multi-branch Institution">Multi-branch Institution</option>
                    <option value="Other">Other</option>
                  </Select>
                  <div className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-slate-400">
                    <ChevronDown className="h-3 w-3" />
                  </div>
                </div>
                {errors.schoolType && <p className="text-[10px] text-red-650 font-medium">{errors.schoolType}</p>}
              </div>

              <div className="space-y-1">
                <label htmlFor="studentsCount" className="text-xs font-semibold text-slate-700 block">
                  Number of Students *
                </label>
                <div className="relative">
                  <Select
                    id="studentsCount"
                    name="studentsCount"
                    value={formData.studentsCount}
                    onChange={handleInputChange}
                    className={`h-9 text-xs focus:ring-blue-600 focus:border-blue-600 ${errors.studentsCount ? 'border-red-300 bg-red-50/10 focus:ring-red-500' : 'border-slate-200'}`}
                    aria-required="true"
                  >
                    <option value="" disabled>Select Range</option>
                    <option value="Below 200">Below 200</option>
                    <option value="200–500">200–500</option>
                    <option value="500–1,000">500–1,000</option>
                    <option value="1,000–2,000">1,000–2,000</option>
                    <option value="2,000+">2,000+</option>
                  </Select>
                  <div className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-slate-400">
                    <ChevronDown className="h-3 w-3" />
                  </div>
                </div>
                {errors.studentsCount && <p className="text-[10px] text-red-650 font-medium">{errors.studentsCount}</p>}
              </div>

              <div className="space-y-1 sm:col-span-2">
                <label htmlFor="branchesCount" className="text-xs font-semibold text-slate-700 block">
                  Number of Branches
                </label>
                <div className="relative">
                  <Select
                    id="branchesCount"
                    name="branchesCount"
                    value={formData.branchesCount}
                    onChange={handleInputChange}
                    className="h-9 text-xs focus:ring-blue-600 focus:border-blue-600 border-slate-200"
                  >
                    <option value="" disabled>Select Branches</option>
                    <option value="Single branch">Single branch</option>
                    <option value="2–3 branches">2–3 branches</option>
                    <option value="4+ branches">4+ branches</option>
                  </Select>
                  <div className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-slate-400">
                    <ChevronDown className="h-3 w-3" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Contact Person */}
          <div className="space-y-3.5">
            <div className="pb-1 border-b border-slate-150 flex items-center gap-2">
              <User size={14} className="text-slate-500" />
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">2. Contact Person</h3>
            </div>

            <div className="grid gap-3.5 sm:grid-cols-2">
              <div className="space-y-1">
                <label htmlFor="contactName" className="text-xs font-semibold text-slate-700 block">
                  Contact Person Name *
                </label>
                <Input
                  id="contactName"
                  name="contactName"
                  type="text"
                  placeholder="e.g. Ram Bahadur"
                  value={formData.contactName}
                  onChange={handleInputChange}
                  className={`h-9 text-xs focus:ring-blue-600 focus:border-blue-600 ${errors.contactName ? 'border-red-300 bg-red-50/10 focus:ring-red-500' : 'border-slate-200'}`}
                  aria-required="true"
                />
                {errors.contactName && <p className="text-[10px] text-red-650 font-medium">{errors.contactName}</p>}
              </div>

              <div className="space-y-1">
                <label htmlFor="role" className="text-xs font-semibold text-slate-700 block">
                  Role / Designation *
                </label>
                <Input
                  id="role"
                  name="role"
                  type="text"
                  placeholder="e.g. Principal / Coordinator"
                  value={formData.role}
                  onChange={handleInputChange}
                  className={`h-9 text-xs focus:ring-blue-600 focus:border-blue-600 ${errors.role ? 'border-red-300 bg-red-50/10 focus:ring-red-500' : 'border-slate-200'}`}
                  aria-required="true"
                />
                {errors.role && <p className="text-[10px] text-red-650 font-medium">{errors.role}</p>}
              </div>

              <div className="space-y-1">
                <label htmlFor="phone" className="text-xs font-semibold text-slate-700 block">
                  Phone Number *
                </label>
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  placeholder="e.g. 98XXXXXXXX"
                  value={formData.phone}
                  onChange={handleInputChange}
                  className={`h-9 text-xs focus:ring-blue-600 focus:border-blue-600 ${errors.phone ? 'border-red-300 bg-red-50/10 focus:ring-red-500' : 'border-slate-200'}`}
                  aria-required="true"
                />
                {errors.phone && <p className="text-[10px] text-red-650 font-medium">{errors.phone}</p>}
              </div>

              <div className="space-y-1">
                <label htmlFor="email" className="text-xs font-semibold text-slate-700 block">
                  Email Address *
                </label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="e.g. name@school.edu.np"
                  value={formData.email}
                  onChange={handleInputChange}
                  className={`h-9 text-xs focus:ring-blue-600 focus:border-blue-600 ${errors.email ? 'border-red-300 bg-red-50/10 focus:ring-red-500' : 'border-slate-200'}`}
                  aria-required="true"
                />
                {errors.email && <p className="text-[10px] text-red-650 font-medium">{errors.email}</p>}
              </div>

              <div className="space-y-1 sm:col-span-2">
                <label htmlFor="preferredContact" className="text-xs font-semibold text-slate-700 block">
                  Preferred Contact Method
                </label>
                <div className="relative">
                  <Select
                    id="preferredContact"
                    name="preferredContact"
                    value={formData.preferredContact}
                    onChange={handleInputChange}
                    className="h-9 text-xs focus:ring-blue-600 focus:border-blue-600 border-slate-200"
                  >
                    <option value="" disabled>Select Method</option>
                    <option value="Phone">Phone</option>
                    <option value="Email">Email</option>
                    <option value="WhatsApp / Viber">WhatsApp / Viber</option>
                    <option value="In-person meeting">In-person meeting</option>
                  </Select>
                  <div className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-slate-400">
                    <ChevronDown className="h-3 w-3" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Interested Modules */}
          <div className="space-y-3">
            <div className="pb-1 border-b border-slate-150 flex items-center gap-2">
              <Layout size={14} className="text-slate-500" />
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">3. Modules Interested In</h3>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {MODULES.map((module) => {
                const isSelected = selectedModules.includes(module);
                return (
                  <button
                    key={module}
                    type="button"
                    onClick={() => handleModuleToggle(module)}
                    className={`flex items-center justify-between py-2 px-3 rounded-xl border text-[11px] font-bold transition-all text-left ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50/50 text-blue-700 shadow-xs font-extrabold'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:border-slate-300'
                    }`}
                  >
                    <span className="truncate">{module}</span>
                    <div
                      className={`h-4 w-4 rounded-md flex items-center justify-center border transition-all shrink-0 ml-1.5 ${
                        isSelected
                          ? 'border-blue-600 bg-blue-600 text-white'
                          : 'border-slate-300 bg-white'
                      }`}
                    >
                      {isSelected && <Check size={8} strokeWidth={4} />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 4: Rollout Plan */}
          <div className="space-y-3.5">
            <div className="pb-1 border-b border-slate-150 flex items-center gap-2">
              <Briefcase size={14} className="text-slate-500" />
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">4. Rollout Plan</h3>
            </div>

            <div className="grid gap-3.5 sm:grid-cols-2">
              <div className="space-y-1">
                <label htmlFor="currentSystem" className="text-xs font-semibold text-slate-700 block">
                  Current system used
                </label>
                <Input
                  id="currentSystem"
                  name="currentSystem"
                  type="text"
                  placeholder="e.g. Ledger books / local software"
                  value={formData.currentSystem}
                  onChange={handleInputChange}
                  className="h-9 text-xs focus:ring-blue-600 focus:border-blue-600 border-slate-200"
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="expectedTimeline" className="text-xs font-semibold text-slate-700 block">
                  Expected rollout timeline *
                </label>
                <div className="relative">
                  <Select
                    id="expectedTimeline"
                    name="expectedTimeline"
                    value={formData.expectedTimeline}
                    onChange={handleInputChange}
                    className={`h-9 text-xs focus:ring-blue-600 focus:border-blue-600 ${errors.expectedTimeline ? 'border-red-300 bg-red-50/10 focus:ring-red-500' : 'border-slate-200'}`}
                    aria-required="true"
                  >
                    <option value="" disabled>Select Timeline</option>
                    <option value="Immediately">Immediately</option>
                    <option value="Within 1 month">Within 1 month</option>
                    <option value="Within 3 months">Within 3 months</option>
                    <option value="Exploring only">Exploring only</option>
                  </Select>
                  <div className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-slate-400">
                    <ChevronDown className="h-3 w-3" />
                  </div>
                </div>
                {errors.expectedTimeline && <p className="text-[10px] text-red-650 font-medium">{errors.expectedTimeline}</p>}
              </div>

              <div className="space-y-1 sm:col-span-2">
                <label htmlFor="message" className="text-xs font-semibold text-slate-700 block">
                  Message / Requirements
                </label>
                <Textarea
                  id="message"
                  name="message"
                  placeholder="Detail any custom requirements, local syllabus mappings, class structures, etc."
                  value={formData.message}
                  onChange={handleInputChange}
                  rows={3}
                  className="rounded-xl text-xs focus:ring-blue-600 focus:border-blue-600 border-slate-200"
                />
              </div>
            </div>
          </div>

          {/* CTA Button and disclaimer */}
          <div className="space-y-3 pt-5 border-t border-slate-100">
            <Button
              type="submit"
              disabled={isSubmitting}
              isLoading={isSubmitting}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold h-11 rounded-xl text-xs transition-all border-0 shadow-sm active:scale-[0.99]"
            >
              Submit Demo Request
            </Button>
            <p className="text-center text-[10px] text-slate-400 font-semibold leading-relaxed">
              Submitting this form does not create a school workspace automatically.
            </p>
          </div>

        </form>
      </CardContent>
    </Card>
  );
}
