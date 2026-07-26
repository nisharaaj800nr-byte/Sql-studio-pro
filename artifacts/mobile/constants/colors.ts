/**
 * SQL Studio Pro – Design Tokens
 * Professional dark-first IDE aesthetic.
 * Light theme is clean & minimal. Dark theme is GitHub Dark-inspired.
 */
const colors = {
  light: {
    text: '#0F172A',
    tint: '#2563EB',
    background: '#F1F5F9',
    foreground: '#0F172A',
    card: '#FFFFFF',
    cardForeground: '#0F172A',
    primary: '#2563EB',
    primaryForeground: '#FFFFFF',
    secondary: '#E2E8F0',
    secondaryForeground: '#334155',
    muted: '#F1F5F9',
    mutedForeground: '#64748B',
    accent: '#059669',
    accentForeground: '#FFFFFF',
    destructive: '#DC2626',
    destructiveForeground: '#FFFFFF',
    border: '#E2E8F0',
    input: '#F1F5F9',
    // SQL syntax colors (light)
    sqlKeyword: '#1D4ED8',
    sqlString: '#B45309',
    sqlComment: '#6B7280',
    sqlNumber: '#047857',
    sqlFunction: '#7C3AED',
    sqlOperator: '#BE123C',
    // Editor-specific
    editorBg: '#1E2030',
    editorText: '#CDD6F4',
    editorLineNumber: '#454560',
    editorCaret: '#89B4FA',
    editorSelection: '#2D3748',
  },
  dark: {
    text: '#E6EDF3',
    tint: '#58A6FF',
    background: '#0D1117',
    foreground: '#E6EDF3',
    card: '#161B22',
    cardForeground: '#E6EDF3',
    primary: '#58A6FF',
    primaryForeground: '#0D1117',
    secondary: '#21262D',
    secondaryForeground: '#C9D1D9',
    muted: '#1C2128',
    mutedForeground: '#7D8590',
    accent: '#3FB950',
    accentForeground: '#0D1117',
    destructive: '#F85149',
    destructiveForeground: '#FFFFFF',
    border: '#30363D',
    input: '#1C2128',
    // SQL syntax colors (dark)
    sqlKeyword: '#79C0FF',
    sqlString: '#A5D6FF',
    sqlComment: '#7D8590',
    sqlNumber: '#56D364',
    sqlFunction: '#D2A8FF',
    sqlOperator: '#FF7B72',
    // Editor-specific
    editorBg: '#0D1117',
    editorText: '#E6EDF3',
    editorLineNumber: '#3D444D',
    editorCaret: '#58A6FF',
    editorSelection: '#1F3A5F',
  },
  radius: 10,
};

export default colors;
