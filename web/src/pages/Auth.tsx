import { SignIn, SignUp } from '@clerk/clerk-react';
import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useClerkAvailable } from '@/providers/ClerkProvider';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  UserPlus,
  Building2,
  Mail,
  ShieldCheck,
  AlertTriangle,
  Sparkles,
  TrendingUp,
  MessageSquare,
  Bot,
  CheckCircle2,
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export function Auth() {
  const [isSignUp, setIsSignUp] = useState(false);
  const { user, loading } = useAuth();
  const clerkAvailable = useClerkAvailable();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [inviteData, setInviteData] = useState<{
    email: string;
    name: string;
    role: string;
    orgId: string;
    orgName?: string;
  } | null>(null);

  useEffect(() => {
    if (!loading && user) navigate('/');
  }, [loading, user, navigate]);

  useEffect(() => {
    const invited = searchParams.get('invited');
    const inviteEmail = searchParams.get('email');
    const inviteName = searchParams.get('name');
    const inviteRole = searchParams.get('role');
    const orgId = searchParams.get('orgId');
    const orgName = searchParams.get('orgName');
    const signup = searchParams.get('signup');
    const invitationToken = searchParams.get('invitation_token');

    // Keep auth mode deterministic from the URL so invite flows never reuse stale state.
    setIsSignUp(signup === 'true');

    // Persist invitation token across the Clerk auth flow (OTP, email verification, etc.)
    // so sync-login can match it directly even if Clerk email differs in casing/alias.
    if (invitationToken) {
      try {
        sessionStorage.setItem('pending_invitation_token', invitationToken);
      } catch {
        /* sessionStorage may be unavailable */
      }
    }

    if (invited === 'true' && inviteEmail) {
      setInviteData({
        email: inviteEmail,
        name: inviteName || '',
        role: inviteRole || 'seller',
        orgId: orgId || '',
        orgName: orgName || 'Organização',
      });
    }
  }, [searchParams]);

  // Clerk appearance — dark premium with sunset gradient accents
  const clerkAppearance = {
    variables: {
      colorPrimary: 'hsl(20, 100%, 60%)',
      colorBackground: 'transparent',
      colorText: 'hsl(0, 0%, 95%)',
      colorInputBackground: 'hsl(0, 0%, 8%)',
      colorInputText: 'hsl(0, 0%, 95%)',
      colorTextSecondary: 'hsl(0, 0%, 65%)',
      borderRadius: '0.875rem',
      fontFamily: 'Poppins, sans-serif',
      spacingUnit: '1rem',
    },
    elements: {
      rootBox: 'w-full',
      card: 'bg-transparent shadow-none p-0 w-full gap-6',
      headerTitle: 'hidden',
      headerSubtitle: 'hidden',
      formButtonPrimary:
        'bg-gradient-to-r from-[hsl(20,100%,60%)] via-[hsl(15,100%,55%)] to-[hsl(15,100%,45%)] hover:opacity-95 text-white font-poppins font-semibold shadow-[0_10px_40px_-10px_hsl(20,100%,60%,0.6)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_15px_50px_-10px_hsl(20,100%,60%,0.7)] h-12 text-base rounded-xl border-0',
      socialButtonsBlockButton:
        'bg-white/[0.03] border border-white/10 hover:bg-white/[0.06] hover:border-white/20 font-poppins h-12 transition-all duration-300 rounded-xl backdrop-blur-sm',
      socialButtonsBlockButtonText: 'font-poppins font-medium text-white/90',
      socialButtonsProviderIcon: 'w-5 h-5',
      formFieldLabel: 'font-poppins text-white/85 font-semibold text-sm mb-2',
      formFieldInput:
        'font-poppins bg-white/[0.04] border border-white/15 text-white focus:ring-2 focus:ring-[hsl(20,100%,60%)]/30 focus:border-[hsl(20,100%,60%)]/60 hover:border-white/25 h-12 transition-all duration-200 rounded-xl placeholder:text-white/30 px-4 text-base',
      formFieldLabelRow: 'mb-1',
      formFieldInputShowPasswordButton: 'text-white/40 hover:text-white/80',
      footerActionLink:
        'text-[hsl(20,100%,65%)] hover:text-[hsl(20,100%,75%)] font-poppins font-semibold transition-colors',
      identityPreview: 'bg-white/[0.04] border border-white/10 rounded-xl backdrop-blur-sm',
      identityPreviewText: 'text-white/90 font-poppins',
      identityPreviewEditButton:
        'text-[hsl(20,100%,65%)] hover:text-[hsl(20,100%,75%)] font-poppins font-medium',
      dividerLine: 'bg-white/10',
      dividerText: 'text-white/50 font-poppins text-xs uppercase tracking-wider px-4',
      dividerRow: 'my-6',
      alertText: 'text-red-300 font-poppins',
      footer: 'hidden',
      formFieldRow: 'mb-5',
      form: 'gap-0',
      formHeaderTitle: 'hidden',
      formHeaderSubtitle: 'hidden',
      otpCodeFieldInput:
        'border border-white/10 bg-white/[0.04] rounded-xl h-12 font-poppins text-lg text-white',
      formResendCodeLink: 'text-[hsl(20,100%,65%)] font-poppins font-medium',
      tagInputContainer: 'bg-white/[0.04] border border-white/10 rounded-xl',
      selectButton: 'bg-white/[0.04] border border-white/10 rounded-xl h-12',
      badge:
        'bg-[hsl(20,100%,60%)]/15 text-[hsl(20,100%,75%)] font-poppins font-medium rounded-lg border border-[hsl(20,100%,60%)]/20',
    },
  };

  if (!clerkAvailable) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f] p-4">
        <div className="w-full max-w-md animate-fade-in">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle className="font-poppins">Autenticação não configurada</AlertTitle>
            <AlertDescription className="font-poppins">
              A chave do Clerk (VITE_CLERK_PUBLISHABLE_KEY) não está configurada. Entre em contato
              com o administrador do sistema.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  const features = [
    { icon: Bot, title: 'IA que vende por você', description: 'Atendimento autônomo 24/7' },
    { icon: MessageSquare, title: 'Inbox unificado', description: 'WhatsApp + Instagram em um lugar' },
    { icon: TrendingUp, title: 'Pipeline inteligente', description: 'Mais conversões, menos esforço' },
  ];

  const stats = [
    { value: '+312%', label: 'em conversões' },
    { value: '24/7', label: 'atendimento' },
    { value: '<10s', label: 'resposta' },
  ];

  return (
    <div className="min-h-screen flex bg-[#0a0a0f] text-white relative overflow-hidden">
      {/* Ambient background gradients */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full bg-[hsl(20,100%,60%)] opacity-20 blur-[120px]" />
        <div className="absolute top-1/3 -right-40 w-[500px] h-[500px] rounded-full bg-[hsl(15,100%,45%)] opacity-15 blur-[120px]" />
        <div className="absolute -bottom-40 left-1/3 w-[500px] h-[500px] rounded-full bg-[hsl(25,100%,55%)] opacity-15 blur-[120px]" />
      </div>

      {/* Subtle grid */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }}
      />

      {/* Left Panel — Brand & Showcase */}
      <div className="hidden lg:flex lg:w-1/2 relative z-10">
        <div className="flex flex-col justify-between p-12 xl:p-16 w-full">
          {/* Logo */}
          <div className="flex items-center gap-3 animate-fade-in">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-[hsl(20,100%,60%)] to-[hsl(15,100%,45%)] rounded-xl blur-md opacity-60" />
              <div className="relative w-12 h-12 bg-gradient-to-br from-[hsl(20,100%,60%)] to-[hsl(15,100%,45%)] rounded-xl flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
            </div>
            <div>
              <span className="text-2xl font-bold font-poppins tracking-tight">AutoLead</span>
              <p className="text-xs text-white/50 font-poppins -mt-0.5">CRM com IA comercial</p>
            </div>
          </div>

          {/* Hero content */}
          <div className="space-y-10">
            <div className="space-y-5 animate-fade-in" style={{ animationDelay: '100ms' }}>
              <Badge className="bg-white/[0.06] border border-white/10 text-white/80 font-poppins font-medium backdrop-blur-sm hover:bg-white/[0.08]">
                <span className="w-1.5 h-1.5 rounded-full bg-[hsl(20,100%,60%)] mr-2 animate-pulse" />
                Plataforma inteligente
              </Badge>
              <h1 className="text-4xl xl:text-5xl 2xl:text-6xl font-bold font-poppins leading-[1.1] tracking-tight">
                Venda mais com{' '}
                <span className="text-[hsl(20,100%,60%)]">
                  inteligência artificial
                </span>
              </h1>
              <p className="text-lg text-white/60 font-poppins max-w-md leading-relaxed">
                A plataforma completa para gerenciar leads, automatizar atendimentos e fechar mais
                negócios — tudo em um só lugar.
              </p>
            </div>

            {/* Mockup card — dashboard preview */}
            <div
              className="relative animate-fade-in"
              style={{ animationDelay: '200ms' }}
            >
              <div className="absolute -inset-1 bg-gradient-to-r from-[hsl(20,100%,60%)]/30 via-[hsl(15,100%,45%)]/30 to-[hsl(25,100%,55%)]/30 rounded-2xl blur-xl opacity-60" />
              <div className="relative rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-6 space-y-4 overflow-hidden">
                {/* Top bar */}
                <div className="flex items-center justify-between pb-3 border-b border-white/5">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-400/60" />
                    <div className="w-2.5 h-2.5 rounded-full bg-yellow-400/60" />
                    <div className="w-2.5 h-2.5 rounded-full bg-green-400/60" />
                  </div>
                  <span className="text-xs text-white/40 font-poppins">autolead.app</span>
                </div>

                {/* Stats grid */}
                <div className="grid grid-cols-3 gap-3">
                  {stats.map((s, i) => (
                    <div
                      key={i}
                      className="rounded-xl bg-white/[0.03] border border-white/5 p-3 hover:bg-white/[0.06] transition-colors"
                    >
                      <div className="text-lg xl:text-xl font-bold font-poppins bg-gradient-to-r from-[hsl(20,100%,70%)] to-[hsl(15,100%,50%)] bg-clip-text text-transparent">
                        {s.value}
                      </div>
                      <div className="text-[10px] text-white/50 font-poppins uppercase tracking-wider mt-1">
                        {s.label}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Feature rows */}
                <div className="space-y-2.5">
                  {features.map((f, i) => (
                    <div
                      key={i}
                      className="group flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.05] hover:border-white/10 transition-all duration-300"
                    >
                      <div className="relative shrink-0">
                        <div className="absolute inset-0 bg-gradient-to-br from-[hsl(20,100%,60%)] to-[hsl(15,100%,45%)] rounded-lg blur-sm opacity-40 group-hover:opacity-70 transition-opacity" />
                        <div className="relative w-9 h-9 rounded-lg bg-gradient-to-br from-[hsl(20,100%,60%)]/20 to-[hsl(15,100%,45%)]/20 border border-white/10 flex items-center justify-center">
                          <f.icon className="w-4 h-4 text-[hsl(20,100%,75%)]" />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-poppins font-semibold text-white/90 truncate">
                          {f.title}
                        </div>
                        <div className="text-xs font-poppins text-white/50 truncate">
                          {f.description}
                        </div>
                      </div>
                      <CheckCircle2 className="w-4 h-4 text-[hsl(20,100%,65%)] opacity-70 shrink-0" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between text-xs text-white/40 font-poppins animate-fade-in" style={{ animationDelay: '300ms' }}>
            <span>© {new Date().getFullYear()} AutoLead</span>
            <span className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              Sistema online
            </span>
          </div>
        </div>
      </div>

      {/* Right Panel — Auth */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 relative z-10">
        <div className="w-full max-w-md space-y-7 animate-fade-in" style={{ animationDelay: '150ms' }}>
          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center justify-center gap-3 mb-2">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-[hsl(20,100%,60%)] to-[hsl(15,100%,45%)] rounded-xl blur-md opacity-60" />
              <div className="relative w-12 h-12 bg-gradient-to-br from-[hsl(20,100%,60%)] to-[hsl(15,100%,45%)] rounded-xl flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
            </div>
            <span className="text-2xl font-bold font-poppins">AutoLead</span>
          </div>

          {/* Invite header */}
          {inviteData && (
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-xl p-6 space-y-4 animate-scale-in">
              <div className="flex items-center justify-center gap-2">
                <div className="p-2 bg-[hsl(20,100%,60%)]/15 rounded-lg border border-[hsl(20,100%,60%)]/20">
                  <UserPlus className="h-4 w-4 text-[hsl(20,100%,75%)]" />
                </div>
                <Badge className="bg-[hsl(20,100%,60%)]/15 text-[hsl(20,100%,80%)] border-[hsl(20,100%,60%)]/20 font-poppins font-medium">
                  Convite recebido
                </Badge>
              </div>
              <h2 className="text-xl font-poppins font-bold text-center">Bem-vindo(a) à equipe!</h2>
              <div className="bg-black/20 border border-white/5 rounded-xl p-4 space-y-2.5">
                <div className="flex items-center gap-3 text-sm">
                  <Building2 className="h-4 w-4 text-white/40" />
                  <span className="font-medium font-poppins text-white/90">{inviteData.orgName}</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <ShieldCheck className="h-4 w-4 text-white/40" />
                  <span className="capitalize font-poppins text-white/90">
                    {inviteData.role === 'admin' ? 'Administrador' : 'Vendedor'}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <Mail className="h-4 w-4 text-white/40" />
                  <span className="text-white/60 font-poppins">{inviteData.email}</span>
                </div>
              </div>
            </div>
          )}

          {/* Header */}
          <div className="text-center space-y-2">
            <h1 className="text-3xl sm:text-4xl font-bold font-poppins tracking-tight">
              {isSignUp ? 'Crie sua conta' : 'Bem-vindo de volta'}
            </h1>
            <p className="text-white/50 font-poppins text-sm sm:text-base">
              {isSignUp
                ? 'Comece a vender com inteligência artificial'
                : 'Entre para acessar seu painel de controle'}
            </p>
          </div>

          {/* Auth form — open layout, no card */}
          <div className="relative">
            {/* Soft ambient glow behind the form */}
            <div className="pointer-events-none absolute -inset-8 bg-gradient-to-br from-[hsl(20,100%,60%)]/10 via-transparent to-[hsl(15,100%,45%)]/10 blur-3xl opacity-70" />
            <div className="relative px-1 sm:px-2">
              {isSignUp ? (
                <SignUp
                  key={inviteData?.email || 'signup-default'}
                  appearance={clerkAppearance}
                  routing="hash"
                  signInUrl="/auth"
                  forceRedirectUrl="/"
                  initialValues={
                    inviteData
                      ? {
                          emailAddress: inviteData.email,
                          ...(inviteData.name
                            ? {
                                firstName: inviteData.name.split(' ')[0] || '',
                                lastName: inviteData.name.split(' ').slice(1).join(' ') || '',
                              }
                            : {}),
                        }
                      : undefined
                  }
                  unsafeMetadata={
                    inviteData
                      ? {
                              organization_id: inviteData.orgId,
                              role: inviteData.role,
                              invited_name: inviteData.name,
                            }
                          : undefined
                      }
                />
              ) : (
                <SignIn
                  key={inviteData?.email || 'signin-default'}
                  appearance={clerkAppearance}
                  routing="hash"
                  signUpUrl="/auth?signup=true"
                  forceRedirectUrl="/"
                  initialValues={
                    inviteData ? { emailAddress: inviteData.email } : undefined
                  }
                />
              )}
            </div>
          </div>

          {/* Toggle */}
          {!inviteData && (
            <div className="text-center">
              <p className="text-sm text-white/50 font-poppins">
                {isSignUp ? 'Já tem uma conta?' : 'Ainda não tem conta?'}
                <Button
                  variant="link"
                  onClick={() => setIsSignUp(!isSignUp)}
                  className="font-poppins font-semibold text-[hsl(20,100%,70%)] hover:text-[hsl(20,100%,80%)] px-1.5"
                >
                  {isSignUp ? 'Fazer login' : 'Criar conta'}
                </Button>
              </p>
            </div>
          )}

          {/* Mobile footer */}
          <div className="lg:hidden text-center text-xs text-white/40 font-poppins pt-2">
            © {new Date().getFullYear()} AutoLead. Todos os direitos reservados.
          </div>
        </div>
      </div>
    </div>
  );
}
