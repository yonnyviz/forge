/**
 * Forge Initiative Metadata Types (Schema v2 - Simplified)
 */

export type Stage = "planning" | "building" | "blocked" | "review" | "paused" | "done";

export interface DefinitionOfDoneItem {
  criterion: string;
  completed: boolean;
  completedAt?: string;
}

export interface ProgressEntry {
  timestamp: string;
  entry: string;
  session?: string;
}

export interface Decision {
  timestamp: string;
  decision: string;
  rationale: string;
  alternatives?: string[];
}

export interface Blocker {
  added: string;
  blocker: string;
  active: boolean;
  resolved?: string;
  resolution?: string;
}

export interface Question {
  added: string;
  question: string;
  open: boolean;
  answered?: string;
  answer?: string;
}

export interface Output {
  path: string;
  added: string;
  description?: string;
}

export interface Session {
  start: string;
  end?: string;
  name?: string;
  progressEntries?: number;
}

export interface Completion {
  completedAt: string;
  summary: string;
  keyDecisions: string[];
  artifacts: string[];
}

export interface Metadata {
  // Identity
  name: string;
  displayName: string;
  
  // Intent
  outcome: string;
  scope?: string;
  constraints: string[];
  
  // State
  stage: Stage;
  nextAction: string;
  
  // Timestamps
  created: string;
  updated: string;
  
  // Completion criteria
  definitionOfDone: DefinitionOfDoneItem[];
  
  // Work log
  progress: ProgressEntry[];
  decisions: Decision[];
  blockers: Blocker[];
  questions: Question[];
  
  // Deliverables
  outputs: Output[];
  
  // Sessions
  sessions: Session[];
  
  // Completion (only when stage === "done")
  completion?: Completion;
}

export interface MetadataValidationError {
  field: string;
  message: string;
}
