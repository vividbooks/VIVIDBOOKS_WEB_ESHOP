import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mic, Zap, CheckSquare, ChevronRight } from 'lucide-react';
import clsx from 'clsx';

interface OnboardingProps {
  onComplete: () => void;
}

const slides = [
  {
    id: 1,
    title: "Chytré diktování",
    desc: "Nahrávejte své myšlenky a nechte je automaticky přepsat do textu.",
    icon: <Mic size={48} className="text-white" />,
    color: "bg-[#0A84FF]"
  },
  {
    id: 2,
    title: "Vlastní zkratky",
    desc: "Nastavte si hlasové zkratky. Řekněte 'podpis' a vloží se celý váš patičkový text.",
    icon: <Zap size={48} className="text-white" />,
    color: "bg-[#FFD60A]"
  },
  {
    id: 3,
    title: "Rychlý úkolníček",
    desc: "Mluvte nebo pište. Vaše úkoly budou vždy po ruce a snadno spravovatelné.",
    icon: <CheckSquare size={48} className="text-white" />,
    color: "bg-[#30D158]"
  }
];

export const Onboarding: React.FC<OnboardingProps> = ({ onComplete }) => {
  const [currentSlide, setCurrentSlide] = useState(0);

  const handleNext = () => {
    if (currentSlide < slides.length - 1) {
      setCurrentSlide(prev => prev + 1);
    } else {
      onComplete();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center relative overflow-hidden">
        <AnimatePresence mode='wait'>
          <motion.div
            key={currentSlide}
            initial={{ opacity: 0, x: 100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -100 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col items-center gap-8 w-full max-w-sm"
          >
            <div className={clsx(
              "w-32 h-32 rounded-3xl flex items-center justify-center shadow-2xl mb-4",
              slides[currentSlide].color,
              "shadow-[0_0_40px_-10px_rgba(255,255,255,0.1)]"
            )}>
              {slides[currentSlide].icon}
            </div>
            
            <div className="space-y-4">
              <h2 className="text-3xl font-bold text-white tracking-tight">
                {slides[currentSlide].title}
              </h2>
              <p className="text-[#8E8E93] text-lg leading-relaxed">
                {slides[currentSlide].desc}
              </p>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="p-8 pb-12 flex flex-col gap-8">
        {/* Indicators */}
        <div className="flex justify-center gap-2">
          {slides.map((_, idx) => (
            <div 
              key={idx}
              className={clsx(
                "h-2 rounded-full transition-all duration-300",
                currentSlide === idx ? "w-8 bg-[#0A84FF]" : "w-2 bg-[#3A3A3C]"
              )}
            />
          ))}
        </div>

        <button
          onClick={handleNext}
          className="w-full h-14 bg-[#0A84FF] text-white text-[17px] font-bold rounded-2xl shadow-lg shadow-blue-500/20 hover:bg-[#007AFF] transition-all flex items-center justify-center gap-2 active:scale-95"
        >
          {currentSlide === slides.length - 1 ? "Začít" : "Pokračovat"}
          {currentSlide < slides.length - 1 && <ChevronRight size={20} />}
        </button>
      </div>
    </div>
  );
};
