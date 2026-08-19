// Ikram System Centralized Design System Tokens
export const tokens = {
  colors: {
    primary: {
      DEFAULT: '#C9A24B', // Ikram Gold/Honey
      hover: '#B08D3E',
      light: '#F5EDDA',
      dark: '#8C6C26',
    },
    secondary: {
      DEFAULT: '#3F6B3A', // Ikram Leaf Green
      hover: '#31542D',
      light: '#EBF4EA',
      dark: '#223B1E',
    },
    background: {
      DEFAULT: '#F7F5F0', // Soft Beige
      card: '#FFFFFF',
      accent: '#F4EFE3', // Faint leaf pattern watermark tint
    },
    text: {
      primary: '#1A1A1A',
      secondary: '#5C5C5C',
      muted: '#8A8A8A',
    },
    status: {
      success: '#2E7D32',
      successBg: '#E8F5E9',
      error: '#D32F2F',
      errorBg: '#FFEBEE',
      warning: '#ED6C02',
      warningBg: '#FFF3E0',
      info: '#0288D1',
      infoBg: '#E0F7FA',
    },
  },
  fonts: {
    family: "'IBM Plex Sans Arabic', 'Cairo', 'Tajawal', sans-serif",
  },
  roles: {
    supervisor: {
      badgeBg: 'bg-amber-100 text-amber-900 border-amber-300',
      title: 'مدير النظام (Supervisor)',
    },
    assistant_supervisor: {
      badgeBg: 'bg-green-100 text-green-900 border-green-300',
      title: 'مساعد المدير (Assistant Supervisor)',
    },
    driver: {
      badgeBg: 'bg-blue-100 text-blue-900 border-blue-300',
      title: 'السائق (Driver)',
    },
  },
};
