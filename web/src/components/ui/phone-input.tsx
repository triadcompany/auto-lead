import React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface PhoneInputProps {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  placeholder?: string;
  className?: string;
  required?: boolean;
}

// Normaliza o valor para sempre ter o prefixo 55
const ensureCountryCode = (numbers: string): string => {
  if (numbers.length === 0) return '';
  // Se já começa com 55 e tem mais de 2 dígitos, manter
  if (numbers.startsWith('55') && numbers.length > 2) return numbers;
  // Se tem 10-11 dígitos (DDD + número), adicionar 55
  if (numbers.length >= 10 && numbers.length <= 11) return '55' + numbers;
  return numbers;
};

// Formata o número para exibição: +55 (21) 987968935
const formatPhoneDisplay = (value: string): string => {
  // Remove tudo que não é número
  const raw = value.replace(/\D/g, '');
  const numbers = ensureCountryCode(raw);
  
  if (numbers.length === 0) return '';
  
  // Formato: +55 (DDD) XXXXXXXXX
  if (numbers.length <= 2) {
    return `+${numbers}`;
  } else if (numbers.length <= 4) {
    return `+${numbers.slice(0, 2)} (${numbers.slice(2)}`;
  } else if (numbers.length <= 13) {
    return `+${numbers.slice(0, 2)} (${numbers.slice(2, 4)}) ${numbers.slice(4)}`;
  } else {
    // Limita a 13 dígitos (55 + 2 DDD + 9 número)
    return `+${numbers.slice(0, 2)} (${numbers.slice(2, 4)}) ${numbers.slice(4, 13)}`;
  }
};

export function PhoneInput({ 
  value, 
  onChange, 
  id, 
  placeholder = "+55 (21) 987654321", 
  className,
  required 
}: PhoneInputProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Extrai apenas números do valor digitado
    const numericValue = e.target.value.replace(/\D/g, '');
    // Limita a 13 dígitos
    const limitedValue = numericValue.slice(0, 13);
    onChange(limitedValue);
  };

  // Normaliza o valor para sempre incluir 55 na exibição
  const normalizedValue = ensureCountryCode(value.replace(/\D/g, ''));
  const displayValue = formatPhoneDisplay(normalizedValue);

  return (
    <Input
      id={id}
      type="tel"
      inputMode="numeric"
      value={displayValue}
      onChange={handleChange}
      placeholder={placeholder}
      className={cn(className)}
      required={required}
    />
  );
}
