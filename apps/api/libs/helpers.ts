import { randomUUID } from 'crypto';

export function checkIfExist<T>(arr: T[], element: T): boolean {
  return arr.includes(element);
}

export const generateUUID = (): string => {
  return randomUUID();
};

