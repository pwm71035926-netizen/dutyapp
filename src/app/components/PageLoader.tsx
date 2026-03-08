import { motion } from 'motion/react';
import { Calendar, ArrowLeftRight, ShieldCheck, User } from 'lucide-react';

interface PageLoaderProps {
  isVisible: boolean;
}

export function PageLoader({ isVisible }: PageLoaderProps) {
  if (!isVisible) return null;

  const icons = [
    { icon: Calendar, color: 'text-indigo-600', label: '일정 확인' },
    { icon: ArrowLeftRight, color: 'text-blue-500', label: '당직 교환' },
    { icon: ShieldCheck, color: 'text-green-500', label: '보안 검사' },
    { icon: User, color: 'text-orange-500', label: '사용자 인증' }
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-white/95 backdrop-blur-md"
    >
      <div className="relative flex items-center justify-center">
        {/* Pulsing background circles */}
        <motion.div
          animate={{ scale: [1, 1.2, 1], opacity: [0.1, 0.2, 0.1] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          className="absolute w-40 h-40 bg-indigo-600 rounded-full"
        />
        <motion.div
          animate={{ scale: [0.8, 1, 0.8], opacity: [0.15, 0.25, 0.15] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
          className="absolute w-32 h-32 bg-indigo-400 rounded-full"
        />

        {/* Dynamic Icon Animation */}
        <div className="flex flex-col items-center justify-center">
          <div className="h-20 w-20 flex items-center justify-center bg-white rounded-3xl shadow-2xl border border-gray-50 relative z-10">
            {icons.map((item, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, scale: 0, rotate: -20 }}
                animate={isVisible ? {
                  opacity: [0, 1, 1, 0],
                  scale: [0.5, 1, 1, 0.5],
                  rotate: [0, 0, 0, 0],
                } : {}}
                transition={{
                  duration: 2.4,
                  repeat: Infinity,
                  delay: index * 0.6,
                  times: [0, 0.2, 0.8, 1],
                  ease: "easeInOut"
                }}
                className={`absolute ${item.color}`}
              >
                <item.icon className="w-10 h-10" />
              </motion.div>
            ))}
          </div>

          {/* Dynamic Text Labels */}
          <div className="mt-10 h-6 flex items-center justify-center">
            {icons.map((item, index) => (
              <motion.p
                key={index}
                initial={{ opacity: 0, y: 10 }}
                animate={{
                  opacity: [0, 1, 1, 0],
                  y: [10, 0, 0, -10]
                }}
                transition={{
                  duration: 2.4,
                  repeat: Infinity,
                  delay: index * 0.6,
                  times: [0, 0.2, 0.8, 1],
                  ease: "easeInOut"
                }}
                className="absolute text-xs font-black text-gray-500 tracking-[0.3em] uppercase whitespace-nowrap"
              >
                {item.label}
              </motion.p>
            ))}
          </div>
        </div>
      </div>

      {/* Progress Line */}
      <div className="absolute bottom-24 w-48 h-[2px] bg-gray-100 rounded-full overflow-hidden">
        <motion.div
          animate={{ x: ["-100%", "100%"] }}
          transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
          className="w-full h-full bg-indigo-600"
        />
      </div>
      
      <motion.p 
        animate={{ opacity: [0.4, 0.7, 0.4] }}
        transition={{ duration: 1.5, repeat: Infinity }}
        className="absolute bottom-16 text-[9px] font-black text-indigo-400 tracking-widest uppercase"
      >
        Syncing with command center...
      </motion.p>
    </motion.div>
  );
}
