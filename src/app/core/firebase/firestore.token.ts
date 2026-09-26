import { InjectionToken, inject } from '@angular/core';
import { Firestore, getFirestore } from 'firebase/firestore';
import { FIREBASE_APP } from './firebase.providers';

// Arquivo separado de propósito: só código lazy importa este token, então o SDK do Firestore
// (~500 kB) fica fora do bundle inicial.
export const FIRESTORE = new InjectionToken<Firestore>('FIRESTORE', {
  providedIn: 'root',
  factory: () => getFirestore(inject(FIREBASE_APP)),
});
