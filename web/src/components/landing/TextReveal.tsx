import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface TextRevealProps {
  text: string;
  className?: string;
  delay?: number;
  gradient?: boolean;
  as?: "h1" | "h2" | "h3" | "p" | "span";
}

export function TextReveal({
  text,
  className,
  delay = 0,
  gradient = false,
  as: Tag = "span",
}: TextRevealProps) {
  const words = text.split(" ");

  return (
    <Tag className={cn("inline-block", className)}>
      {words.map((word, i) => (
        <span key={i} className="inline-block overflow-hidden align-bottom mr-[0.25em] last:mr-0">
          <motion.span
            className={cn(
              "inline-block",
              gradient &&
                "bg-gradient-to-r from-primary via-accent to-primary-glow bg-clip-text text-transparent bg-200% animate-gradient-x"
            )}
            initial={{ y: "110%", opacity: 0 }}
            animate={{ y: "0%", opacity: 1 }}
            transition={{
              duration: 0.7,
              delay: delay + i * 0.08,
              ease: [0.22, 1, 0.36, 1],
            }}
          >
            {word}
          </motion.span>
        </span>
      ))}
    </Tag>
  );
}

interface TextRevealOnScrollProps extends Omit<TextRevealProps, "delay"> {
  delay?: number;
}

export function TextRevealOnScroll({
  text,
  className,
  delay = 0,
  gradient = false,
  as: Tag = "span",
}: TextRevealOnScrollProps) {
  const words = text.split(" ");

  return (
    <Tag className={cn("inline-block", className)}>
      {words.map((word, i) => (
        <span key={i} className="inline-block overflow-hidden align-bottom mr-[0.25em] last:mr-0">
          <motion.span
            className={cn(
              "inline-block",
              gradient &&
                "bg-gradient-to-r from-primary via-accent to-primary-glow bg-clip-text text-transparent bg-200% animate-gradient-x"
            )}
            initial={{ y: "110%", opacity: 0 }}
            whileInView={{ y: "0%", opacity: 1 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{
              duration: 0.7,
              delay: delay + i * 0.06,
              ease: [0.22, 1, 0.36, 1],
            }}
          >
            {word}
          </motion.span>
        </span>
      ))}
    </Tag>
  );
}
