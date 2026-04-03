"use client"

import React from "react";

const colorMap = {
  blue: "rgb(13, 110, 253)",
  indigo: "rgb(102, 16, 242)",
  purple: "rgb(111, 66, 193)",
  pink: "rgb(214, 51, 132)",
  red: "rgb(220, 53, 69)",
  orange: "rgb(253, 126, 20)",
  yellow: "rgb(255, 193, 7)",
  green: "rgb(25, 135, 84)",
  teal: "rgb(32, 201, 151)",
  cyan: "rgb(13, 202, 240)",
  white: "rgb(255, 255, 255)",
  gray: "rgb(108, 117, 125)",
  "gray-dark": "rgb(73, 80, 87)",
  primary: "rgb(18, 102, 241)",
  secondary: "rgb(178, 60, 253)",
  success: "rgb(0, 183, 74)",
  info: "rgb(57, 192, 237)",
  warning: "rgb(255, 169, 0)",
  danger: "rgb(249, 49, 84)",
  light: "rgb(249, 249, 249)",
  dark: "rgb(38, 38, 38)",
  black: "rgb(0, 0, 0)",
};

const getSize = (size: string) => {
  switch (size) {
    case "sm":
      return "1rem";
    case "md":
      return "2rem";
    case "lg":
      return "3rem";
    case "xl":
      return "4rem";
    default:
      return "2rem";
  }
};

interface SpinnerProps {
  size?: string;
  color?: string;
  multiColor?: boolean;
  className?: string;
}

/**
 *
 * @param {Object} props - React props object
 *
 * Can pass the following optional props:
 * size - "sm" | "md" | "lg" | "xl" - default "md"
 * color - String, any mdb css global color variable - default "#fff"
 * multiColor - Boolean. If true, the spinner will change colors every spin.
 *
 * @returns A loading spinner
 */
const Spinner = ({
  size = "md",
  color,
  multiColor,
  className,
}: SpinnerProps) => {

  if (!color) color = "light";

  return (
    <svg
      className={`${className || ""}`}
      width={getSize(size)}
      height={getSize(size)}
      viewBox="0 0 66 66"
      xmlns="http://www.w3.org/2000/svg"
    >
      <g>
        <animateTransform
          attributeName="transform"
          type="rotate"
          values="0 33 33;270 33 33"
          begin="0s"
          dur="1.4s"
          fill="freeze"
          repeatCount="indefinite"
        />
        <circle
          fill="none"
          strokeWidth="6"
          strokeLinecap="round"
          cx="33"
          cy="33"
          r="30"
          strokeDasharray="187"
          strokeDashoffset="610"
        >
          <animate
            attributeName="stroke"
            values={
              multiColor
                ? "#4285F4;#DE3E35;#F7C223;#1B9A59;#4285F4"
                : color
                  ? colorMap[color as keyof typeof colorMap]
                  : "#fff"
            }
            begin="0s"
            dur="5.6s"
            fill="freeze"
            repeatCount="indefinite"
          />
          <animateTransform
            attributeName="transform"
            type="rotate"
            values="0 33 33;135 33 33;450 33 33"
            begin="0s"
            dur="1.4s"
            fill="freeze"
            repeatCount="indefinite"
          />
          <animate
            attributeName="stroke-dashoffset"
            values="187;46.75;187"
            begin="0s"
            dur="1.4s"
            fill="freeze"
            repeatCount="indefinite"
          />
        </circle>
      </g>
    </svg>
  );
}

export default Spinner;
