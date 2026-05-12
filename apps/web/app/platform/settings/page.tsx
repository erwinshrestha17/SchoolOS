'use client';

import { useState } from 'react';
import { 
  Shield, 
  Key, 
  Mail, 
  MessageSquare, 
  Globe, 
  Save,
  Loader2,
  Eye,
  EyeOff,
  AlertCircle
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function PlatformSettings() {
  const [isSaving, setIsSaving] = useState(false);
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});

  const toggleSecret = (key: string) => {
    setShowSecrets(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    // Simulate save
    await new Promise(resolve => setTimeout(resolve, 1000));
    setIsSaving(false);
  };

  return (
    <div className="space-y-8 p-8 max-w-6xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Platform Settings</h1>
        <p className="text-slate-500 mt-1">Configure global SchoolOS platform parameters and provider credentials.</p>
      </div>

      <Tabs defaultValue="providers" className="space-y-6">
        <TabsList className="bg-slate-100 p-1">
          <TabsTrigger value="providers" className="gap-2"><Globe size={16} /> Infrastructure</TabsTrigger>
          <TabsTrigger value="security" className="gap-2"><Shield size={16} /> Security</TabsTrigger>
          <TabsTrigger value="billing" className="gap-2"><Key size={16} /> License Keys</TabsTrigger>
        </TabsList>

        <TabsContent value="providers">
          <div className="grid gap-6">
            <SettingsCard 
              title="SMS Provider (Sparrow SMS)" 
              description="Credentials for Nepal-based SMS delivery."
              onSave={handleSave}
              isSaving={isSaving}
            >
              <SecretField 
                label="API Token" 
                value="sparrow_live_829374928374928374" 
                isVisible={showSecrets['sms_token']} 
                onToggle={() => toggleSecret('sms_token')} 
              />
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Sender ID</label>
                <Input defaultValue="SchoolOS" />
              </div>
            </SettingsCard>

            <SettingsCard 
              title="Email Provider (Postmark)" 
              description="Transactional email configuration."
              onSave={handleSave}
              isSaving={isSaving}
            >
              <SecretField 
                label="Server Token" 
                value="postmark_live_k928374k-j283-4k28-b928-3k482734928" 
                isVisible={showSecrets['email_token']} 
                onToggle={() => toggleSecret('email_token')} 
              />
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">From Email</label>
                <Input defaultValue="notifications@schoolos.edu.np" />
              </div>
            </SettingsCard>
          </div>
        </TabsContent>

        <TabsContent value="security">
          <SettingsCard 
            title="Global Security Policies" 
            description="Enforce security standards across all tenants."
            onSave={handleSave}
            isSaving={isSaving}
          >
            <div className="space-y-4 col-span-full">
              <div className="flex items-center justify-between p-4 rounded-xl border border-slate-200 bg-slate-50/50">
                <div>
                  <p className="font-bold text-slate-900">Mandatory MFA for Platform Admins</p>
                  <p className="text-xs text-slate-500">Require multi-factor authentication for all /platform users.</p>
                </div>
                <div className="h-6 w-11 bg-primary-500 rounded-full relative cursor-pointer">
                  <div className="absolute right-1 top-1 h-4 w-4 bg-white rounded-full shadow-sm" />
                </div>
              </div>
            </div>
          </SettingsCard>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SettingsCard({ 
  title, 
  description, 
  children, 
  onSave, 
  isSaving 
}: { 
  title: string; 
  description: string; 
  children: React.ReactNode; 
  onSave: () => void;
  isSaving: boolean;
}) {
  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-6 border-b border-slate-50">
        <div>
          <CardTitle className="text-lg font-bold text-slate-900">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        <Button onClick={onSave} disabled={isSaving} className="gap-2">
          {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          Save
        </Button>
      </CardHeader>
      <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
        {children}
      </CardContent>
    </Card>
  );
}

function SecretField({ 
  label, 
  value, 
  isVisible, 
  onToggle 
}: { 
  label: string; 
  value: string; 
  isVisible: boolean; 
  onToggle: () => void;
}) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-semibold text-slate-700">{label}</label>
      <div className="relative">
        <Input 
          type={isVisible ? 'text' : 'password'} 
          value={value} 
          readOnly 
          className="pr-10 font-mono text-xs bg-slate-50"
        />
        <button 
          onClick={onToggle}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
        >
          {isVisible ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
      <p className="text-[10px] text-slate-400 italic">This secret is masked for your protection.</p>
    </div>
  );
}
