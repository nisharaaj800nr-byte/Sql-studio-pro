/**
 * SQL Studio Pro – Design Tokens
 * Dark-first IDE aesthetic inspired by VS Code & GitHub Dark.
 * Both light and dark themes provided; useColors() auto-selects.
 */
const colors = {
  light: {
    text: '#1F2937',
    tint: '#2563EB',
    background: '#F8FAFC',
    foreground: '#111827',
    card: '#FFFFFF',
    cardForeground: '#111827',
    primary: '#2563EB',
    primaryForeground: '#FFFFFF',
    secondary: '#E5E7EB',
    secondaryForeground: '#374151',
    muted: '#F3F4F6',
    mutedForeground: '#6B7280',
    accent: '#059669',
    accentForeground: '#FFFFFF',
    destructive: '#DC2626',
    destructiveForeground: '#FFFFFF',
    border: '#E5E7EB',
    input: '#F3F4F6',
    // SQL syntax colors (light)
    sqlKeyword: '#1D4ED8',
    sqlString: '#B45309',
    sqlComment: '#6B7280',
    sqlNumber: '#047857',
    sqlFunction: '#7C3AED',
    sqlOperator: '#BE123C',
    // Editor-specific
    editorBg: '#1E1E2E',
    editorText: '#CDD6F4',
    editorLineNumber: '#585B70',
    editorCaret: '#F5C2E7',
    editorSelection: '#313244',
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
    muted: '#21262D',
    mutedForeground: '#8B949E',
    accent: '#3FB950',
    accentForeground: '#0D1117',
    destructive: '#F85149',
    destructiveForeground: '#FFFFFF',
    border: '#30363D',
    input: '#21262D',
    // SQL syntax colors (dark)
    sqlKeyword: '#79C0FF',
    sqlString: '#A5D6FF',
    sqlComment: '#8B949E',
    sqlNumber: '#56D364',
    sqlFunction: '#D2A8FF',
    sqlOperator: '#FF7B72',
    // Editor-specific
    editorBg: '#0D1117',
    editorText: '#E6EDF3',
    editorLineNumber: '#484F58',
    editorCaret: '#58A6FF',
    editorSelection: '#264F78',
  },
  radius: 10,
};

export default colors;
