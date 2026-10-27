import type { RunRecord } from './ecosystem-simulation';

const EVIDENCE_ENDPOINT =
  'https://script.google.com/macros/s/AKfycbyNmgivYwYUu2Qi9-unhv1XxaRFij1QuJ0Ep6elhNLpHWw0WeI9wPWbCUbKqmD_YVdl/exec';
const SCHEMA_VERSION = 1;
const GAME_VERSION = '0.1.0';

export type LearningOptionId = 'A' | 'B' | 'C';
export type LearningEvidenceStatus = 'idle' | 'sending' | 'sent' | 'failed';

export interface LearningReason {
  turn: number;
  strategy: 'A' | 'B';
  food: string;
  eater: string;
}

async function postEvidence(payload: Record<string, unknown>): Promise<LearningEvidenceStatus> {
  try {
    await fetch(EVIDENCE_ENDPOINT, {
      method: 'POST',
      mode: 'no-cors',
      credentials: 'include',
      headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
      body: JSON.stringify(payload),
    });
    // Apps Script's Content service returns an opaque cross-origin response.
    // The sheet, not this browser response, is the source of truth for receipt.
    return 'sent';
  } catch {
    return 'failed';
  }
}

export function createAnonymousId(): string {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

export function submitRunCompleted(
  run: RunRecord,
  comparisonId: string,
  attemptId: string,
): Promise<LearningEvidenceStatus> {
  return postEvidence({
    type: 'run_completed',
    schemaVersion: SCHEMA_VERSION,
    gameVersion: GAME_VERSION,
    submissionId: attemptId,
    comparisonId,
    attemptId,
    run,
  });
}

export function submitReflectionSubmitted(
  comparisonId: string,
  selectedOptionId: LearningOptionId,
  isCorrect: boolean,
  reason?: LearningReason,
): Promise<LearningEvidenceStatus> {
  return postEvidence({
    type: 'reflection_submitted',
    schemaVersion: SCHEMA_VERSION,
    gameVersion: GAME_VERSION,
    submissionId: `${comparisonId}-reflection`,
    comparisonId,
    selectedOptionId,
    isCorrect,
    ...(reason ? { reason } : {}),
  });
}
