import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { Alert, Platform } from 'react-native';

// expo-file-system v57 moved directory constants into FileSystem.Paths on some
// platforms. This helper resolves them safely across all versions.
function cacheDir(): string {
  return (FileSystem as any).cacheDirectory as string ?? '';
}
function documentDir(): string {
  return (FileSystem as any).documentDirectory as string ?? '';
}

/** Write text to a temp file and share it */
export async function shareTextFile(content: string, filename: string): Promise<void> {
  try {
    const uri = cacheDir() + filename;
    await (FileSystem as any).writeAsStringAsync(uri, content, { encoding: (FileSystem as any).EncodingType?.UTF8 ?? 'utf8' });
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, { mimeType: getMimeType(filename) });
    } else {
      Alert.alert('Sharing not available', 'Your device does not support file sharing.');
    }
  } catch (e) {
    Alert.alert('Export Failed', (e as Error).message);
  }
}

/** Share the raw .db file as a backup */
export async function backupDatabase(dbId: string, dbName: string): Promise<void> {
  try {
    const src = `${documentDir()}SQLite/sqlstudio_${dbId}.db`;
    const info = await (FileSystem as any).getInfoAsync(src);
    if (!info.exists) {
      Alert.alert('Backup Failed', 'Database file not found. Open the database first.');
      return;
    }
    const dest = cacheDir() + `${dbName.replace(/[^a-zA-Z0-9_-]/g, '_')}_backup.db`;
    await (FileSystem as any).copyAsync({ from: src, to: dest });
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(dest, { mimeType: 'application/octet-stream' });
    } else {
      Alert.alert('Sharing not available', 'Your device does not support file sharing.');
    }
  } catch (e) {
    Alert.alert('Backup Failed', (e as Error).message);
  }
}

export interface ImportResult {
  success: boolean;
  uri?: string;
  filename?: string;
  error?: string;
}

/** Let user pick a .db/.sqlite file and copy it to the SQLite directory */
export async function pickAndImportDatabase(): Promise<ImportResult> {
  try {
    const result = await DocumentPicker.getDocumentAsync({
      type: Platform.OS === 'ios'
        ? ['public.database', 'public.data']
        : ['application/octet-stream', '*/*'],
      copyToCacheDirectory: true,
    });
    if (result.canceled) return { success: false };
    const asset = result.assets[0];
    if (!asset) return { success: false };

    const dir = `${documentDir()}SQLite/`;
    const dirInfo = await (FileSystem as any).getInfoAsync(dir);
    if (!dirInfo.exists) await (FileSystem as any).makeDirectoryAsync(dir, { intermediates: true });

    return { success: true, uri: asset.uri, filename: asset.name };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}

/** Copy an imported file URI into the SQLite dir under a given dbId */
export async function copyImportedDb(srcUri: string, dbId: string): Promise<void> {
  const dir = `${documentDir()}SQLite/`;
  const dirInfo = await (FileSystem as any).getInfoAsync(dir);
  if (!dirInfo.exists) await (FileSystem as any).makeDirectoryAsync(dir, { intermediates: true });
  const dest = `${dir}sqlstudio_${dbId}.db`;
  await (FileSystem as any).copyAsync({ from: srcUri, to: dest });
}

function getMimeType(filename: string): string {
  if (filename.endsWith('.csv')) return 'text/csv';
  if (filename.endsWith('.json')) return 'application/json';
  if (filename.endsWith('.sql')) return 'text/plain';
  return 'application/octet-stream';
}
