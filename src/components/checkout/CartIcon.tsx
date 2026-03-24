import React from 'react';
import { motion } from 'motion/react';
import { ShoppingCart } from 'lucide-react';
import { useCart } from '../../contexts/CartContext';

export function CartIcon({ className = '' }: { className?: string }) {
  const { toggleCart, itemCount } = useCart();

  return (
    <button
      onClick={toggleCart}
      aria-label="Otevřít košík"
      className={`relative flex items-center justify-center w-10 h-10 rounded-xl text-[#001161] hover:bg-[#f1f3f8] transition-all cursor-pointer active:scale-90 ${className}`}
    >
      <ShoppingCart className="w-5 h-5" />
      {itemCount > 0 && (
        <motion.span
          key={itemCount}
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#ff6a35] text-white font-['Fenomen_Sans',sans-serif] text-[10px] font-bold flex items-center justify-center leading-none"
        >
          {itemCount > 99 ? '99+' : itemCount}
        </motion.span>
      )}
    </button>
  );
}
