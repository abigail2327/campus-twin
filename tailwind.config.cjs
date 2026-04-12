export default {
  content: ['./src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        primary:   '#2563eb',   // blue — active states, buttons
        secondary: '#0f172a',   // sidebar background
        surface:   '#f8fafc',   // page background
        panel:     '#ffffff',   // card background
        border:    '#f1f5f9',   // card borders
        accent:    '#06b6d4',   // cyan — live/online indicators
        success:   '#10b981',   // green — occupied, healthy
        warn:      '#f59e0b',   // amber — warnings
        danger:    '#ef4444',   // red — alerts, emergency
        muted:     '#64748b',   // secondary text
      },
      fontFamily: {
        sans:    ['Inter', 'sans-serif'],
        heading: ['Plus Jakarta Sans', 'sans-serif'],
        mono:    ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        custom: '12px',
      },
      boxShadow: {
        card: '0 4px 20px -2px rgba(0,0,0,0.03), 0 2px 10px -2px rgba(0,0,0,0.02)',
      }
    }
  }
}