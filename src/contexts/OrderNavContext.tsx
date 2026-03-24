import { createContext, useCallback, useContext, useRef, useState } from 'react';

export type OrderFlowStep = 1 | 2 | 3 | 4 | 5 | 6;

type StepGuard = () => boolean;

interface OrderNavContextValue {
  step: OrderFlowStep;
  setStep: (s: OrderFlowStep) => void;
  upsellDismissed: boolean;
  setUpsellDismissed: (v: boolean) => void;
  submitting: boolean;
  setSubmitting: (v: boolean) => void;
  registerStep1Guard: (fn: StepGuard | null) => void;
  tryAdvanceFromStep1: () => boolean;
}

const OrderNavContext = createContext<OrderNavContextValue>({
  step: 1,
  setStep: () => {},
  upsellDismissed: false,
  setUpsellDismissed: () => {},
  submitting: false,
  setSubmitting: () => {},
  registerStep1Guard: () => {},
  tryAdvanceFromStep1: () => true,
});

export function OrderNavProvider({ children }: { children: React.ReactNode }) {
  const [step, setStep] = useState<OrderFlowStep>(1);
  const [upsellDismissed, setUpsellDismissed] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const step1GuardRef = useRef<StepGuard | null>(null);

  const registerStep1Guard = useCallback((fn: StepGuard | null) => {
    step1GuardRef.current = fn;
  }, []);

  const tryAdvanceFromStep1 = useCallback(() => {
    if (!step1GuardRef.current) return true;
    return step1GuardRef.current();
  }, []);

  return (
    <OrderNavContext.Provider
      value={{
        step,
        setStep,
        upsellDismissed,
        setUpsellDismissed,
        submitting,
        setSubmitting,
        registerStep1Guard,
        tryAdvanceFromStep1,
      }}
    >
      {children}
    </OrderNavContext.Provider>
  );
}

export function useOrderNav() {
  return useContext(OrderNavContext);
}
