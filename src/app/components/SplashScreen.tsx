import { motion } from 'motion/react';
import { Calendar } from 'lucide-react';

export function SplashScreen() {
  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5, ease: "easeInOut" }}
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-white"
    >
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ 
          duration: 0.8, 
          ease: "easeOut",
          scale: { type: "spring", damping: 12, stiffness: 100 }
        }}
        className="flex flex-col items-center"
      >
        <div className="relative mb-6">
          <motion.div
            animate={{ 
              scale: [1, 1.1, 1],
              rotate: [0, 5, -5, 0]
            }}
            transition={{ 
              duration: 2, 
              repeat: Infinity,
              ease: "easeInOut" 
            }}
            className="w-24 h-24 bg-indigo-50 rounded-3xl flex items-center justify-center shadow-sm"
          >
            <Calendar className="w-12 h-12 text-indigo-600" />
          </motion.div>
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.4, type: "spring" }}
            className="absolute -top-2 -right-2 w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-lg"
          >
            31
          </motion.div>
        </div>
        
        <motion.h1
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.5 }}
          className="text-3xl font-black text-gray-900 tracking-tighter"
        >
          공<span className="text-indigo-600">당</span>
        </motion.h1>
        
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.5 }}
          transition={{ delay: 0.7, duration: 0.5 }}
          className="mt-2 text-sm font-medium text-gray-500 tracking-widest uppercase"
        >
          Duty Management
        </motion.p>
      </motion.div>

      {/* Loading bar animation */}
      <div className="absolute bottom-16 w-48 h-1 bg-gray-100 rounded-full overflow-hidden">
        <motion.div
          initial={{ x: "-100%" }}
          animate={{ x: "100%" }}
          transition={{ 
            duration: 1.5, 
            repeat: Infinity, 
            ease: "linear" 
          }}
          className="w-full h-full bg-indigo-600"
        />
      </div>
    </motion.div>
  );
}
