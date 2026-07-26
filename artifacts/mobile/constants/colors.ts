/**
 * SQL Studio Pro – Design Tokens
 * Dark theme: deep GitHub-inspired obsidian.
 * Light theme: clean, high-contrast slate.
 *
 * Design philosophy:
 *   - VS Code / TablePlus / Linear quality
 *   - 3 surface levels (background → card → elevated)
 *   - Full semantic color palette
 *   - Consistent spacing & typography scales
 */

const colors = {
  light: {
    // Core backgrounds
    background: '#F8FAFC',
    backgroundSecondary: '#F1F5F9',
    foreground: '#0F172A',
    text: '#0F172A',

    // Surface levels
    card: '#FFFFFF',
    cardForeground: '#0F172A',
    elevated: '#FFFFFF',
    elevatedForeground: '#0F172A',

    // Interactive surfaces
    muted: '#F1F5F9',
    mutedForeground: '#64748B',
    secondary: '#E2E8F0',
    secondaryForeground: '#334155',

    // Brand
    primary: '#2563EB',
    primaryForeground: '#FFFFFF',
    primaryHover: '#1D4ED8',
    primarySubtle: '#EFF6FF',
    tint: '#2563EB',

    // Semantic
    accent: '#059669',
    accentForeground: '#FFFFFF',
    accentSubtle: '#ECFDF5',
    warning: '#D97706',
    warningForeground: '#FFFFFF',
    warningSubtle: '#FFFBEB',
    destructive: '#DC2626',
    destructiveForeground: '#FFFFFF',
    destructiveSubtle: '#FEF2F2',
    info: '#0284C7',
    infoForeground: '#FFFFFF',
    infoSubtle: '#F0F9FF',

    // Borders & separators
    border: '#E2E8F0',
    borderSubtle: '#F1F5F9',
    input: '#F1F5F9',
    inputBorder: '#CBD5E1',

    // SQL syntax (light)
    sqlKeyword: '#1D4ED8',
    sqlString: '#B45309',
    sqlComment: '#6B7280',
    sqlNumber: '#047857',
    sqlFunction: '#7C3AED',
    sqlOperator: '#BE123C',
    sqlType: '#0369A1',
    sqlPunctuation: '#475569',

    // Editor
    editorBg: '#1E2030',
    editorText: '#CDD6F4',
    editorLineNumber: '#454560',
    editorCaret: '#89B4FA',
    editorSelection: '#2D3748',
    editorCurrentLine: '#1C1E2A',
    editorGutter: '#1A1C2B',

    // Overlay
    overlay: 'rgba(0,0,0,0.5)',
    overlayLight: 'rgba(0,0,0,0.05)',
  },

  dark: {
    // Core backgrounds
    background: '#090D12',
    backgroundSecondary: '#0D1117',
    foreground: '#E6EDF3',
    text: '#E6EDF3',

    // Surface levels
    card: '#0D1117',
    cardForeground: '#E6EDF3',
    elevated: '#161B22',
    elevatedForeground: '#E6EDF3',

    // Interactive surfaces
    muted: '#111820',
    mutedForeground: '#7D8590',
    secondary: '#161B22',
    secondaryForeground: '#C9D1D9',

    // Brand
    primary: '#58A6FF',
    primaryForeground: '#090D12',
    primaryHover: '#79BAFF',
    primarySubtle: '#0D1F3C',
    tint: '#58A6FF',

    // Semantic
    accent: '#3FB950',
    accentForeground: '#090D12',
    accentSubtle: '#0A2018',
    warning: '#F0A000',
    warningForeground: '#090D12',
    warningSubtle: '#1E1500',
    destructive: '#F85149',
    destructiveForeground: '#FFFFFF',
    destructiveSubtle: '#1E0D0C',
    info: '#58A6FF',
    infoForeground: '#090D12',
    infoSubtle: '#0D1F3C',

    // Borders & separators
    border: '#21262D',
    borderSubtle: '#161B22',
    input: '#111820',
    inputBorder: '#30363D',

    // SQL syntax (dark)
    sqlKeyword: '#79C0FF',
    sqlString: '#A5D6FF',
    sqlComment: '#7D8590',
    sqlNumber: '#56D364',
    sqlFunction: '#D2A8FF',
    sqlOperator: '#FF7B72',
    sqlType: '#79C0FF',
    sqlPunctuation: '#8B949E',

    // Editor
    editorBg: '#090D12',
    editorText: '#E6EDF3',
    editorLineNumber: '#3D444D',
    editorCaret: '#58A6FF',
    editorSelection: '#1F3A5F',
    editorCurrentLine: '#0D1117',
    editorGutter: '#0D1117',

    // Overlay
    overlay: 'rgba(0,0,0,0.7)',
    overlayLight: 'rgba(255,255,255,0.04)',
  },

  // Backward-compat: single radius value (10px = medium)
  radius: 10,

  // Structured radius scale
  radii: {
    xs: 4,
    sm: 6,
    md: 10,
    lg: 14,
    xl: 18,
    xxl: 24,
    full: 999,
  },

  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 28,
  },

  // Database accent palette (cycled for new databases)
  dbPalette: [
    '#58A6FF', '#3FB950', '#F85149', '#D2A8FF',
    '#FFA657', '#79C0FF', '#56D364', '#E3B341',
    '#FF7B72', '#A5D6FF',
  ],
};

export default colors;
