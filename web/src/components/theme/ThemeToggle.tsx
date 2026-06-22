import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";

interface ThemeToggleProps {
  variant?: "icon" | "full";
  className?: string;
}

export function ThemeToggle({ variant = "icon", className }: ThemeToggleProps) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const isDark = theme === "dark";
  const toggle = () => setTheme(isDark ? "light" : "dark");

  if (!mounted) {
    return (
      <Button
        variant="ghost"
        size={variant === "icon" ? "icon" : "sm"}
        className={className}
        aria-label="Alternar tema"
      >
        <Sun className="h-4 w-4" />
      </Button>
    );
  }

  if (variant === "full") {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={toggle}
        className={`w-full justify-start font-poppins text-xs ${className ?? ""}`}
        aria-label="Alternar tema"
      >
        {isDark ? (
          <Sun className="h-3 w-3 mr-2" />
        ) : (
          <Moon className="h-3 w-3 mr-2" />
        )}
        {isDark ? "Tema claro" : "Tema escuro"}
      </Button>
    );
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
      className={className}
      aria-label="Alternar tema"
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}
