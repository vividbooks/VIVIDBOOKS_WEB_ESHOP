import React from 'react';
import { motion } from 'motion/react';
import clsx from 'clsx';

interface RecordButtonProps {
  isRecording: boolean;
  isProcessing?: boolean;
  onClick: () => void;
  className?: string;
}

const REC_PULSE = { repeat: Infinity as const, duration: 0.85, ease: 'easeInOut' as const };

export const RecordButton: React.FC<RecordButtonProps> = ({ isRecording, isProcessing = false, onClick, className }) => {
  // Define color palettes
  const colors = isProcessing
    ? {
        outer: '#0A84FF',
        ring2: '#5AC8FA',
        ring3: '#B6E4FF',
        ring4: '#E5F6FF',
      }
    : {
        outer: '#FE5244',
        ring2: '#FF7A6E',
        ring3: '#FFB4AC',
        ring4: '#FFD4D0',
      };

  return (
    <button
      onClick={isProcessing ? undefined : onClick}
      className={clsx(
        'relative flex items-center justify-center transition-transform focus:outline-none cursor-pointer aspect-square',
        isProcessing ? 'cursor-default' : 'active:scale-95',
        className,
      )}
      title={isProcessing ? 'Zpracovávám...' : isRecording ? 'Zastavit nahrávání' : 'Spustit nahrávání'}
      disabled={isProcessing}
    >
      {/* Outer — při nahrávání stejný „živý“ rytmus jako zelený orb u agenta */}
      <motion.div
        animate={
          isProcessing
            ? { scale: [1, 1.1, 1], opacity: [1, 0.7, 1] }
            : isRecording
              ? { scale: [1, 1.12, 1], opacity: [1, 0.72, 1] }
              : { scale: 1, opacity: 1 }
        }
        transition={isProcessing ? { repeat: Infinity, duration: 0.8, ease: 'easeInOut' } : isRecording ? REC_PULSE : {}}
        className="absolute inset-0 rounded-full transition-colors duration-500"
        style={{ backgroundColor: colors.outer }}
      />

      <motion.div
        animate={
          isProcessing
            ? { scale: [0.95, 1.05, 0.95] }
            : isRecording
              ? { scale: [0.95, 1.08, 0.95] }
              : { scale: 1 }
        }
        transition={
          isProcessing
            ? { repeat: Infinity, duration: 0.8, delay: 0.1, ease: 'easeInOut' }
            : isRecording
              ? { ...REC_PULSE, delay: 0.08 }
              : {}
        }
        className="absolute rounded-full transition-colors duration-500"
        style={{ width: '81%', height: '81%', backgroundColor: colors.ring2 }}
      />

      <motion.div
        animate={
          isProcessing
            ? { scale: [0.9, 1.1, 0.9] }
            : isRecording
              ? { scale: [0.9, 1.1, 0.9] }
              : { scale: 1 }
        }
        transition={
          isProcessing
            ? { repeat: Infinity, duration: 0.8, delay: 0.2, ease: 'easeInOut' }
            : isRecording
              ? { ...REC_PULSE, delay: 0.16 }
              : {}
        }
        className="absolute rounded-full transition-colors duration-500"
        style={{ width: '60%', height: '60%', backgroundColor: colors.ring3 }}
      />

      <motion.div
        animate={
          isProcessing
            ? { scale: [0.85, 1.15, 0.85] }
            : isRecording
              ? { scale: [0.85, 1.14, 0.85] }
              : { scale: 1 }
        }
        transition={
          isProcessing
            ? { repeat: Infinity, duration: 0.8, delay: 0.3, ease: 'easeInOut' }
            : isRecording
              ? { ...REC_PULSE, delay: 0.24 }
              : {}
        }
        className="absolute rounded-full transition-colors duration-500"
        style={{ width: '42%', height: '42%', backgroundColor: colors.ring4 }}
      />

      <motion.div
        animate={
          isProcessing
            ? { scale: [1, 0.6, 1] }
            : isRecording
              ? { scale: [1, 0.88, 1] }
              : { scale: 1 }
        }
        transition={
          isProcessing
            ? { repeat: Infinity, duration: 0.8, ease: 'easeInOut' }
            : isRecording
              ? REC_PULSE
              : {}
        }
        className="absolute rounded-full bg-white flex items-center justify-center shadow-sm"
        style={{ width: '22%', height: '22%' }}
      />
    </button>
  );
};
