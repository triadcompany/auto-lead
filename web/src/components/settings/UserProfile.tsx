import React, { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { 
  User, 
  Camera, 
  Shield, 
  Save,
  ExternalLink,
  Crown,
  CreditCard,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useClerk, useUser } from "@clerk/clerk-react";
import { supabase } from "@/integrations/supabase/client";
import { useSubscription } from "@/hooks/useSubscription";
import { useNavigate } from "react-router-dom";
import { resizeAndCropToSquare } from "@/lib/image";
import { ImageCropDialog, fileToDataUrl } from "@/components/ui/image-crop-dialog";

export function UserProfile() {
  const { profile, user, refreshProfile, isAdmin, userName, userEmail } = useAuth();
  const { openUserProfile } = useClerk();
  const { user: clerkUser } = useUser();
  const { toast } = useToast();
  const { subscription, loading: subscriptionLoading } = useSubscription();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [isUpdating, setIsUpdating] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    name: "",
  });

  // Load name: prioritize Supabase profile, fallback to Clerk
  useEffect(() => {
    if (profile?.name) {
      setFormData({ name: profile.name });
      setProfileLoaded(true);
    } else if (userName) {
      setFormData({ name: userName });
      setProfileLoaded(true);

      // Auto-sync to Supabase silently if profile exists with empty name
      if (profile && !profile.name) {
        supabase
          .from('profiles')
          .update({ name: userName, updated_at: new Date().toISOString() })
          .eq('id', profile.id)
          .then(({ error }) => {
            if (error) console.error('Auto-sync name failed:', error);
            else console.log('✅ Auto-synced name from Clerk to Supabase');
          });
      }
    }
  }, [profile, userName]);

  const getPlanInfo = () => {
    if (subscriptionLoading) return { label: "...", variant: "secondary" as const, icon: false };
    if (!subscription?.subscribed || !subscription.plan) {
      return { label: "Free", variant: "secondary" as const, icon: false };
    }
    if (subscription.plan === "scale") {
      return { label: "Scale", variant: "default" as const, icon: true };
    }
    return { label: "Start", variant: "outline" as const, icon: false };
  };

  const planInfo = getPlanInfo();

  const handleInputChange = (field: keyof typeof formData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleUpdateProfile = async () => {
    if (!user?.id) return;
    const trimmed = formData.name.trim();
    if (!trimmed) return;

    setIsUpdating(true);
    try {
      const fd = new FormData();
      fd.append("clerk_user_id", user.id);
      fd.append("name", trimmed);

      const { data, error } = await supabase.functions.invoke('update-user-profile', {
        body: fd,
      });

      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);

      // Also update Clerk so the displayed name stays in sync everywhere
      try {
        const parts = trimmed.split(/\s+/);
        const firstName = parts[0] || trimmed;
        const lastName = parts.slice(1).join(' ');
        await clerkUser?.update?.({ firstName, lastName });
      } catch (e) {
        console.warn('Clerk name sync failed (non-fatal):', e);
      }

      await refreshProfile();
      toast({
        title: "Perfil atualizado",
        description: "Suas informações foram atualizadas com sucesso.",
      });
    } catch (error: any) {
      console.error('Error updating profile:', error);
      toast({
        title: "Erro",
        description: error?.message || "Erro ao atualizar perfil. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleAvatarSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user?.id) return;

    if (!file.type.startsWith('image/')) {
      toast({
        title: "Erro",
        description: "Por favor, selecione apenas arquivos de imagem.",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "Erro",
        description: "A imagem deve ter no máximo 10MB.",
        variant: "destructive",
      });
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    try {
      const dataUrl = await fileToDataUrl(file);
      setCropSrc(dataUrl);
    } catch (e) {
      toast({ title: "Erro", description: "Não foi possível ler a imagem.", variant: "destructive" });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleCroppedAvatar = async (cropped: File) => {
    if (!user?.id) return;
    setIsUploadingAvatar(true);
    try {
      // Re-encode at 512x512 to keep file small (cropper already gave us a square)
      const processed = await resizeAndCropToSquare(cropped, 512, 0.9);

      const fd = new FormData();
      fd.append("clerk_user_id", user.id);
      fd.append("file", processed, "avatar.jpg");

      const [supaRes] = await Promise.all([
        supabase.functions.invoke('update-user-profile', { body: fd }),
        clerkUser?.setProfileImage?.({ file: processed }).catch((e) => {
          console.warn('Clerk avatar sync failed (non-fatal):', e);
        }),
      ]);

      if (supaRes.error) throw supaRes.error;
      if ((supaRes.data as any)?.error) throw new Error((supaRes.data as any).error);

      await refreshProfile();
      toast({
        title: "Avatar atualizado",
        description: "Sua foto foi atualizada com sucesso.",
      });
      setCropSrc(null);
    } catch (error: any) {
      console.error('Error uploading avatar:', error);
      toast({
        title: "Erro",
        description: error?.message || "Erro ao fazer upload da imagem. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsUploadingAvatar(false);
    }
  };


  const handleOpenAccountPortal = () => {
    openUserProfile();
  };

  const getInitials = (name: string | undefined) => {
    if (!name) return "U";
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
  };

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Account Information */}
      <Card className="border bg-card">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <User className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg font-semibold">
                Informações da Conta
              </CardTitle>
              <CardDescription className="text-sm text-muted-foreground">
                Essas informações são vinculadas à sua conta de acesso.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Avatar Section */}
          <div className="flex items-center gap-6">
            <Avatar className="w-20 h-20 border-2 border-border">
              <AvatarImage
                src={clerkUser?.imageUrl || profile?.avatar_url}
                alt={formData.name || userName}
                className="object-cover"
              />
              <AvatarFallback className="bg-primary/10 text-primary text-lg font-semibold">
                {getInitials(formData.name || userName)}
              </AvatarFallback>
            </Avatar>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant={planInfo.variant} className="flex items-center gap-1">
                  {planInfo.icon && <Crown className="h-3 w-3" />}
                  Plano {planInfo.label}
                </Badge>
                <Badge variant="outline" className="capitalize">
                  {isAdmin ? "Admin" : "Vendedor"}
                </Badge>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploadingAvatar}
              >
                <Camera className="h-4 w-4 mr-2" />
                {isUploadingAvatar ? "Enviando..." : "Alterar foto"}
              </Button>
              <p className="text-xs text-muted-foreground">
                JPG, PNG ou GIF. Máximo 2MB.
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarSelected}
                className="hidden"
              />
            </div>
          </div>

          {/* Plan Info Card */}
          <div className="p-4 rounded-lg bg-muted/50 border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <CreditCard className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium">
                    Plano atual: <span className={planInfo.icon ? "text-amber-500" : "text-primary"}>{planInfo.label}</span>
                  </p>
                  {subscription?.current_period_end && (
                    <p className="text-xs text-muted-foreground">
                      {subscription.cancel_at_period_end 
                        ? `Expira em ${new Date(subscription.current_period_end).toLocaleDateString('pt-BR')}`
                        : `Renova em ${new Date(subscription.current_period_end).toLocaleDateString('pt-BR')}`
                      }
                    </p>
                  )}
                </div>
              </div>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => navigate('/settings?tab=billing')}
              >
                {subscription?.subscribed ? "Gerenciar" : "Fazer upgrade"}
              </Button>
            </div>
          </div>

          <Separator />

          {/* Name and Email */}
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm font-medium">
                Nome completo
              </Label>
              {!profileLoaded ? (
                <Skeleton className="h-10 max-w-md" />
              ) : (
                <Input 
                  id="name"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  placeholder="Seu nome completo"
                  className="max-w-md"
                />
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">
                E-mail
              </Label>
              <Input 
                id="email"
                value={userEmail || user?.email || ""}
                disabled
                className="max-w-md bg-muted/50"
              />
              <p className="text-xs text-muted-foreground">
                O e-mail é gerenciado pela sua conta de acesso.
              </p>
            </div>
          </div>

          <Separator />

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Button 
              onClick={handleUpdateProfile}
              disabled={isUpdating || !formData.name.trim() || formData.name === (profile?.name || userName)}
              className="w-full sm:w-auto"
            >
              <Save className="h-4 w-4 mr-2" />
              {isUpdating ? "Salvando..." : "Salvar alterações"}
            </Button>
            <Button 
              variant="outline"
              onClick={handleOpenAccountPortal}
              className="w-full sm:w-auto"
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Gerenciar conta de acesso
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Security Section */}
      <Card className="border bg-card">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Shield className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg font-semibold">
                Segurança da Conta
              </CardTitle>
              <CardDescription className="text-sm text-muted-foreground">
                A senha e métodos de login são gerenciados com segurança pela plataforma de autenticação.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Button 
            variant="outline"
            onClick={handleOpenAccountPortal}
          >
            <Shield className="h-4 w-4 mr-2" />
            Alterar senha ou métodos de login
          </Button>
        </CardContent>
      </Card>

      <ImageCropDialog
        open={!!cropSrc}
        imageSrc={cropSrc}
        aspect={1}
        cropShape="round"
        outputSize={512}
        title="Ajustar foto de perfil"
        description="Arraste, gire e use o zoom para enquadrar sua foto."
        onCancel={() => setCropSrc(null)}
        onConfirm={handleCroppedAvatar}
      />
    </div>
  );
}
