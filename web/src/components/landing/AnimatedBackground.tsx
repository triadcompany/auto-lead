import { motion, useScroll, useTransform, useMotionValue, useSpring } from "framer-motion";
import { useEffect, useRef } from "react";

interface AnimatedBackgroundProps {
  variant?: "hero" | "section" | "dark";
  showGrid?: boolean;
  showBlobs?: boolean;
  parallax?: boolean;
}

export function AnimatedBackground({
  variant = "section",
  showGrid = true,
  showBlobs = true,
  parallax = false,
}: AnimatedBackgroundProps) {
  const ref = useRef<HTMLDivElement>(null);
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const springX = useSpring(mouseX, { stiffness: 50, damping: 20 });
  const springY = useSpring(mouseY, { stiffness: 50, damping: 20 });

  useEffect(() => {
    if (!parallax) return;
    const handleMouseMove = (e: MouseEvent) => {
      const rect = ref.current?.getBoundingClientRect();
      if (!rect) return;
      const x = (e.clientX - rect.left - rect.width / 2) / rect.width;
      const y = (e.clientY - rect.top - rect.height / 2) / rect.height;
      mouseX.set(x * 40);
      mouseY.set(y * 40);
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [parallax, mouseX, mouseY]);

  const isDark = variant === "dark";

  return (
    <div ref={ref} className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Grid pattern */}
      {showGrid && (
        <div
          className="absolute inset-0 opacity-[0.03] dark:opacity-[0.06]"
          style={{
            backgroundImage: `linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)`,
            backgroundSize: "60px 60px",
            maskImage: "radial-gradient(ellipse at center, black 40%, transparent 80%)",
          }}
        />
      )}

      {/* Animated blobs */}
      {showBlobs && (
        <>
          <motion.div
            style={parallax ? { x: springX, y: springY } : undefined}
            className={`absolute -top-20 -left-20 w-[500px] h-[500px] rounded-full blur-3xl animate-float-slow ${
              isDark ? "bg-primary/20" : "bg-primary/10 dark:bg-primary/15"
            }`}
          />
          <motion.div
            style={parallax ? { x: useTransform(springX, (v) => -v), y: useTransform(springY, (v) => -v) } : undefined}
            className={`absolute top-1/3 -right-20 w-[600px] h-[600px] rounded-full blur-3xl animate-float-slow ${
              isDark ? "bg-accent/15" : "bg-accent/10 dark:bg-accent/15"
            }`}
            transition={{ delay: 2 }}
          />
          <motion.div
            className={`absolute bottom-0 left-1/3 w-[400px] h-[400px] rounded-full blur-3xl animate-glow-pulse ${
              isDark ? "bg-primary-glow/10" : "bg-primary-glow/8 dark:bg-primary-glow/15"
            }`}
          />
        </>
      )}

      {/* Subtle radial gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background/40" />
    </div>
  );
}

export function ScrollProgressBar() {
  const { scrollYProgress } = useScroll();
  return (
    <motion.div
      className="fixed top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-accent to-primary-glow z-[60] origin-left"
      style={{ scaleX: scrollYProgress }}
    />
  );
}
