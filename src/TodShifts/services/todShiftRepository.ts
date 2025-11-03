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
import { db } from '../../config/firebase';
import {
  DayType,
  TodShiftRun,
  TodShiftRunPayload
} from '../types/shift.types';

interface StoredTodShiftRun extends TodShiftRunPayload {
  coverageTimeline?: Record<DayType, any>;
  colorScale?: any;
  createdAt: any;
  updatedAt: any;
}

const COLLECTION = 'tod_shift_runs';
const LOCAL_STORAGE_KEY = 'tod_shift_runs';

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
  private readonly firebaseEnabled = process.env.REACT_APP_ENABLE_FIREBASE === 'true';

  async createRun(payload: TodShiftRunPayload): Promise<TodShiftRun> {
    if (this.firebaseEnabled && db) {
      const collectionRef = collection(db, COLLECTION);
      const sanitizedPayload = sanitizeForFirestore(payload);
      const docRef = await addDoc(collectionRef, {
        ...sanitizedPayload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      return {
        id: docRef.id,
        ...sanitizedPayload
      };
    }

    const runs = this.getLocalRuns();
    const id = `local_${Date.now()}`;
    const sanitizedPayload = sanitizeForFirestore(payload);
    const newRun: TodShiftRun = {
      id,
      ...sanitizedPayload
    };
    runs.unshift(newRun);
    this.saveLocalRuns(runs);
    return newRun;
  }

  async updateRun(id: string, updates: Partial<TodShiftRun>): Promise<void> {
    if (this.firebaseEnabled && db) {
      const docRef = doc(db, COLLECTION, id);
      const sanitizedUpdates = sanitizeForFirestore(updates);
      await updateDoc(docRef, {
        ...sanitizedUpdates,
        updatedAt: serverTimestamp()
      });
      return;
    }

    const runs = this.getLocalRuns();
    const index = runs.findIndex(run => run.id === id);
    if (index >= 0) {
      runs[index] = {
        ...runs[index],
        ...sanitizeForFirestore(updates)
      };
      this.saveLocalRuns(runs);
    }
  }

  async getMostRecentRun(): Promise<TodShiftRun | null> {
    if (this.firebaseEnabled && db) {
      const collectionRef = collection(db, COLLECTION);
      const q = query(collectionRef, orderBy('importedAt', 'desc'), limit(1));
      const snapshot = await getDocs(q);
      if (snapshot.empty) {
        return null;
      }

      const docSnapshot = snapshot.docs[0];
      const data = docSnapshot.data() as StoredTodShiftRun;
      return {
        id: docSnapshot.id,
        ...this.stripFirestoreFields(data)
      };
    }

    const runs = this.getLocalRuns();
    return runs.length > 0 ? runs[0] : null;
  }

  async getRun(id: string): Promise<TodShiftRun | null> {
    if (this.firebaseEnabled && db) {
      const docRef = doc(db, COLLECTION, id);
      const snapshot = await getDoc(docRef);
      if (!snapshot.exists()) {
        return null;
      }
      const data = snapshot.data() as StoredTodShiftRun;
      return {
        id: snapshot.id,
        ...this.stripFirestoreFields(data)
      };
    }

    const runs = this.getLocalRuns();
    return runs.find(run => run.id === id) ?? null;
  }

  private stripFirestoreFields(data: StoredTodShiftRun): TodShiftRunPayload & {
    coverageTimeline?: Record<DayType, any>;
    colorScale?: any;
  } {
    const { createdAt: _createdAt, updatedAt: _updatedAt, ...rest } = data;
    const normalized = { ...rest } as any;
    if (normalized.lastExportedAt === null) {
      delete normalized.lastExportedAt;
    }
    return normalized;
  }

  private getLocalRuns(): TodShiftRun[] {
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (!raw) {
        return [];
      }
      const parsed = JSON.parse(raw) as TodShiftRun[];
      return parsed;
    } catch (error) {
      console.warn('Unable to parse local TOD shift runs. Resetting store.', error);
      return [];
    }
  }

  private saveLocalRuns(runs: TodShiftRun[]): void {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(runs));
  }

  async overwriteRun(id: string, payload: TodShiftRunPayload): Promise<void> {
    if (this.firebaseEnabled && db) {
      const docRef = doc(db, COLLECTION, id);
      const sanitizedPayload = sanitizeForFirestore(payload);
      await setDoc(docRef, {
        ...sanitizedPayload,
        updatedAt: serverTimestamp()
      }, { merge: true });
      return;
    }

    const runs = this.getLocalRuns();
    const index = runs.findIndex(run => run.id === id);
    if (index >= 0) {
      runs[index] = {
        ...runs[index],
        ...sanitizeForFirestore(payload)
      };
    } else {
      runs.unshift({
        id,
        ...sanitizeForFirestore(payload)
      });
    }
    this.saveLocalRuns(runs);
  }
}

export const todShiftRepository = new TodShiftRepository();
