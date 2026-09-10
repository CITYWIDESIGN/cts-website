"use client";

import * as React from "react";
import {
  animate,
  motion,
  useInView,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "motion/react";

interface CountUpProps {
  value: number;
  duration?: number;
  className?: string;
  suffix?: string;
}

/** 数字滚动动画：进入视口时从 0 递增到目标值 */
export function CountUp({
  value,
  duration = 1.4,
  className,
  suffix = "",
}: CountUpProps) {
  const ref = React.useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  const reduce = useReducedMotion();

  const mv = useMotionValue(0);
  const display = useTransform(mv, (v) =>
    `${Math.round(v).toLocaleString()}${suffix}`
  );

  React.useEffect(() => {
    if (reduce) {
      mv.set(value);
      return;
    }
    if (!inView) return;

    const controls = animate(mv, value, {
      duration,
      ease: [0.21, 0.47, 0.32, 0.98],
    });

    return () => controls.stop();
  }, [inView, value, duration, reduce, mv]);

  return (
    <motion.span ref={ref} className={className}>
      {display}
    </motion.span>
  );
}
