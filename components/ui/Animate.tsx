"use client";

// ─── FutureTwin Animation System ──────────────────────────────────────────────
// Mac-inspired spring physics, stagger reveals, and page transitions.
// All powered by Framer Motion. Import these wrappers instead of raw motion divs.

import { motion, type Variants, type HTMLMotionProps } from "framer-motion";
import { type ReactNode } from "react";

// ─── Shared Variants ──────────────────────────────────────────────────────────

export const pageVariants: Variants = {
  hidden: { opacity: 0, y: 16, filter: "blur(4px)" },
  visible: {
    opacity: 1, y: 0, filter: "blur(0px)",
    transition: { duration: 0.45, ease: [0.25, 0.46, 0.45, 0.94] }
  },
  exit: {
    opacity: 0, y: -8, filter: "blur(2px)",
    transition: { duration: 0.25, ease: [0.55, 0, 1, 0.45] }
  }
};

export const staggerContainer: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.07, delayChildren: 0.05 }
  }
};

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1, y: 0,
    transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }
  }
};

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.4 } }
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.94 },
  visible: {
    opacity: 1, scale: 1,
    transition: { type: "spring", stiffness: 300, damping: 24 }
  }
};

export const slideRight: Variants = {
  hidden: { opacity: 0, x: -20 },
  visible: {
    opacity: 1, x: 0,
    transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }
  }
};

// ─── Wrapper Components ────────────────────────────────────────────────────────

type Props = {
  children: ReactNode;
  className?: string;
  delay?: number;
};

/** Full page wrapper with enter/exit animation */
export function PageMotion({ children, className = "" }: Props) {
  return (
    <motion.div
      variants={pageVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      className={className}
    >
      {children}
    </motion.div>
  );
}

/** Stagger container — children animate in sequence */
export function StaggerGroup({ children, className = "", delay = 0 }: Props) {
  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
      className={className}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </motion.div>
  );
}

/** Fade up child — use inside StaggerGroup */
export function FadeUp({ children, className = "" }: Props) {
  return (
    <motion.div variants={fadeUp} className={className}>
      {children}
    </motion.div>
  );
}

/** Scale in child — for cards */
export function ScaleIn({ children, className = "" }: Props) {
  return (
    <motion.div variants={scaleIn} className={className}>
      {children}
    </motion.div>
  );
}

/** Glass card with hover physics */
export function GlassCard({
  children,
  className = "",
  onClick
}: Props & { onClick?: () => void }) {
  return (
    <motion.div
      whileHover={{ scale: 1.015, y: -3 }}
      whileTap={{ scale: 0.985 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      onClick={onClick}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/** Mac-style button press */
export function PressButton({
  children,
  className = "",
  onClick,
  disabled,
  type = "button",
  ...rest
}: Props & HTMLMotionProps<"button"> & { disabled?: boolean; type?: "button" | "submit" }) {
  return (
    <motion.button
      whileHover={disabled ? {} : { scale: 1.02, y: -1 }}
      whileTap={disabled ? {} : { scale: 0.96, y: 1 }}
      transition={{ type: "spring", stiffness: 500, damping: 28 }}
      onClick={onClick}
      disabled={disabled}
      type={type}
      className={className}
      {...rest}
    >
      {children}
    </motion.button>
  );
}

/** Number counter animation */
export function AnimatedNumber({
  value,
  className = "",
  suffix = ""
}: {
  value: number;
  className?: string;
  suffix?: string;
}) {
  return (
    <motion.span
      key={value}
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      className={className}
    >
      {value}{suffix}
    </motion.span>
  );
}

/** Shimmer loading skeleton */
export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <motion.div
      animate={{ opacity: [0.4, 0.8, 0.4] }}
      transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
      className={`rounded-lg bg-white/5 ${className}`}
    />
  );
}
