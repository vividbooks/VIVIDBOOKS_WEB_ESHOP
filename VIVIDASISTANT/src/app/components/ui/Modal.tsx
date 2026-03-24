import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, actions }) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 z-[60] backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed inset-x-4 top-[20%] md:w-[400px] md:left-1/2 md:-translate-x-1/2 z-[70] bg-[#1C1C1E] rounded-2xl shadow-2xl overflow-hidden border border-white/10"
          >
            <div className="flex justify-between items-center p-4 border-b border-white/10">
              <h2 className="text-[17px] font-semibold text-white">{title}</h2>
              <button onClick={onClose} className="p-1 bg-[#2C2C2E] hover:bg-[#3A3A3C] rounded-full text-[#8E8E93] transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-4 max-h-[60vh] overflow-y-auto">
              {children}
            </div>

            {actions && (
              <div className="p-4 bg-[#2C2C2E] border-t border-white/10 flex justify-end gap-3">
                {actions}
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
