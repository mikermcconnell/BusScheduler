import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc
} from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { db, storage } from '../../config/firebase';
import { TodShiftRun, TodShiftRunPayload, TodShiftStoredFile } from '../types/shift.types';

interface StoredTodShiftRun extends TodShiftRunPayload {
  createdAt: any;
  updatedAt: any;
}

type SourceFileKind = 'city' | 'contractor';

const COLLECTION = 'tod_shift_runs';
const SOURCE_FILE_PREFIX: Record<SourceFileKind, string> = {
  city: 'city-master',
  contractor: 'contractor-mvt'
};

function sanitizeValue(value: any): any {
  if (value === undefined) {
    return null;
  }

  if (Array.isArray(value)) {
    return value.map(item => {
      const sanitized = sanitizeValue(item);
      return sanitized === undefined ? null : sanitized;
    });
  }

  if (value && typeof value === 'object') {
    const result: Record<string, any> = {};
    Object.entries(value).forEach(([key, val]) => {
      const sanitized = sanitizeValue(val);
      if (sanitized !== undefined) {
        result[key] = sanitized;
      }
    });
    return result;
  }

  return value;
}

function sanitizeForFirestore<T>(payload: T): T {
  return sanitizeValue(payload);
}

class TodShiftRepository {
  private ensureFirestore(): void {
    if (!db) {
      throw new Error('Firestore is not configured for TOD shift persistence.');
    }
  }

  private ensureStorage(): void {
    if (!storage) {
      throw new Error('Firebase Storage is not configured for TOD shift persistence.');
    }
  }

  async allocateRunId(): Promise<string> {
    this.ensureFirestore();
    const collectionRef = collection(db, COLLECTION);
    return doc(collectionRef).id;
  }

  async uploadSourceFile(params: {
    runId: string;
    blob: Blob;
    fileName: string;
    kind: SourceFileKind;
  }): Promise<TodShiftStoredFile> {
    this.ensureStorage();
    const { runId, blob, fileName, kind } = params;
    const timestamp = Date.now();
    const extension = fileName.includes('.') ? fileName.split('.').pop() : 'csv';
    const normalizedExt = extension ? `.${extension}` : '';
    const storagePath = `${COLLECTION}/${runId}/${SOURCE_FILE_PREFIX[kind]}-${timestamp}${normalizedExt}`;
    const storageRef = ref(storage, storagePath);
    await uploadBytes(storageRef, blob, {
      contentType: (blob as File).type || 'text/csv',
      customMetadata: {
        originalName: fileName,
        fileKind: kind
      }
    });
    const downloadURL = await getDownloadURL(storageRef);
    return {
      name: fileName,
      storagePath,
      uploadedAt: new Date().toISOString(),
      size: blob.size,
      contentType: (blob as File).type || 'text/csv',
      downloadURL
    };
  }

  async fetchSourceFile(file: TodShiftStoredFile): Promise<File> {
    this.ensureStorage();
    const fileRef = ref(storage, file.storagePath);
    const url = await getDownloadURL(fileRef);
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Unable to download source file: ${file.name}`);
    }
    const blob = await response.blob();
    return new File([blob], file.name, { type: blob.type || file.contentType || 'text/csv' });
  }

  async createRun(payload: TodShiftRunPayload, preferredId?: string): Promise<TodShiftRun> {
    this.ensureFirestore();
    const sanitizedPayload = sanitizeForFirestore(payload);
    if (preferredId) {
      const targetRef = doc(db, COLLECTION, preferredId);
      await setDoc(targetRef, {
        ...sanitizedPayload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      return { id: preferredId, ...payload };
    }

    const collectionRef = collection(db, COLLECTION);
    const docRef = await addDoc(collectionRef, {
      ...sanitizedPayload,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return {
      id: docRef.id,
      ...payload
    };
  }

  async overwriteRun(id: string, payload: Partial<TodShiftRunPayload>): Promise<void> {
    this.ensureFirestore();
    const docRef = doc(db, COLLECTION, id);
    const sanitizedPayload = sanitizeForFirestore(payload);
    await setDoc(
      docRef,
      {
        ...sanitizedPayload,
        updatedAt: serverTimestamp()
      },
      { merge: true }
    );
  }

  async updateRun(id: string, updates: Partial<TodShiftRunPayload>): Promise<void> {
    this.ensureFirestore();
    const docRef = doc(db, COLLECTION, id);
    const sanitizedUpdates = sanitizeForFirestore(updates);
    await updateDoc(docRef, {
      ...sanitizedUpdates,
      updatedAt: serverTimestamp()
    });
  }

  async listRuns(limitCount = 25): Promise<TodShiftRun[]> {
    this.ensureFirestore();
    const collectionRef = collection(db, COLLECTION);
    const q = query(collectionRef, orderBy('importedAt', 'desc'), limit(limitCount));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((docSnapshot) => ({
      id: docSnapshot.id,
      ...this.stripFirestoreFields(docSnapshot.data() as StoredTodShiftRun)
    }));
  }

  async getMostRecentRun(): Promise<TodShiftRun | null> {
    const runs = await this.listRuns(1);
    return runs.length > 0 ? runs[0] : null;
  }

  async getRun(id: string): Promise<TodShiftRun | null> {
    this.ensureFirestore();
    const docRef = doc(db, COLLECTION, id);
    const snapshot = await getDoc(docRef);
    if (!snapshot.exists()) {
      return null;
    }
    return {
      id: snapshot.id,
      ...this.stripFirestoreFields(snapshot.data() as StoredTodShiftRun)
    };
  }

  private stripFirestoreFields(data: StoredTodShiftRun): TodShiftRunPayload {
    const { createdAt: _createdAt, updatedAt: _updatedAt, ...rest } = data;
    const normalized = { ...rest } as any;
    if (normalized.lastExportedAt === null) {
      delete normalized.lastExportedAt;
    }
    if (normalized.lastAutosavedAt === null) {
      delete normalized.lastAutosavedAt;
    }
    if (normalized.lastOptimizationReport === null) {
      delete normalized.lastOptimizationReport;
    }
    return normalized;
  }
}

export const todShiftRepository = new TodShiftRepository();
