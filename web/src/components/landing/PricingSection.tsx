import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Check, X, Sparkles, Zap, Clock, ArrowRight
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export default function PricingSection() {
  const navigate = useNavigate();
  const [isAnnual, setIsAnnual] = useState(true);

  const startFeatures = [
    { text: "Gestão de leads", included: true },
    { text: "1 pipeline de vendas", included: true },
    { text: "Cadastro manual de leads", included: true },
    { text: "Follow-ups manuais", included: true },
    { text: "Tags básicas", included: true },
    { text: "Histórico de interações", included: true },
    { text: "Relatórios simples", included: true },
    { text: "Até 3 usuários", included: true },
  ];

  const startNotIncluded = [
    "Automações",
    "Inteligência artificial",
    "Multiatendimento",
    "Disparos em massa",
    "Integrações avançadas",
  ];

  const scaleFeatures = [
    { text: "Tudo do plano Start", included: true, highlight: true },
    { text: "Pipelines ilimitados", included: true },
    { text: "Follow-ups automáticos", included: true },
    { text: "Cadastro automático de leads", included: true },
    { text: "Relatórios inteligentes", included: true },
    { text: "Tags avançadas", included: true },
    { text: "Usuários ilimitados", included: true },
    { text: "Controle de permissões", included: true },
  ];

  const scaleRoadmap = [
    "IA de atendimento",
    "IA que avança etapas do funil",
    "Sistema de multiatendimento",
    "Disparo em massa",
    "Automações avançadas",
  ];

  const fadeInUp = {
    initial: { opacity: 0, y: 30 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true },
    transition: { duration: 0.5 }
  };

  return (
    <section id="planos" className="py-14 sm:py-20 md:py-28 bg-muted/30">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div 
          className="max-w-3xl mx-auto text-center mb-10 sm:mb-12"
          {...fadeInUp}
        >
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium mb-5 sm:mb-6">
            <Sparkles className="w-4 h-4" />
            Planos
          </div>
          <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold mb-4 sm:mb-6 leading-tight">
            Escolha o plano ideal para seu negócio
          </h2>
          <p className="text-base sm:text-lg text-muted-foreground">
            Comece grátis e escale conforme sua empresa cresce
          </p>
        </motion.div>

        {/* Billing Toggle */}
        <motion.div 
          className="flex items-center justify-center gap-4 mb-12"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
        >
          <button
            onClick={() => setIsAnnual(false)}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium transition-all",
              !isAnnual 
                ? "bg-foreground text-background" 
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Mensal
          </button>
          <button
            onClick={() => setIsAnnual(true)}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2",
              isAnnual 
                ? "bg-foreground text-background" 
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Anual
            <span className="bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded-full">
              2 meses grátis
            </span>
          </button>
        </motion.div>

        {/* Plans Grid */}
        <div className="grid md:grid-cols-2 gap-6 lg:gap-8 max-w-5xl mx-auto">
          {/* Plan START */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 }}
          >
            <Card className="h-full border-2 border-border/50 hover:border-border transition-all duration-300">
              <CardContent className="p-6 sm:p-8">
                <div className="mb-6">
                  <h3 className="text-2xl font-bold mb-2">Start</h3>
                  <p className="text-muted-foreground">
                    Para organizar o processo comercial e ter controle dos leads.
                  </p>
                </div>

                <div className="mb-6">
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold">
                      R$ {isAnnual ? "97" : "117"}
                    </span>
                    <span className="text-muted-foreground">/mês</span>
                  </div>
                  {isAnnual && (
                    <p className="text-sm text-muted-foreground mt-1">
                      Cobrado anualmente (R$ 1.164/ano)
                    </p>
                  )}
                </div>

                <Button 
                  variant="outline" 
                  className="w-full h-12 text-base font-semibold mb-8"
                  onClick={() => navigate("/auth?redirect=/settings?tab=billing")}
                >
                  Começar agora
                </Button>

                <div className="space-y-4">
                  <p className="text-sm font-semibold text-foreground">O que está incluído:</p>
                  <ul className="space-y-3">
                    {startFeatures.map((feature, index) => (
                      <li key={index} className="flex items-start gap-3">
                        <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                        <span className="text-sm">{feature.text}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="pt-4 border-t">
                    <p className="text-sm font-semibold text-muted-foreground mb-3">Não inclui:</p>
                    <ul className="space-y-2">
                      {startNotIncluded.map((feature, index) => (
                        <li key={index} className="flex items-start gap-3">
                          <X className="h-4 w-4 text-muted-foreground/50 shrink-0 mt-0.5" />
                          <span className="text-sm text-muted-foreground">{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Plan SCALE */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.4 }}
          >
            <Card className="h-full border-2 border-primary relative overflow-hidden shadow-xl shadow-primary/10">
              {/* Recommended Badge */}
              <div className="absolute top-0 right-0">
                <div className="bg-primary text-primary-foreground text-xs font-semibold px-4 py-1.5 rounded-bl-lg">
                  Recomendado
                </div>
              </div>

              <CardContent className="p-6 sm:p-8">
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-2xl font-bold">Scale</h3>
                    <Zap className="h-5 w-5 text-primary" />
                  </div>
                  <p className="text-muted-foreground">
                    Para escalar vendas com automação e inteligência.
                  </p>
                </div>

                <div className="mb-6">
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold">
                      R$ {isAnnual ? "197" : "237"}
                    </span>
                    <span className="text-muted-foreground">/mês</span>
                  </div>
                  {isAnnual && (
                    <p className="text-sm text-muted-foreground mt-1">
                      Cobrado anualmente (R$ 2.364/ano)
                    </p>
                  )}
                </div>

                <Button 
                  className="w-full h-12 text-base font-semibold mb-8 shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all hover:-translate-y-0.5"
                  onClick={() => navigate("/auth?redirect=/settings?tab=billing")}
                >
                  Começar agora
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>

                <div className="space-y-4">
                  <p className="text-sm font-semibold text-foreground">O que está incluído:</p>
                  <ul className="space-y-3">
                    {scaleFeatures.map((feature, index) => (
                      <li key={index} className="flex items-start gap-3">
                        <Check className={cn(
                          "h-5 w-5 shrink-0 mt-0.5",
                          feature.highlight ? "text-primary" : "text-primary"
                        )} />
                        <span className={cn(
                          "text-sm",
                          feature.highlight && "font-medium text-primary"
                        )}>
                          {feature.text}
                        </span>
                      </li>
                    ))}
                  </ul>

                  <div className="pt-4 border-t">
                    <div className="flex items-center gap-2 mb-3">
                      <Clock className="h-4 w-4 text-accent" />
                      <p className="text-sm font-semibold text-accent">Em breve:</p>
                    </div>
                    <ul className="space-y-2">
                      {scaleRoadmap.map((feature, index) => (
                        <li key={index} className="flex items-start gap-3">
                          <div className="h-4 w-4 rounded-full border-2 border-accent/50 shrink-0 mt-0.5" />
                          <span className="text-sm text-muted-foreground">{feature}</span>
                        </li>
                      ))}
                    </ul>
                    <p className="text-xs text-muted-foreground mt-4 bg-muted/50 p-3 rounded-lg">
                      💡 Essas funcionalidades estão em desenvolvimento e serão liberadas sem custo adicional para assinantes do plano Scale.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Bottom Note */}
        <motion.p 
          className="text-center text-sm text-muted-foreground mt-10 max-w-lg mx-auto"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.5 }}
        >
          Todos os planos incluem suporte por chat e atualizações gratuitas. 
          Cancele quando quiser, sem burocracia.
        </motion.p>
      </div>
    </section>
  );
}
