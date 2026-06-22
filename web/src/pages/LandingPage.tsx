import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Sheet, SheetContent, SheetTrigger, SheetClose } from "@/components/ui/sheet";
import { 
  Target, Users, TrendingUp, BarChart3, Zap, Shield, 
  ArrowRight, CheckCircle2, XCircle, Building2, Smartphone,
  Lock, Server, UserCheck, Layers, Clock, Eye, MessageSquare,
  ChevronRight, Sparkles, Play, Menu
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import PricingSection from "@/components/landing/PricingSection";
import { AnimatedBackground, ScrollProgressBar } from "@/components/landing/AnimatedBackground";
import { ContinuousBackground } from "@/components/landing/ContinuousBackground";
import { TextReveal, TextRevealOnScroll } from "@/components/landing/TextReveal";
import { TiltCard } from "@/components/landing/TiltCard";

export default function LandingPage() {
  const navigate = useNavigate();
  const heroRef = useRef<HTMLElement>(null);
  const { scrollYProgress: heroScroll } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });
  const heroY = useTransform(heroScroll, [0, 1], [0, 200]);
  const heroOpacity = useTransform(heroScroll, [0, 0.8], [1, 0]);

  const problems = [
    { icon: XCircle, text: "Leads chegam e se perdem em planilhas ou WhatsApp" },
    { icon: XCircle, text: "Falta de organização gera esquecimentos e vendas perdidas" },
    { icon: XCircle, text: "Follow-ups são feitos sem padrão ou simplesmente esquecidos" },
    { icon: XCircle, text: "Sem visibilidade do que cada vendedor está fazendo" },
  ];

  const features = [
    { icon: Target, title: "Gestão de Leads", description: "Capture, organize e acompanhe cada lead do primeiro contato até a venda." },
    { icon: TrendingUp, title: "Funil de Vendas", description: "Visualize todas as oportunidades em um quadro intuitivo e fácil de gerenciar." },
    { icon: Clock, title: "Atividades e Follow-ups", description: "Agende tarefas, ligações e lembretes automáticos para nunca perder um contato." },
    { icon: Users, title: "Gestão de Equipe", description: "Distribua leads, acompanhe a performance e mantenha o time alinhado." },
    { icon: Eye, title: "Histórico Centralizado", description: "Todo o histórico de interações em um só lugar, acessível por toda a equipe." },
    { icon: BarChart3, title: "Relatórios Inteligentes", description: "Dashboards e métricas para decisões baseadas em dados reais." },
  ];

  const audiences = [
    { icon: Building2, title: "Pequenas e médias empresas", description: "Que querem crescer de forma organizada" },
    { icon: Users, title: "Times comerciais", description: "Que precisam de processos claros e eficientes" },
    { icon: Smartphone, title: "Prestadores de serviço", description: "Que vendem pelo WhatsApp ou telefone" },
    { icon: MessageSquare, title: "Negócios online", description: "Que recebem leads de múltiplos canais" },
  ];

  const differentials = [
    { icon: Zap, title: "Interface simples", description: "Sem complexidade, começa a usar em minutos" },
    { icon: Clock, title: "Rápida implementação", description: "Sem instalação, funciona no navegador" },
    { icon: Layers, title: "Multiempresa", description: "Gerencie múltiplas unidades em um só lugar" },
    { icon: UserCheck, title: "Controle de permissões", description: "Defina quem vê e edita cada informação" },
    { icon: Target, title: "Foco em produtividade", description: "Telas otimizadas para o dia a dia comercial" },
  ];

  const securities = [
    { icon: Lock, title: "Dados protegidos", description: "Criptografia de ponta a ponta" },
    { icon: UserCheck, title: "Controle de acesso", description: "Permissões granulares por usuário" },
    { icon: Shield, title: "Autenticação segura", description: "Login seguro com verificação em duas etapas" },
    { icon: Server, title: "Infraestrutura confiável", description: "Servidores com 99.9% de disponibilidade" },
  ];

  return (
    <div className="dark min-h-screen bg-background text-foreground overflow-x-hidden relative">
      <ContinuousBackground />
      <ScrollProgressBar />

      {/* Header */}
      <motion.header 
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="fixed top-0 left-0 right-0 z-50 bg-background/70 backdrop-blur-xl border-b border-border/50"
      >
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="h-16 md:h-20 flex items-center justify-between">
            <motion.div 
              className="flex items-center gap-2"
              whileHover={{ scale: 1.05 }}
              transition={{ type: "spring", stiffness: 400 }}
            >
              <div className="relative w-9 h-9 bg-gradient-to-br from-primary to-accent rounded-lg flex items-center justify-center overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-primary to-accent animate-gradient-x bg-200%" />
                <Sparkles className="w-5 h-5 text-primary-foreground relative z-10" />
              </div>
              <span className="font-bold text-xl">AutoLead</span>
            </motion.div>
            <nav className="hidden md:flex items-center gap-8">
              {[
                { href: "#solucao", label: "Solução" },
                { href: "#funcionalidades", label: "Funcionalidades" },
                { href: "#planos", label: "Planos" },
                { href: "#seguranca", label: "Segurança" },
              ].map((item) => (
                <a 
                  key={item.href}
                  href={item.href} 
                  className="relative text-sm font-medium text-muted-foreground hover:text-foreground transition-colors group"
                >
                  {item.label}
                  <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gradient-to-r from-primary to-accent group-hover:w-full transition-all duration-300" />
                </a>
              ))}
            </nav>
            <div className="flex items-center gap-2 sm:gap-3">
              <Button variant="ghost" onClick={() => navigate("/auth")} className="hidden sm:flex">
                Entrar
              </Button>
              <Button 
                onClick={() => navigate("/auth")} 
                size="sm"
                className="font-semibold relative overflow-hidden group md:h-10 md:px-4"
              >
                <span className="relative z-10 text-xs sm:text-sm">Começar agora</span>
                <span className="absolute inset-0 bg-gradient-to-r from-primary via-accent to-primary bg-200% animate-gradient-x opacity-0 group-hover:opacity-100 transition-opacity" />
              </Button>

              {/* Mobile menu */}
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="md:hidden h-9 w-9">
                    <Menu className="h-5 w-5" />
                    <span className="sr-only">Abrir menu</span>
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-[80vw] sm:max-w-sm bg-background/95 backdrop-blur-xl">
                  <nav className="flex flex-col gap-1 mt-10">
                    {[
                      { href: "#solucao", label: "Solução" },
                      { href: "#funcionalidades", label: "Funcionalidades" },
                      { href: "#planos", label: "Planos" },
                      { href: "#seguranca", label: "Segurança" },
                    ].map((item) => (
                      <SheetClose asChild key={item.href}>
                        <a 
                          href={item.href}
                          className="px-4 py-3 rounded-lg text-base font-medium text-foreground hover:bg-muted transition-colors"
                        >
                          {item.label}
                        </a>
                      </SheetClose>
                    ))}
                    <SheetClose asChild>
                      <Button 
                        variant="outline" 
                        onClick={() => navigate("/auth")}
                        className="mt-6 h-12 text-base"
                      >
                        Entrar
                      </Button>
                    </SheetClose>
                  </nav>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </div>
      </motion.header>

      {/* Hero Section */}
      <section ref={heroRef} className="pt-24 pb-14 sm:pt-32 sm:pb-20 md:pt-40 md:pb-32 relative md:min-h-screen flex items-center">
        <AnimatedBackground variant="hero" parallax />

        <motion.div 
          style={{ y: heroY, opacity: heroOpacity }}
          className="container mx-auto px-4 sm:px-6 lg:px-8 relative"
        >
          <div className="max-w-4xl mx-auto text-center">
            {/* Badge */}
            <motion.div 
              className="inline-flex items-center gap-2 bg-primary/10 backdrop-blur border border-primary/20 text-primary px-3 py-1.5 sm:px-4 sm:py-2 rounded-full text-xs sm:text-sm font-medium mb-5 sm:mb-8 relative overflow-hidden group"
              initial={{ opacity: 0, scale: 0.9, y: -20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
            >
              <span className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/20 to-transparent animate-shine" />
              <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 relative z-10" />
              <span className="relative z-10">CRM para times que querem vender mais</span>
            </motion.div>

            {/* Headline */}
            <h1 className="text-[2.25rem] leading-[1.05] sm:text-5xl md:text-6xl lg:text-7xl font-bold mb-5 sm:mb-6 tracking-tight">
              <TextReveal text="Organize suas vendas." className="text-foreground block" delay={0.3} as="span" />
              <TextReveal 
                text="Feche mais negócios." 
                className="block mt-1 sm:mt-2"
                delay={0.7}
                gradient
                as="span"
              />
            </h1>

            {/* Subheadline */}
            <motion.p 
              className="text-base sm:text-xl text-muted-foreground mb-8 sm:mb-10 max-w-2xl mx-auto leading-relaxed px-2 sm:px-0"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.2, duration: 0.6 }}
            >
              O CRM simples e poderoso para pequenas e médias empresas. 
              Gerencie leads, acompanhe o funil de vendas e aumente sua conversão — tudo em um só lugar.
            </motion.p>

            {/* CTAs */}
            <motion.div 
              className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center px-2 sm:px-0"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.4, duration: 0.6 }}
            >
              <Button 
                size="lg" 
                onClick={() => navigate("/auth")} 
                className="h-12 sm:h-14 px-6 sm:px-8 text-base font-semibold shadow-lg shadow-primary/30 hover:shadow-2xl hover:shadow-primary/40 transition-all hover:-translate-y-1 relative overflow-hidden group w-full sm:w-auto"
              >
                <span className="absolute inset-0 bg-gradient-to-r from-primary via-accent to-primary bg-200% animate-gradient-x" />
                <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                <span className="relative z-10 flex items-center justify-center">
                  Começar agora
                  <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </span>
              </Button>
              <Button 
                size="lg" 
                variant="outline" 
                className="h-12 sm:h-14 px-6 sm:px-8 text-base font-semibold group backdrop-blur bg-foreground/5 hover:bg-background border-2 hover:border-primary/50 transition-all hover:-translate-y-1 w-full sm:w-auto"
              >
                <Play className="mr-2 h-5 w-5 group-hover:text-primary group-hover:scale-125 transition-all" />
                Ver como funciona
              </Button>
            </motion.div>

            {/* Trust indicators */}
            <motion.div 
              className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 sm:gap-6 mt-8 sm:mt-12 text-xs sm:text-sm text-muted-foreground"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.7, duration: 0.6 }}
            >
              {["Teste grátis", "Sem cartão de crédito", "Pronto em minutos"].map((text, i) => (
                <motion.div 
                  key={text}
                  className="flex items-center gap-1.5 sm:gap-2"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 1.7 + i * 0.1 }}
                >
                  <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                  <span>{text}</span>
                </motion.div>
              ))}
            </motion.div>
          </div>

          {/* Floating decorative elements */}
          <motion.div
            className="absolute top-20 left-10 w-2 h-2 bg-primary rounded-full hidden lg:block"
            animate={{ y: [0, -20, 0], opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 3, repeat: Infinity }}
          />
          <motion.div
            className="absolute top-40 right-20 w-3 h-3 bg-accent rounded-full hidden lg:block"
            animate={{ y: [0, -30, 0], opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 4, repeat: Infinity, delay: 0.5 }}
          />
          <motion.div
            className="absolute bottom-20 left-1/4 w-2 h-2 bg-primary-glow rounded-full hidden lg:block"
            animate={{ y: [0, -25, 0], opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 3.5, repeat: Infinity, delay: 1 }}
          />
        </motion.div>
      </section>

      {/* Problems Section */}
      <section className="py-14 sm:py-20 md:py-28 relative">
        {/* sem fundo: o ContinuousBackground global cuida da continuidade */}
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative">
          <motion.div 
            className="max-w-3xl mx-auto text-center mb-10 sm:mb-16"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold mb-4 sm:mb-6 leading-tight">
              <TextRevealOnScroll text="Você conhece esses problemas?" as="span" />
            </h2>
            <p className="text-base sm:text-lg text-muted-foreground">
              Se sua equipe comercial enfrenta algum desses desafios, o AutoLead foi feito para você.
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-2 gap-4 max-w-3xl mx-auto">
            {problems.map((problem, index) => (
              <motion.div
                key={index}
                className="group flex items-start gap-4 p-6 bg-background/80 backdrop-blur rounded-2xl border border-border/50 shadow-sm hover:shadow-xl hover:shadow-destructive/5 hover:border-destructive/30 transition-all duration-500 hover:-translate-y-1"
                initial={{ opacity: 0, x: index % 2 === 0 ? -30 : 30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1, duration: 0.5 }}
              >
                <div className="p-2 bg-destructive/10 rounded-lg shrink-0 group-hover:scale-110 group-hover:rotate-6 transition-transform duration-300">
                  <problem.icon className="h-5 w-5 text-destructive" />
                </div>
                <p className="text-foreground font-medium">{problem.text}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Solution Section */}
      <section id="solucao" className="py-14 sm:py-20 md:py-28 relative">
        {/* fundo global */}
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative">
          <motion.div 
            className="max-w-3xl mx-auto text-center mb-10 sm:mb-16"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <motion.div 
              className="inline-flex items-center gap-2 bg-primary/10 border border-primary/30 text-primary px-4 py-2 sm:px-6 sm:py-3 rounded-full text-sm sm:text-base md:text-lg font-semibold mb-4 shadow-lg shadow-primary/10"
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
            >
              <Sparkles className="w-4 h-4 sm:w-5 sm:h-5" />
              A solução
            </motion.div>
            <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold mb-4 sm:mb-6 leading-tight">
              <TextRevealOnScroll text="Um CRM que sua equipe vai usar de verdade" as="span" />
            </h2>
            <p className="text-base sm:text-lg text-muted-foreground leading-relaxed">
              Interface intuitiva, implementação em minutos e tudo que você precisa para 
              gerenciar seu funil de vendas. Sem complicação, sem curva de aprendizado longa.
            </p>
          </motion.div>

          <div id="funcionalidades" className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ delay: index * 0.1, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              >
                <TiltCard intensity={6}>
                  <Card className="h-full border-2 border-border/50 hover:border-primary/40 transition-all duration-500 hover:shadow-2xl hover:shadow-primary/10 group bg-gradient-to-br from-background to-muted/30 relative overflow-hidden">
                    {/* Shine effect */}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 pointer-events-none" />
                    <CardContent className="p-6 relative">
                      <div className="relative w-14 h-14 mb-5">
                        <div className="absolute inset-0 bg-primary/10 rounded-2xl group-hover:bg-primary/20 transition-colors" />
                        <div className="absolute inset-0 bg-primary/0 group-hover:bg-primary/30 rounded-2xl blur-xl group-hover:blur-2xl transition-all duration-500" />
                        <div className="relative w-14 h-14 flex items-center justify-center">
                          <feature.icon className="h-7 w-7 text-primary group-hover:scale-110 group-hover:rotate-6 transition-transform duration-300" />
                        </div>
                      </div>
                      <h3 className="text-xl font-semibold mb-3 group-hover:text-primary transition-colors">{feature.title}</h3>
                      <p className="text-muted-foreground">{feature.description}</p>
                    </CardContent>
                  </Card>
                </TiltCard>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* For Who Section */}
      <section className="py-14 sm:py-20 md:py-28 relative">
        {/* fundo global */}
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative">
          <motion.div 
            className="max-w-3xl mx-auto text-center mb-10 sm:mb-16"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold mb-4 sm:mb-6 leading-tight">
              <TextRevealOnScroll text="Para quem é o AutoLead?" as="span" />
            </h2>
            <p className="text-base sm:text-lg text-muted-foreground">
              Feito para quem precisa organizar vendas sem burocracia
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
            {audiences.map((audience, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1, duration: 0.6 }}
              >
                <TiltCard intensity={8}>
                  <div className="text-center p-6 rounded-2xl bg-background/80 backdrop-blur border border-border/50 hover:border-primary/40 transition-all duration-500 hover:shadow-2xl hover:shadow-primary/10 group h-full">
                    <div className="relative w-16 h-16 mx-auto mb-4">
                      <div className="absolute inset-0 bg-primary/10 rounded-2xl group-hover:bg-primary/20 transition-colors" />
                      <div className="absolute inset-0 bg-primary/0 group-hover:bg-primary/40 rounded-2xl blur-xl transition-all duration-500" />
                      <div className="relative w-16 h-16 flex items-center justify-center">
                        <audience.icon className="h-8 w-8 text-primary group-hover:scale-110 transition-transform" />
                      </div>
                    </div>
                    <h3 className="font-semibold text-lg mb-2 group-hover:text-primary transition-colors">{audience.title}</h3>
                    <p className="text-sm text-muted-foreground">{audience.description}</p>
                  </div>
                </TiltCard>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Differentials Section */}
      <section className="py-14 sm:py-20 md:py-28 relative">
        {/* fundo global */}
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative">
          <motion.div 
            className="max-w-3xl mx-auto text-center mb-10 sm:mb-16"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold mb-4 sm:mb-6 leading-tight">
              <TextRevealOnScroll text="Por que escolher o AutoLead?" as="span" />
            </h2>
            <p className="text-base sm:text-lg text-muted-foreground">
              Diferenciais que fazem a diferença no seu dia a dia
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4 max-w-6xl mx-auto">
            {differentials.map((diff, index) => (
              <motion.div
                key={index}
                className="group flex flex-col items-center text-center p-6 rounded-2xl bg-gradient-to-b from-muted/50 to-background border border-border/50 hover:border-primary/40 transition-all duration-500 hover:-translate-y-2 hover:shadow-xl hover:shadow-primary/10"
                initial={{ opacity: 0, y: 40, rotateX: -15 }}
                whileInView={{ opacity: 1, y: 0, rotateX: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1, duration: 0.6 }}
              >
                <div className="relative w-12 h-12 mb-4">
                  <div className="absolute inset-0 bg-primary/10 rounded-xl group-hover:bg-primary/20 transition-colors" />
                  <div className="absolute inset-0 bg-primary/0 group-hover:bg-primary/30 rounded-xl blur-lg transition-all" />
                  <div className="relative w-12 h-12 flex items-center justify-center">
                    <diff.icon className="h-6 w-6 text-primary group-hover:rotate-12 group-hover:scale-110 transition-transform" />
                  </div>
                </div>
                <h3 className="font-semibold mb-2 group-hover:text-primary transition-colors">{diff.title}</h3>
                <p className="text-sm text-muted-foreground">{diff.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Security Section */}
      <section id="seguranca" className="py-14 sm:py-20 md:py-28 relative">
        {/* fundo global */}
        {/* Animated grid */}
        <div 
          className="absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage: `linear-gradient(hsl(var(--background)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--background)) 1px, transparent 1px)`,
            backgroundSize: "50px 50px",
          }}
        />
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative">
          <motion.div 
            className="max-w-3xl mx-auto text-center mb-10 sm:mb-16"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <motion.div 
              className="inline-flex items-center gap-2 bg-primary/10 backdrop-blur border border-primary/30 text-primary px-4 py-2 sm:px-6 sm:py-3 rounded-full text-sm sm:text-base md:text-lg font-semibold mb-4 shadow-lg shadow-primary/10"
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
            >
              <Shield className="w-4 h-4 sm:w-5 sm:h-5" />
              Segurança
            </motion.div>
            <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold mb-4 sm:mb-6 leading-tight">
              <TextRevealOnScroll text="Seus dados protegidos" as="span" />
            </h2>
            <p className="text-base sm:text-lg text-muted-foreground">
              Segurança de nível empresarial para você focar no que importa: vender
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
            {securities.map((security, index) => (
              <motion.div
                key={index}
                className="group text-center p-6 rounded-2xl bg-foreground/5 backdrop-blur border border-foreground/10 hover:border-primary/40 hover:bg-foreground/10 transition-all duration-500 hover:-translate-y-2"
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1, duration: 0.6 }}
              >
                <div className="relative w-14 h-14 mx-auto mb-4">
                  <div className="absolute inset-0 bg-foreground/10 rounded-2xl group-hover:bg-primary/20 transition-colors" />
                  <div className="absolute inset-0 bg-primary/0 group-hover:bg-primary/40 rounded-2xl blur-xl transition-all duration-500" />
                  <div className="relative w-14 h-14 flex items-center justify-center">
                    <security.icon className="h-7 w-7 text-foreground group-hover:text-primary group-hover:scale-110 transition-all" />
                  </div>
                </div>
                <h3 className="font-semibold text-lg mb-2">{security.title}</h3>
                <p className="text-sm text-muted-foreground">{security.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <PricingSection />

      {/* Final CTA Section */}
      <section className="py-16 sm:py-24 md:py-32 relative">
        {/* fundo global */}
        
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative">
          <motion.div 
            className="max-w-3xl mx-auto text-center"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold mb-4 sm:mb-6 leading-tight">
              <TextRevealOnScroll text="Pronto para organizar suas vendas?" as="span" />
            </h2>
            <motion.p 
              className="text-base sm:text-lg text-muted-foreground mb-8 sm:mb-10 max-w-xl mx-auto"
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.4 }}
            >
              Comece agora e veja como é fácil gerenciar leads e fechar mais negócios com o AutoLead.
            </motion.p>
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.5, type: "spring", stiffness: 200 }}
            >
              <Button 
                size="lg" 
                onClick={() => navigate("/auth")} 
                className="h-12 sm:h-14 px-8 sm:px-10 text-base font-semibold shadow-xl shadow-primary/30 hover:shadow-2xl hover:shadow-primary/40 transition-all hover:-translate-y-1 relative overflow-hidden group w-full sm:w-auto max-w-sm"
              >
                <span className="absolute inset-0 bg-gradient-to-r from-primary via-accent to-primary bg-200% animate-gradient-x" />
                <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                <span className="relative z-10 flex items-center justify-center">
                  Criar conta gratuita
                  <ChevronRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </span>
              </Button>
            </motion.div>
            <p className="text-sm text-muted-foreground mt-6">
              Sem compromisso. Cancele quando quiser.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 sm:py-12 border-t border-border/50 relative bg-background/40 backdrop-blur">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10 sm:mb-12">
            <div className="md:col-span-2">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-9 h-9 bg-gradient-to-br from-primary to-accent rounded-lg flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-primary-foreground" />
                </div>
                <span className="font-bold text-xl">AutoLead</span>
              </div>
              <p className="text-muted-foreground max-w-sm">
                O CRM simples e poderoso para pequenas e médias empresas que querem vender mais.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Produto</h3>
              <ul className="space-y-3 text-sm text-muted-foreground">
                <li><a href="#funcionalidades" className="hover:text-foreground transition-colors">Funcionalidades</a></li>
                <li><a href="#planos" className="hover:text-foreground transition-colors">Planos</a></li>
                <li><a href="#seguranca" className="hover:text-foreground transition-colors">Segurança</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Empresa</h3>
              <ul className="space-y-3 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground transition-colors">Sobre</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Contato</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Blog</a></li>
              </ul>
            </div>
          </div>
          <div className="pt-8 border-t flex flex-col sm:flex-row justify-between items-center gap-4">
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} AutoLead. Todos os direitos reservados.
            </p>
            <div className="flex gap-6 text-sm text-muted-foreground">
              <a href="#" className="hover:text-foreground transition-colors">Privacidade</a>
              <a href="#" className="hover:text-foreground transition-colors">Termos</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
