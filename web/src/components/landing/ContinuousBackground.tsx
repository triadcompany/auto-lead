import { motion } from "framer-motion";

/**
 * Background contínuo que atravessa toda a landing page.
 * Fica em position absolute dentro do wrapper raiz e cria continuidade
 * visual entre as seções com blobs laranja distribuídos verticalmente.
 */
export function ContinuousBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none -z-0">
      {/* Grid sutil global */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: `linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)`,
          backgroundSize: "60px 60px",
          maskImage:
            "linear-gradient(to bottom, transparent 0%, black 10%, black 90%, transparent 100%)",
        }}
      />

      {/* Coluna de blobs laranja conectados verticalmente */}
      <motion.div
        className="absolute -left-32 top-[5%] w-[600px] h-[600px] rounded-full blur-3xl bg-primary/25 animate-float-slow"
      />
      <motion.div
        className="absolute -right-40 top-[20%] w-[700px] h-[700px] rounded-full blur-3xl bg-accent/20 animate-float-slow"
        style={{ animationDelay: "2s" }}
      />
      <motion.div
        className="absolute left-1/3 top-[40%] w-[500px] h-[500px] rounded-full blur-3xl bg-primary-glow/20 animate-glow-pulse"
      />
      <motion.div
        className="absolute -left-40 top-[55%] w-[650px] h-[650px] rounded-full blur-3xl bg-primary/20 animate-float-slow"
        style={{ animationDelay: "4s" }}
      />
      <motion.div
        className="absolute -right-32 top-[70%] w-[600px] h-[600px] rounded-full blur-3xl bg-accent/25 animate-float-slow"
        style={{ animationDelay: "6s" }}
      />
      <motion.div
        className="absolute left-1/4 top-[85%] w-[550px] h-[550px] rounded-full blur-3xl bg-primary/20 animate-glow-pulse"
        style={{ animationDelay: "1s" }}
      />
      <motion.div
        className="absolute -right-40 bottom-[5%] w-[700px] h-[700px] rounded-full blur-3xl bg-primary-glow/15 animate-float-slow"
        style={{ animationDelay: "3s" }}
      />

      {/* Linha central de luz vertical sutil para reforçar continuidade */}
      <div
        className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-[1px] opacity-30"
        style={{
          background:
            "linear-gradient(to bottom, transparent, hsl(var(--primary) / 0.4), transparent)",
        }}
      />
    </div>
  );
}
