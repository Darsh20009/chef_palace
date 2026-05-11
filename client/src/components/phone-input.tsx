import { useState, ChangeEvent } from "react";
import { Input } from "@/components/ui/input";

interface PhoneInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  id?: string;
  "data-testid"?: string;
  required?: boolean;
}

export function PhoneInput({
  value,
  onChange,
  placeholder = "5xxxxxxxx",
  className = "",
  id,
  "data-testid": testId,
  required,
}: PhoneInputProps) {
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value;
    // Remove all non-digits
    let cleaned = input.replace(/\D/g, "");
    
    // If starts with 0, remove it (common mistake)
    cleaned = cleaned.startsWith("0") ? cleaned.slice(1) : cleaned;
    
    // Limit to 9 digits
    cleaned = cleaned.slice(0, 9);
    
    onChange(cleaned); // Store and display only clean digits
  };

  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-amber-400/70 font-semibold text-sm">
        +966 |
      </span>
      <Input
        id={id}
        type="tel"
        inputMode="numeric"
        placeholder={placeholder}
        value={value}
        onChange={handleChange}
        maxLength={9}
        className={`pr-12 pl-16 bg-stone-800/50 border-amber-900/50 text-amber-50 placeholder:text-amber-200/40 focus:border-amber-600 focus:ring-amber-600/30 text-left ${className}`}
        dir="rtl"
        data-testid={testId}
        required={required}
      />
    </div>
  );
}
