import React from 'react';
import { motion } from 'motion/react';
import clsx from 'clsx';

interface RecordButtonProps {
  isRecording: boolean;
  isProcessing?: boolean;
  onClick: () => void;
  className?: string;
}

export const RecordButton: React.FC<RecordButtonProps> = ({ isRecording, isProcessing = false, onClick, className }) => {
  
  // Define color palettes
  const colors = isProcessing ? {
    // Blue Palette for Processing
    outer: "#0A84FF",
    ring2: "#5AC8FA",
    ring3: "#B6E4FF",
    ring4: "#E5F6FF"
  } : {
    // Red Palette for Recording / Idle
    outer: "#FE5244",
    ring2: "#FFA69F",
    ring3: "#FEDFDC",
    ring4: "#FFF2F1"
  };

  return (
    <button 
      onClick={isProcessing ? undefined : onClick} 
      className={clsx(
        "relative flex items-center justify-center transition-transform focus:outline-none cursor-pointer aspect-square", 
        isProcessing ? "cursor-default" : "active:scale-95",
        className
      )}
      title={isProcessing ? "Zpracovávám..." : (isRecording ? "Zastavit nahrávání" : "Spustit nahrávání")}
      disabled={isProcessing}
    >
      {/* Outer Circle */}
      <motion.div
        animate={
            isProcessing 
            ? { scale: [1, 1.1, 1], opacity: [1, 0.7, 1] } 
            : (isRecording ? { scale: [1, 1.15, 1], opacity: [1, 0.8, 1] } : { scale: 1, opacity: 1 })
        }
        transition={
            isProcessing
            ? { repeat: Infinity, duration: 0.8, ease: "easeInOut" } // Fast pulse
            : (isRecording ? { repeat: Infinity, duration: 1.5, ease: "easeInOut" } : {})
        }
        className="absolute inset-0 rounded-full transition-colors duration-500"
        style={{ backgroundColor: colors.outer }}
      />
      
      {/* 2nd Circle - 81% */}
      <motion.div 
        animate={
            isProcessing
            ? { scale: [0.95, 1.05, 0.95] } // Tighter movement
            : (isRecording ? { scale: [1, 1.1, 1] } : { scale: 1 })
        }
        transition={
            isProcessing
            ? { repeat: Infinity, duration: 0.8, delay: 0.1, ease: "easeInOut" }
            : (isRecording ? { repeat: Infinity, duration: 1.5, delay: 0.1, ease: "easeInOut" } : {})
        }
        className="absolute rounded-full transition-colors duration-500"
        style={{ width: '81%', height: '81%', backgroundColor: colors.ring2 }} 
      />

      {/* 3rd Circle - 60% */}
      <motion.div 
        animate={
            isProcessing
            ? { scale: [0.9, 1.1, 0.9] }
            : (isRecording ? { scale: [1, 1.05, 1] } : { scale: 1 })
        }
        transition={
            isProcessing
            ? { repeat: Infinity, duration: 0.8, delay: 0.2, ease: "easeInOut" }
            : (isRecording ? { repeat: Infinity, duration: 1.5, delay: 0.2, ease: "easeInOut" } : {})
        }
        className="absolute rounded-full transition-colors duration-500"
        style={{ width: '60%', height: '60%', backgroundColor: colors.ring3 }}
      />

      {/* 4th Circle - 42% */}
      <motion.div 
         animate={
            isProcessing
            ? { scale: [0.85, 1.15, 0.85] } // Most active inner ring for processing
            : { scale: 1 }
         }
         transition={
            isProcessing
            ? { repeat: Infinity, duration: 0.8, delay: 0.3, ease: "easeInOut" }
            : {}
         }
        className="absolute rounded-full transition-colors duration-500"
        style={{ width: '42%', height: '42%', backgroundColor: colors.ring4 }}
      />

      {/* Inner Circle White - 22% */}
      <motion.div 
        animate={
            isProcessing 
            ? { scale: [1, 0.6, 1] } // "Pumping" heart effect when processing
            : { scale: 1 }
        }
        transition={
            isProcessing 
            ? { repeat: Infinity, duration: 0.8, ease: "easeInOut" }
            : {}
        }
        className="absolute rounded-full bg-white flex items-center justify-center shadow-sm"
        style={{ width: '22%', height: '22%' }}
      />
    </button>
  );
};
