"use client";

import * as React from "react";

interface Ripple {
  id: number;
  x: number;
  y: number;
}

export function useBouncyInteraction({
  disabled = false,
  noRipple = false,
}: {
  disabled?: boolean;
  noRipple?: boolean;
}) {
  const [ripples, setRipples] = React.useState<Ripple[]>([]);
  const [pressing, setPressing] = React.useState(false);

  const applyFromEvent = React.useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      if (disabled) return;
      setPressing(true);
      const el = e.currentTarget;
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const rippleId = Date.now();
      if (!noRipple) {
        setRipples((prev) => [...prev, { id: rippleId, x, y }]);
        setTimeout(() => {
          setRipples((prev) => prev.filter((r) => r.id !== rippleId));
        }, 600);
      }
      setTimeout(() => setPressing(false), 150);
    },
    [disabled, noRipple],
  );

  const rippleLayer =
    noRipple ? null : (
      <>
        {ripples.map((ripple) => (
          <span
            key={ripple.id}
            className="ripple"
            style={{ left: ripple.x, top: ripple.y }}
          />
        ))}
      </>
    );

  return { applyFromEvent, pressing, rippleLayer };
}

interface BouncyClickProps extends React.ComponentPropsWithoutRef<"div"> {
  noRipple?: boolean;
  disabled?: boolean;
}

export default function BouncyClick({
  children,
  className,
  noRipple,
  disabled,
  onClick,
  ...props
}: BouncyClickProps) {
  const { applyFromEvent, pressing, rippleLayer } = useBouncyInteraction({
    disabled,
    noRipple,
  });

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (disabled) return;
    applyFromEvent(e);
    onClick?.(e);
  };

  return (
    <div
      className={`relative overflow-hidden duration-200 transition-all ${!disabled ? "cursor-pointer" : ""
        } ${pressing ? "scale-95" : ""} ${className ?? ""}`}
      onClick={handleClick}
      {...props}
    >
      {children}
      {rippleLayer}
    </div>
  );
}
