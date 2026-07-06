"use client";
import { useRef } from "react";
import {
  motion,
  useAnimationFrame,
  useMotionTemplate,
  useMotionValue,
  useTransform,
} from "motion/react";
import { cn } from "@/lib/utils";

/** Aceternity UI — Moving Border button. A gradient dot orbits the border. */
export function MovingBorderButton({
  children,
  duration = 3000,
  className,
  containerClassName,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  duration?: number;
  className?: string;
  containerClassName?: string;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "relative h-14 overflow-hidden rounded-[var(--radius-xl)] p-[1.5px] disabled:opacity-50 disabled:pointer-events-none",
        containerClassName,
      )}
    >
      <div className="absolute inset-0">
        <MovingBorder duration={duration} rx="30%" ry="30%">
          <div className="size-24 bg-[radial-gradient(var(--color-teal-400)_40%,transparent_60%)] opacity-90" />
        </MovingBorder>
      </div>
      <div
        className={cn(
          "relative flex h-full w-full items-center justify-center gap-2 rounded-[calc(var(--radius-xl)-1.5px)] border border-hairline bg-panel-2/90 px-7 text-base font-medium text-fg backdrop-blur-xl",
          className,
        )}
      >
        {children}
      </div>
    </button>
  );
}

function MovingBorder({
  children,
  duration = 3000,
  rx,
  ry,
}: {
  children: React.ReactNode;
  duration?: number;
  rx?: string;
  ry?: string;
}) {
  const pathRef = useRef<SVGRectElement>(null);
  const progress = useMotionValue<number>(0);

  useAnimationFrame((time) => {
    const length = pathRef.current?.getTotalLength();
    if (length) {
      const pxPerMs = length / duration;
      progress.set((time * pxPerMs) % length);
    }
  });

  const x = useTransform(progress, (val) => pathRef.current?.getPointAtLength(val).x ?? 0);
  const y = useTransform(progress, (val) => pathRef.current?.getPointAtLength(val).y ?? 0);
  const transform = useMotionTemplate`translateX(${x}px) translateY(${y}px) translateX(-50%) translateY(-50%)`;

  return (
    <>
      <svg
        className="absolute h-full w-full"
        width="100%"
        height="100%"
        preserveAspectRatio="none"
      >
        <rect fill="none" width="100%" height="100%" rx={rx} ry={ry} ref={pathRef} />
      </svg>
      <motion.div className="absolute inline-block" style={{ transform }}>
        {children}
      </motion.div>
    </>
  );
}
