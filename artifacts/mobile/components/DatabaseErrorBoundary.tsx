import React, { Component, PropsWithChildren } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

/**
 * Task 1.5 — DB-specific error boundary.
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
      message:
        'The database file is damaged and cannot be read. You can delete it and start fresh.',
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
    message: error.message,
    canDelete: false,
  };
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

    const { title, message, canDelete } = classify(error);

    return (
      <View style={styles.container}>
        <Feather name="alert-triangle" size={40} color="#F85149" style={styles.icon} />
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.message}>{message}</Text>

        <Pressable
          onPress={this.reset}
          style={({ pressed }) => [styles.btn, styles.btnPrimary, pressed && styles.btnPressed]}
        >
          <Feather name="refresh-cw" size={16} color="#fff" />
          <Text style={styles.btnTextPrimary}>  Try Again</Text>
        </Pressable>

        {canDelete && this.props.onDeleteDatabase && (
          <Pressable
            onPress={() => {
              this.reset();
              this.props.onDeleteDatabase?.();
            }}
            style={({ pressed }) => [styles.btn, styles.btnDanger, pressed && styles.btnPressed]}
          >
            <Feather name="trash-2" size={16} color="#F85149" />
            <Text style={styles.btnTextDanger}>  Delete Database</Text>
          </Pressable>
        )}
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    backgroundColor: '#0D1117',
  },
  icon: { marginBottom: 16 },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#E6EDF3',
    marginBottom: 8,
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    color: '#8B949E',
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
  btnPrimary: { backgroundColor: '#58A6FF' },
  btnDanger: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#F85149' },
  btnPressed: { opacity: 0.75 },
  btnTextPrimary: { color: '#fff', fontSize: 15, fontWeight: '600' },
  btnTextDanger: { color: '#F85149', fontSize: 15, fontWeight: '600' },
});
