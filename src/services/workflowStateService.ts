/**
 * Workflow State Service
 * Manages persistent workflow state across navigation
 */

export interface WorkflowStepState {
  key: string;
  status: 'completed' | 'active' | 'pending';
  completedAt?: string;
  data?: any; // Store any relevant data from the completed step
}

export interface WorkflowState {
  workflowId: string;
  workflowType: 'schedule-creation' | 'route-management' | 'shift-planning';
  currentStep: string;
  steps: WorkflowStepState[];
  startedAt: string;
  updatedAt: string;
  scheduleId?: string; // Associated schedule ID if applicable
}

const WORKFLOW_STATE_KEY = 'scheduler2_workflow_state';
const WORKFLOW_HISTORY_KEY = 'scheduler2_workflow_history';

class WorkflowStateService {
  /**
   * Get current workflow state
   */
  getCurrentWorkflow(): WorkflowState | null {
    try {
      const state = localStorage.getItem(WORKFLOW_STATE_KEY);
      return state ? JSON.parse(state) : null;
    } catch (error) {
      console.error('Error loading workflow state:', error);
      return null;
    }
  }

  /**
   * Start a new workflow
   */
  startWorkflow(
    workflowType: WorkflowState['workflowType'],
    scheduleId?: string
  ): WorkflowState {
    const workflowId = `workflow_${Date.now()}`;
    
    // Define initial steps based on workflow type
    const steps = this.getInitialSteps(workflowType);
    
    const workflow: WorkflowState = {
      workflowId,
      workflowType,
      currentStep: steps[0].key,
      steps,
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      scheduleId
    };

    this.saveWorkflow(workflow);
    return workflow;
  }

  /**
   * Update workflow step status
   */
  updateStepStatus(
    stepKey: string,
    status: 'completed' | 'active' | 'pending',
    data?: any
  ): WorkflowState | null {
    const workflow = this.getCurrentWorkflow();
    if (!workflow) return null;

    const stepIndex = workflow.steps.findIndex(s => s.key === stepKey);
    if (stepIndex === -1) return null;

    // Update the step
    workflow.steps[stepIndex] = {
      ...workflow.steps[stepIndex],
      status,
      completedAt: status === 'completed' ? new Date().toISOString() : undefined,
      data: data || workflow.steps[stepIndex].data
    };

    // If completing a step, activate the next one
    if (status === 'completed' && stepIndex < workflow.steps.length - 1) {
      workflow.steps[stepIndex + 1].status = 'active';
      workflow.currentStep = workflow.steps[stepIndex + 1].key;
    }

    // Update current step if activating
    if (status === 'active') {
      workflow.currentStep = stepKey;
    }

    workflow.updatedAt = new Date().toISOString();
    this.saveWorkflow(workflow);
    return workflow;
  }

  /**
   * Mark step as completed with data
   */
  completeStep(stepKey: string, data?: any): WorkflowState | null {
    return this.updateStepStatus(stepKey, 'completed', data);
  }

  /**
   * Navigate to a step (only if completed or active)
   */
  navigateToStep(stepKey: string): boolean {
    const workflow = this.getCurrentWorkflow();
    if (!workflow) return false;

    const step = workflow.steps.find(s => s.key === stepKey);
    if (!step || step.status === 'pending') return false;

    // Update current step
    workflow.currentStep = stepKey;
    workflow.updatedAt = new Date().toISOString();
    this.saveWorkflow(workflow);
    return true;
  }

  /**
   * Get step data
   */
  getStepData(stepKey: string): any {
    const workflow = this.getCurrentWorkflow();
    if (!workflow) return null;

    const step = workflow.steps.find(s => s.key === stepKey);
    return step?.data || null;
  }

  /**
   * Clear current workflow
   */
  clearWorkflow(): void {
    // Save to history before clearing
    const current = this.getCurrentWorkflow();
    if (current) {
      this.addToHistory(current);
    }
    
    localStorage.removeItem(WORKFLOW_STATE_KEY);
  }

  /**
   * Get workflow history
   */
  getWorkflowHistory(): WorkflowState[] {
    try {
      const history = localStorage.getItem(WORKFLOW_HISTORY_KEY);
      return history ? JSON.parse(history) : [];
    } catch (error) {
      console.error('Error loading workflow history:', error);
      return [];
    }
  }

  /**
   * Check if a step can be accessed
   */
  canAccessStep(stepKey: string): boolean {
    const workflow = this.getCurrentWorkflow();
    if (!workflow) return false;

    const step = workflow.steps.find(s => s.key === stepKey);
    return step ? step.status !== 'pending' : false;
  }

  /**
   * Get progress percentage
   */
  getProgress(): number {
    const workflow = this.getCurrentWorkflow();
    if (!workflow) return 0;

    const completedSteps = workflow.steps.filter(s => s.status === 'completed').length;
    return Math.round((completedSteps / workflow.steps.length) * 100);
  }

  /**
   * Private: Save workflow to localStorage
   */
  private saveWorkflow(workflow: WorkflowState): void {
    try {
      localStorage.setItem(WORKFLOW_STATE_KEY, JSON.stringify(workflow));
    } catch (error) {
      console.error('Error saving workflow state:', error);
    }
  }

  /**
   * Private: Add workflow to history
   */
  private addToHistory(workflow: WorkflowState): void {
    try {
      const history = this.getWorkflowHistory();
      history.unshift(workflow); // Add to beginning
      
      // Keep only last 10 workflows
      if (history.length > 10) {
        history.pop();
      }
      
      localStorage.setItem(WORKFLOW_HISTORY_KEY, JSON.stringify(history));
    } catch (error) {
      console.error('Error saving workflow history:', error);
    }
  }

  /**
   * Private: Get initial steps for workflow type
   */
  private getInitialSteps(workflowType: WorkflowState['workflowType']): WorkflowStepState[] {
    const stepConfigs = {
      'schedule-creation': [
        { key: 'upload', label: 'Upload Data' },
        { key: 'drafts', label: 'Draft Review' },
        { key: 'timepoints', label: 'TimePoints Analysis' },
        { key: 'block-config', label: 'Block Configuration' },
        { key: 'summary', label: 'Summary Schedule' }
      ],
      'route-management': [
        { key: 'routes', label: 'Route Setup' },
        { key: 'timepoints', label: 'TimePoint Configuration' }
      ],
      'shift-planning': [
        { key: 'schedules', label: 'Schedule Review' },
        { key: 'tod-shifts', label: 'Shift Planning' }
      ]
    };

    const configs = stepConfigs[workflowType] || [];
    
    return configs.map((config, index) => ({
      key: config.key,
      status: index === 0 ? 'active' : 'pending' as const
    }));
  }
}

// Export singleton instance
export const workflowStateService = new WorkflowStateService();