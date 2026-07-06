"use client";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

/** Aceternity UI — Background Gradient (animated glowing border wrapper). */
export function BackgroundGradient({
  children,
  className,
  containerClassName,
  animate = true,
}: {
  children: React.ReactNode;
  className?: string;
  containerClassName?: string;
  animate?: boolean;
}) {
  const variants = {
    initial: { backgroundPosition: "0 50%" },
    animate: { backgroundPosition: ["0 50%", "100% 50%", "0 50%"] },
  };
  const gradient =
    "radial-gradient(circle farthest-side at 0 100%,#6366f1,transparent),radial-gradient(circle farthest-side at 100% 0,#22d3ee,transparent),radial-gradient(circle farthest-side at 100% 100%,#7c6bf5,transparent),radial-gradient(circle farthest-side at 0 0,#06b6d4,#0d0d16)";

  return (
    <div className={cn("group relative p-[2px]", containerClassName)}>
      <motion.div
        variants={animate ? variants : undefined}
        initial={animate ? "initial" : undefined}
        animate={animate ? "animate" : undefined}
        transition={animate ? { duration: 6, repeat: Infinity, repeatType: "reverse" } : undefined}
        style={{ backgroundSize: animate ? "300% 300%" : undefined, backgroundImage: gradient }}
        className="absolute inset-0 z-[1] rounded-[var(--radius-xl)] opacity-50 blur-lg transition duration-500 will-change-transform group-hover:opacity-80"
      />
      <motion.div
        variants={animate ? variants : undefined}
        initial={animate ? "initial" : undefined}
        animate={animate ? "animate" : undefined}
        transition={animate ? { duration: 6, repeat: Infinity, repeatType: "reverse" } : undefined}
        style={{ backgroundSize: animate ? "300% 300%" : undefined, backgroundImage: gradient }}
        className="absolute inset-0 z-[1] rounded-[var(--radius-xl)] will-change-transform"
      />
      <div className={cn("relative z-10 rounded-[calc(var(--radius-xl)-2px)]", className)}>
        {children}
      </div>
    </div>
  );
}
