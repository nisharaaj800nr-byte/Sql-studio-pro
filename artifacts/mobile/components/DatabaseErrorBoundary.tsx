import React, { Component, PropsWithChildren } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';

/**
 * DB-specific error boundary.
 *
 * Wraps database-heavy screens (table explorer, editor) so a SQLite crash
 * does NOT bubble up to the global ErrorBoundary and reload the whole app.
 * Instead it shows a targeted recovery UI with:
 *   - A plain-language explanation of what went wrong
 *   - A "Try Again" button (resets boundary state, re-mounts children)
 *   - Optionally, a callback to trigger a DB-level recovery action (e.g. delete)
 */

type Props = PropsWithChildren<{
  /** Called when the user presses "Delete Database" — parent handles actual deletion. */
  onDeleteDatabase?: () => void;
}>;

type State = { error: Error | null };

function classify(error: Error): {
  title: string;
  message: string;
  canDelete: boolean;
} {
  const msg = error.message.toLowerCase();

  if (msg.includes('corrupt') || msg.includes('malformed') || msg.includes('disk image')) {
    return {
      title: 'Database is corrupted',
      message: 'The database file is damaged and cannot be read. You can delete it and start fresh.',
      canDelete: true,
    };
  }
  if (msg.includes('no such table') || msg.includes('no such column')) {
    return {
      title: 'Schema mismatch',
      message: `The database structure is unexpected: "${error.message}"`,
      canDelete: false,
    };
  }
  if (msg.includes('locked') || msg.includes('busy')) {
    return {
      title: 'Database is busy',
      message: 'Another operation is using this database. Try again in a moment.',
      canDelete: false,
    };
  }
  if (msg.includes('readonly') || msg.includes('read-only')) {
    return {
      title: 'Database is read-only',
      message: 'This database file cannot be written to.',
      canDelete: false,
    };
  }
  if (msg.includes('disk') || msg.includes('i/o') || msg.includes('io error')) {
    return {
      title: 'Storage error',
      message: 'A storage I/O error occurred. Your device storage may be full or failing.',
      canDelete: false,
    };
  }

  return {
    title: 'Database error',
    message: error.message || 'An unexpected error occurred.',
    canDelete: false,
  };
}

// Functional inner component so we can use hooks (theme colors)
function ErrorFallback({
  error,
  onReset,
  onDeleteDatabase,
}: {
  error: Error;
  onReset: () => void;
  onDeleteDatabase?: () => void;
}) {
  const colors = useColors();
  const { title, message, canDelete } = classify(error);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Feather name="alert-triangle" size={40} color={colors.destructive} style={styles.icon} />
      <Text style={[styles.title, { color: colors.foreground }]}>{title}</Text>
      <Text style={[styles.message, { color: colors.mutedForeground }]}>{message}</Text>

      <Pressable
        onPress={onReset}
        style={({ pressed }) => [styles.btn, { backgroundColor: colors.primary }, pressed && styles.btnPressed]}
      >
        <Feather name="refresh-cw" size={16} color={colors.primaryForeground} />
        <Text style={[styles.btnTextPrimary, { color: colors.primaryForeground }]}>  Try Again</Text>
      </Pressable>

      {canDelete && onDeleteDatabase && (
        <Pressable
          onPress={() => { onReset(); onDeleteDatabase(); }}
          style={({ pressed }) => [styles.btn, styles.btnDanger, { borderColor: colors.destructive }, pressed && styles.btnPressed]}
        >
          <Feather name="trash-2" size={16} color={colors.destructive} />
          <Text style={[styles.btnTextDanger, { color: colors.destructive }]}>  Delete Database</Text>
        </Pressable>
      )}
    </View>
  );
}

export class DatabaseErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <ErrorFallback
        error={error}
        onReset={this.reset}
        onDeleteDatabase={this.props.onDeleteDatabase}
      />
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  icon: { marginBottom: 16 },
  title: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  btnDanger: { backgroundColor: 'transparent', borderWidth: 1 },
  btnPressed: { opacity: 0.75 },
  btnTextPrimary: { fontSize: 15, fontWeight: '600' },
  btnTextDanger: { fontSize: 15, fontWeight: '600' },
});
