import { motion } from "framer-motion";

interface CoffeeAnimationProps {
  className?: string;
  size?: "sm" | "md" | "lg";
}

export default function CoffeeAnimation({ className, size = "md" }: CoffeeAnimationProps) {
  const scale = size === "sm" ? 0.5 : size === "lg" ? 1.2 : 1;
  
  return (
    <div className={`relative flex items-center justify-center ${className}`} style={{ transform: `scale(${scale})` }}>
      {/* The Cup */}
      <div className="absolute bottom-4 w-32 h-24 border-4 border-white/40 border-t-0 rounded-b-[40px] bg-white/10 backdrop-blur-sm">
        {/* Coffee Level Rising */}
        <motion.div
          initial={{ height: 0 }}
          animate={{ height: "80%" }}
          transition={{ duration: 3, ease: "easeInOut" }}
          className="absolute bottom-0 left-0 right-0 bg-[#3d2b1f] rounded-b-[36px]"
        />
        
        {/* Steam Effect */}
        <div className="absolute -top-8 left-1/2 -translate-x-1/2 flex gap-2">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: [0, 1, 0], y: -20 }}
              transition={{ 
                duration: 2, 
                repeat: Infinity, 
                delay: i * 0.6,
                ease: "easeOut" 
              }}
              className="w-1.5 h-6 bg-white/20 rounded-full blur-[2px]"
            />
          ))}
        </div>
      </div>

      {/* The Pouring Coffee Stream */}
      <motion.div
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: "120px", opacity: [0, 1, 1, 0] }}
        transition={{ 
          duration: 3, 
          times: [0, 0.1, 0.9, 1],
          ease: "linear" 
        }}
        className="absolute top-[-40px] left-1/2 -translate-x-1/2 w-2 bg-[#3d2b1f] rounded-full z-20"
      />

      {/* Splash Effect */}
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: [0, 1, 0], opacity: [0, 1, 0] }}
        transition={{ 
          duration: 0.5, 
          repeat: 5,
          repeatType: "loop"
        }}
        className="absolute bottom-16 left-1/2 -translate-x-1/2 w-6 h-2 bg-[#3d2b1f] rounded-full blur-[1px] z-30"
      />
    </div>
  );
}
