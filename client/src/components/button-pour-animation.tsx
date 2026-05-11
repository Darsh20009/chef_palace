import { motion } from "framer-motion";

export default function ButtonPourAnimation() {
  return (
    <div className="absolute inset-0 w-full h-full overflow-hidden rounded-xl">
      {/* Coffee Filling Background */}
      <motion.div
        initial={{ height: 0 }}
        animate={{ height: "100%" }}
        transition={{ duration: 4, ease: "easeInOut" }}
        className="absolute bottom-0 left-0 right-0 bg-[#3d2b1f] z-0"
      />
      
      {/* Pouring Jug (Dallah/Jug) Animation */}
      <motion.div
        initial={{ x: 60, y: -80, rotate: -20, opacity: 0 }}
        animate={{ 
          x: [60, 40, 40, 60], 
          y: [-80, -60, -60, -80],
          rotate: [-20, -45, -45, -20],
          opacity: [0, 1, 1, 0] 
        }}
        transition={{ 
          duration: 4, 
          times: [0, 0.2, 0.8, 1],
          ease: "easeInOut" 
        }}
        className="absolute top-0 right-0 z-30 pointer-events-none"
      >
        {/* Simple Jug Shape */}
        <div className="relative w-16 h-20">
          <div className="absolute top-4 left-0 w-12 h-16 bg-[#F7F8F8] rounded-b-2xl rounded-tr-xl border-2 border-[#2D9B6E]" />
          <div className="absolute top-6 -left-4 w-6 h-2 bg-[#F7F8F8] border-2 border-[#2D9B6E] -rotate-45 rounded-full" />
          <div className="absolute top-8 right-2 w-4 h-8 border-2 border-[#2D9B6E] rounded-r-full" />
        </div>
      </motion.div>

      {/* Pouring Stream */}
      <motion.div
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: "100%", opacity: [0, 1, 1, 0] }}
        transition={{ 
          duration: 3.5, 
          times: [0, 0.1, 0.9, 1],
          delay: 0.2,
          ease: "linear" 
        }}
        className="absolute top-0 left-1/2 -translate-x-1/2 w-2 bg-[#4a3427] z-10 shadow-[0_0_10px_rgba(74,52,39,0.5)]"
      >
        <div className="absolute inset-y-0 left-0.5 w-0.5 bg-white/20" />
      </motion.div>

      {/* Surface Foam Effect */}
      <motion.div
        initial={{ bottom: 0 }}
        animate={{ bottom: "100%" }}
        transition={{ duration: 4, ease: "easeInOut" }}
        className="absolute left-0 right-0 h-3 bg-[#5c3d2e] blur-[1px] z-5 flex justify-around items-center"
      >
        {[...Array(5)].map((_, i) => (
          <div key={i} className="w-1 h-1 bg-white/20 rounded-full animate-pulse" />
        ))}
      </motion.div>
    </div>
  );
}
