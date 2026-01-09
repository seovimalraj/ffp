export const FlowConnector = () => (
  <svg className="w-24 h-6" viewBox="0 0 120 20" aria-hidden>
    <defs>
      <linearGradient id="flowDots" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#bfdbfe" />
        <stop offset="50%" stopColor="#3b82f6" />
        <stop offset="100%" stopColor="#93c5fd" />
      </linearGradient>

      <marker
        id="arrow"
        markerWidth="6"
        markerHeight="6"
        refX="5"
        refY="3"
        orient="auto"
      >
        <path d="M0,0 L6,3 L0,6" fill="#3b82f6" />
      </marker>
    </defs>

    <line
      x1="4"
      y1="10"
      x2="116"
      y2="10"
      stroke="url(#flowDots)"
      strokeWidth="3"
      strokeLinecap="round"
      strokeDasharray="2 12"
      markerEnd="url(#arrow)"
      className="animate-flow-dots"
    />
  </svg>
);
