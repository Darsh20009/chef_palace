import { useState } from "react";

const DEFAULT_IMG = "/images/default-coffee.png";

interface ProductImageProps {
  src?: string | null;
  alt?: string;
  className?: string;
  wrapClassName?: string;
  hoverScale?: boolean;
}

export function ProductImage({ src, alt = "", className = "", wrapClassName = "", hoverScale = false }: ProductImageProps) {
  const [failed, setFailed] = useState(false);
  const hasRealImage = !!src && !failed;

  return (
    <div
      className={`overflow-hidden ${hasRealImage ? "" : "bg-[#1a1a1a]"} ${wrapClassName}`}
    >
      <img
        src={hasRealImage ? src! : DEFAULT_IMG}
        alt={alt}
        className={`w-full h-full transition-transform duration-500 ${
          hasRealImage ? "object-cover" : "object-contain p-2"
        } ${hoverScale ? "group-hover:scale-110" : ""} ${className}`}
        onError={() => setFailed(true)}
      />
    </div>
  );
}
