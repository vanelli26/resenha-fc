import { InjectionToken, inject } from '@angular/core';
import { FirebaseStorage, getStorage } from 'firebase/storage';
import { FIREBASE_APP } from './firebase.providers';

// Como o FIRESTORE: só código lazy importa este token, mantendo o SDK do Storage fora do bundle inicial.
export const STORAGE = new InjectionToken<FirebaseStorage>('STORAGE', {
  providedIn: 'root',
  factory: () => getStorage(inject(FIREBASE_APP)),
});
