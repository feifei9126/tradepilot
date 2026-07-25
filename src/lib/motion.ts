export const motionTokens = {
  duration: {
    instant: 0.08,
    fast: 0.18,
    normal: 0.32,
    slow: 0.5,
  },
  easing: {
    smooth: [0.22, 1, 0.36, 1] as const,
    sharp: [0.4, 0, 0.2, 1] as const,
  },
  distance: {
    xs: 4,
    sm: 8,
    md: 16,
  },
  scale: {
    press: 0.98,
    hover: 1.01,
  },
} as const;

export const springs = {
  snappy: { type: "spring", stiffness: 300, damping: 30 } as const,
  gentle: { type: "spring", stiffness: 150, damping: 20 } as const,
  instant: { type: "spring", stiffness: 600, damping: 35 } as const,
} as const;
