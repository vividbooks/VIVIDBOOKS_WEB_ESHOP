import React from 'react';
import { MessageSquare } from 'lucide-react';
import clsx from 'clsx';
import { motion } from 'motion/react';

const GREEN = {
  outer: '#15803D',
  ring2: '#22C55E',
  ring3: '#6EE7B7',
  ring4: '#D1FAE5',
} as const;

export type AgentOrbAvatarSize = 'sm' | 'md' | 'lg' | 'sidebar';

const SIZE: Record<
  AgentOrbAvatarSize,
  { box: string; icon: number }
> = {
  sm: { box: 'w-8 h-8', icon: 14 },
  md: { box: 'w-10 h-10', icon: 18 },
  lg: { box: 'w-16 h-16', icon: 30 },
  sidebar: { box: 'w-12 h-12', icon: 20 },
};

/** Zelené soustředné kruhy + bublina — stejný vizuál jako aktivní Obchodník v levém menu. */
export const AgentOrbAvatar: React.FC<{
  size?: AgentOrbAvatarSize;
  className?: string;
  onClick?: () => void;
  title?: string;
}> = ({ size = 'md', className, onClick, title }) => {
  const { box, icon } = SIZE[size];
  const inner = (
    <>
      <motion.div
        animate={{ scale: [1, 1.1, 1], opacity: [1, 0.72, 1] }}
        transition={{ repeat: Infinity, duration: 0.85, ease: 'easeInOut' }}
        className="absolute inset-0 rounded-full transition-colors duration-500"
        style={{ backgroundColor: GREEN.outer }}
      />
      <motion.div
        animate={{ scale: [0.95, 1.06, 0.95] }}
        transition={{ repeat: Infinity, duration: 0.85, delay: 0.08, ease: 'easeInOut' }}
        className="absolute rounded-full transition-colors duration-500"
        style={{ width: '81%', height: '81%', backgroundColor: GREEN.ring2 }}
      />
      <motion.div
        animate={{ scale: [0.9, 1.08, 0.9] }}
        transition={{ repeat: Infinity, duration: 0.85, delay: 0.16, ease: 'easeInOut' }}
        className="absolute rounded-full transition-colors duration-500"
        style={{ width: '60%', height: '60%', backgroundColor: GREEN.ring3 }}
      />
      <motion.div
        animate={{ scale: [0.85, 1.12, 0.85] }}
        transition={{ repeat: Infinity, duration: 0.85, delay: 0.24, ease: 'easeInOut' }}
        className="absolute rounded-full transition-colors duration-500"
        style={{ width: '42%', height: '42%', backgroundColor: GREEN.ring4 }}
      />
      <motion.div
        animate={{ scale: [1, 0.92, 1] }}
        transition={{ repeat: Infinity, duration: 0.85, ease: 'easeInOut' }}
        className="absolute rounded-full bg-gradient-to-br from-emerald-600 to-green-700 flex items-center justify-center shadow-md shadow-black/25"
        style={{ width: '56%', height: '56%' }}
      >
        <MessageSquare size={icon} className="text-white" strokeWidth={2} />
      </motion.div>
    </>
  );

  const shell = clsx(
    'relative flex items-center justify-center shrink-0 aspect-square focus:outline-none',
    box,
    className,
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} title={title} className={clsx(shell, 'cursor-pointer')}>
        {inner}
      </button>
    );
  }

  return (
    <div className={shell} title={title} aria-hidden={title ? undefined : true}>
      {inner}
    </div>
  );
};
