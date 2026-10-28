export type ProcessType = 'detailed_answer' | 'summary';
export type ProcessStatus = 'pending' | 'in_progress' | 'completed' | 'failed';

export type StepStatus =
  | 'not_started'
  | 'available'
  | 'in_progress'
  | 'completed'
  | 'skipped'
  | 'failed';

export interface BranchOption {
  id: string;
  title: string;
  description: string;
}

export interface WorkflowStep {
  id: string;
  number: number | string;
  title: string;
  description: string;
  instructions?: string;
  type?: string;
  status: StepStatus;
  prompt_template?: string | null;
  selected_branch?: string | null;
  branch_options?: BranchOption[];
  already_satisfied?: boolean;
  inputs?: Record<string, any>;
  outputs?: Record<string, any>;
  started_at?: string | null;
  completed_at?: string | null;
  duration_ms?: number | null;
  error?: string | null;
}

export interface WorkflowProcessFile {
  id: string;
  workflow_process_id: string;
  step_id: string;
  original_name: string;
  storage_path: string;
  file_type: 'output' | 'input';
  file_size: number;
  created_at: string;
}

export interface WorkflowProcess {
  id: string;
  name: string;
  type: ProcessType;
  status: ProcessStatus;
  current_step_id?: string | null;
  selected_branch?: string | null;
  workflow_version: number;
  steps_data: WorkflowStep[];
  progress_percentage: number;
  completed_steps_count: number;
  total_steps_count: number;
  started_at?: string | null;
  completed_at?: string | null;
  expires_at?: string | null;
  files_purged_at?: string | null;
  error_message?: string | null;
  created_at: string;
  updated_at: string;
  files?: WorkflowProcessFile[];
}
