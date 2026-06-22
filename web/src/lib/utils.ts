import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Formata um número de telefone brasileiro para exibição
 * Entrada: "5511962648677" ou "11962648677"
 * Saída: "55 (11) 962648677"
 */
export function formatPhoneDisplay(phone: string | null | undefined): string {
  if (!phone) return '';
  
  // Remove todos os caracteres não numéricos
  const digits = phone.replace(/\D/g, '');
  
  // Se não tiver dígitos suficientes, retorna o original
  if (digits.length < 10) return phone;
  
  // Se começar com 55 (código do Brasil)
  if (digits.startsWith('55') && digits.length >= 12) {
    const country = digits.slice(0, 2);
    const ddd = digits.slice(2, 4);
    const number = digits.slice(4);
    return `${country} (${ddd}) ${number}`;
  }
  
  // Se não tiver código do país, assume Brasil
  if (digits.length >= 10 && digits.length <= 11) {
    const ddd = digits.slice(0, 2);
    const number = digits.slice(2);
    return `55 (${ddd}) ${number}`;
  }
  
  return phone;
}
