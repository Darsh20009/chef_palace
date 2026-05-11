import { ChangeEvent } from "react";
import { Input } from "@/components/ui/input";

interface SmartIdentifierInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  id?: string;
  "data-testid"?: string;
  required?: boolean;
}

export function SmartIdentifierInput({
  value,
  onChange,
  placeholder = "5xxxxxxxx أو email@example.com",
  className = "",
  id,
  "data-testid": testId,
  required,
}: SmartIdentifierInputProps) {
  const isEmail = value.includes("@");

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value;
    
    if (isEmail || input.includes("@")) {
      // Email mode - no formatting
      onChange(input);
    } else {
      // Phone mode - format as phone number
      let cleaned = input.replace(/\D/g, "");
      cleaned = cleaned.startsWith("0") ? cleaned.slice(1) : cleaned;
      cleaned = cleaned.slice(0, 9);
      onChange(cleaned);
    }
  };

  return (
    <div className="relative">
      {!isEmail && (
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-amber-400/70 font-semibold text-sm">
          +966 |
        </span>
      )}
      <Input
        id={id}
        type={isEmail ? "email" : "tel"}
        inputMode={isEmail ? "email" : "numeric"}
        autoComplete={isEmail ? "email" : "tel"}
        placeholder={placeholder}
        value={value}
        onChange={handleChange}
        className={`${!isEmail ? 'pl-16' : ''} bg-stone-800/50 border-amber-900/50 text-amber-50 placeholder:text-amber-200/40 focus:border-amber-600 focus:ring-amber-600/30 ${className}`}
        dir="ltr"
        data-testid={testId}
        required={required}
      />
    </div>
  );
}
