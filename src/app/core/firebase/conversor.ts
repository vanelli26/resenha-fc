import { DocumentData, FirestoreDataConverter, QueryDocumentSnapshot } from 'firebase/firestore';

export type ComId<T> = T & { id: string };

/**
 * Único ponto que tipa dados lidos do Firestore. O formato é garantido pelos validadores
 * das Security Rules (firestore.rules); usar só em leituras.
 */
export function conversor<T extends DocumentData>(): FirestoreDataConverter<T> {
  return {
    toFirestore: (dados) => dados,
    fromFirestore: (snap: QueryDocumentSnapshot) => snap.data() as T,
  };
}

export function comId<T extends DocumentData>(snap: QueryDocumentSnapshot<T>): ComId<T> {
  return { ...snap.data(), id: snap.id };
}
