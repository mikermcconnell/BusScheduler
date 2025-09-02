/**
 * Draft Workflow Service
 * Manages workflow state for individual draft schedules with engaging storyboard approach
 */

export interface WorkflowStepData {
  key: string;
  title: string;
  funTitle: string; // Fun, engaging title
  description: string;
  icon: string; // Icon name for dynamic loading
  color: string; // Theme color for the step
  status: 'not-started' | 'in-progress' | 'completed';
  completedAt?: string;
  progress?: number; // 0-100 for partial completion
  metadata?: any; // Step-specific data
}

export interface DraftWorkflowState {
  draftId: string;
  draftName: string;
  routeName?: string;
  currentStep: string;
  steps: WorkflowStepData[];
  overallProgress: number;
  lastModified: string;
  createdAt: string;
  celebrationsShown?: string[]; // Track which celebrations have been shown
}

// Fun messages for different progress levels
const PROGRESS_MESSAGES = {
  0: "Ready to create something awesome? Let's go! 🚌",
  10: "Great start! Every journey begins with a single step 🚀",
  25: "You're on a roll! Your schedule is taking shape 📍",
  40: "Looking good! The pieces are coming together 🧩",
  50: "Halfway there! You're doing amazing 🌟",
  65: "Fantastic progress! Keep up the great work 💪",
  75: "Almost done! The finish line is in sight 🏁",
  90: "So close! Just a few more touches ✨",
  100: "Schedule complete! You're a scheduling wizard! 🎉"
};

// Motivational tips for each step
const STEP_TIPS = {
  'upload': [
    "Every great schedule starts with good data",
    "Drop your file and let the magic begin",
    "Your journey to a perfect schedule starts here"
  ],
  'drafts': [
    "Take a moment to review what we've found",
    "This is where your data becomes a story",
    "Preview your schedule's blueprint"
  ],
  'timepoints': [
    "Find the perfect rhythm for your routes",
    "Discover patterns in your travel times",
    "This is where timing becomes an art"
  ],
  'block-config': [
    "Arrange your buses like a master strategist",
    "Build your fleet configuration",
    "Create the perfect bus ballet"
  ],
  'summary': [
    "Watch your schedule come to life",
    "See all your hard work pay off",
    "Your masterpiece is almost ready"
  ],
  'connections': [
    "Connect every passenger to their destination",
    "Make sure no one gets left behind",
    "The final touches that make it perfect"
  ]
};

class DraftWorkflowService {
  private readonly WORKFLOW_KEY_PREFIX = 'scheduler2_draft_workflow_';
  private readonly ACTIVE_DRAFT_KEY = 'scheduler2_active_draft';

  /**
   * Initialize workflow steps with fun, engaging content
   */
  private initializeSteps(): WorkflowStepData[] {
    return [
      {
        key: 'upload',
        title: 'Upload Data',
        funTitle: 'Start Your Journey',
        description: 'Drop your schedule data here and let\'s begin crafting something amazing!',
        icon: 'CloudUpload',
        color: '#E3E8F0',
        status: 'not-started',
        progress: 0
      },
      {
        key: 'drafts',
        title: 'Draft Review',
        funTitle: 'Preview the Blueprint',
        description: 'Take a peek at what we\'ve discovered in your data',
        icon: 'Drafts',
        color: '#E8D5F2',
        status: 'not-started',
        progress: 0
      },
      {
        key: 'timepoints',
        title: 'TimePoints Analysis',
        funTitle: 'Find Your Rhythm',
        description: 'Let\'s discover the perfect timing for your routes',
        icon: 'Timeline',
        color: '#FFE4D1',
        status: 'not-started',
        progress: 0
      },
      {
        key: 'block-config',
        title: 'Block Configuration',
        funTitle: 'Build Your Fleet',
        description: 'Arrange your buses like pieces on a chess board',
        icon: 'Build',
        color: '#D4F1E4',
        status: 'not-started',
        progress: 0
      },
      {
        key: 'summary',
        title: 'Base Schedule',
        funTitle: 'Bring It to Life',
        description: 'Watch your schedule come together like magic',
        icon: 'ViewList',
        color: '#D1E7FF',
        status: 'not-started',
        progress: 0
      },
      {
        key: 'connections',
        title: 'Connection Schedule',
        funTitle: 'Connect the Dots',
        description: 'Make sure every passenger can get where they need to go',
        icon: 'SwapVert',
        color: '#FFE8B8',
        status: 'not-started',
        progress: 0
      }
    ];
  }

  /**
   * Create or get workflow for a draft
   */
  getOrCreateWorkflow(draftId: string, draftName?: string): DraftWorkflowState {
    const existingWorkflow = this.getWorkflow(draftId);
    if (existingWorkflow) {
      return existingWorkflow;
    }

    const now = new Date().toISOString();
    const workflow: DraftWorkflowState = {
      draftId,
      draftName: draftName || `Draft ${draftId.substring(0, 8)}`,
      currentStep: 'upload',
      steps: this.initializeSteps(),
      overallProgress: 0,
      lastModified: now,
      createdAt: now,
      celebrationsShown: []
    };

    this.saveWorkflow(workflow);
    return workflow;
  }

  /**
   * Get workflow for a specific draft
   */
  getWorkflow(draftId: string): DraftWorkflowState | null {
    try {
      const data = localStorage.getItem(this.WORKFLOW_KEY_PREFIX + draftId);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Error loading draft workflow:', error);
      return null;
    }
  }

  /**
   * Save workflow state
   */
  saveWorkflow(workflow: DraftWorkflowState): void {
    try {
      workflow.lastModified = new Date().toISOString();
      localStorage.setItem(
        this.WORKFLOW_KEY_PREFIX + workflow.draftId,
        JSON.stringify(workflow)
      );
    } catch (error) {
      console.error('Error saving draft workflow:', error);
    }
  }

  /**
   * Update step status with animations and celebrations
   */
  updateStepStatus(
    draftId: string,
    stepKey: string,
    status: 'not-started' | 'in-progress' | 'completed',
    progress?: number,
    metadata?: any
  ): DraftWorkflowState | null {
    const workflow = this.getWorkflow(draftId);
    if (!workflow) return null;

    const stepIndex = workflow.steps.findIndex(s => s.key === stepKey);
    if (stepIndex === -1) return null;

    const oldStatus = workflow.steps[stepIndex].status;
    
    // Update the step
    workflow.steps[stepIndex] = {
      ...workflow.steps[stepIndex],
      status,
      progress: progress ?? (status === 'completed' ? 100 : status === 'in-progress' ? 50 : 0),
      completedAt: status === 'completed' ? new Date().toISOString() : undefined,
      metadata
    };

    // If completing a step, mark the next one as available
    if (status === 'completed' && oldStatus !== 'completed') {
      if (stepIndex < workflow.steps.length - 1) {
        workflow.steps[stepIndex + 1].status = 'in-progress';
        workflow.currentStep = workflow.steps[stepIndex + 1].key;
      }
    }

    // Update current step if starting
    if (status === 'in-progress') {
      workflow.currentStep = stepKey;
    }

    // Calculate overall progress
    workflow.overallProgress = this.calculateProgress(workflow.steps);

    this.saveWorkflow(workflow);
    return workflow;
  }

  /**
   * Calculate overall progress percentage
   */
  private calculateProgress(steps: WorkflowStepData[]): number {
    const totalSteps = steps.length;
    const completedSteps = steps.filter(s => s.status === 'completed').length;
    const inProgressSteps = steps.filter(s => s.status === 'in-progress').length;
    
    // Give partial credit for in-progress steps
    const progress = ((completedSteps + (inProgressSteps * 0.5)) / totalSteps) * 100;
    return Math.round(progress);
  }

  /**
   * Get active draft workflow
   */
  getActiveDraft(): string | null {
    return localStorage.getItem(this.ACTIVE_DRAFT_KEY);
  }

  /**
   * Set active draft
   */
  setActiveDraft(draftId: string): void {
    localStorage.setItem(this.ACTIVE_DRAFT_KEY, draftId);
  }

  /**
   * Get all draft workflows
   */
  getAllWorkflows(): DraftWorkflowState[] {
    const workflows: DraftWorkflowState[] = [];
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(this.WORKFLOW_KEY_PREFIX)) {
        try {
          const data = localStorage.getItem(key);
          if (data) {
            workflows.push(JSON.parse(data));
          }
        } catch (error) {
          console.error(`Error parsing workflow ${key}:`, error);
        }
      }
    }

    return workflows.sort((a, b) => 
      new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime()
    );
  }

  /**
   * Delete workflow for a draft
   */
  deleteWorkflow(draftId: string): void {
    localStorage.removeItem(this.WORKFLOW_KEY_PREFIX + draftId);
    
    // If this was the active draft, clear it
    if (this.getActiveDraft() === draftId) {
      localStorage.removeItem(this.ACTIVE_DRAFT_KEY);
    }
  }

  /**
   * Get progress message based on percentage
   */
  getProgressMessage(progress: number): string {
    const thresholds = Object.keys(PROGRESS_MESSAGES)
      .map(Number)
      .sort((a, b) => b - a);
    
    for (const threshold of thresholds) {
      if (progress >= threshold) {
        return PROGRESS_MESSAGES[threshold as keyof typeof PROGRESS_MESSAGES];
      }
    }
    
    return PROGRESS_MESSAGES[0];
  }

  /**
   * Get random tip for a step
   */
  getStepTip(stepKey: string): string {
    const tips = STEP_TIPS[stepKey as keyof typeof STEP_TIPS];
    if (!tips || tips.length === 0) return '';
    
    return tips[Math.floor(Math.random() * tips.length)];
  }

  /**
   * Check if should show celebration
   */
  shouldShowCelebration(workflow: DraftWorkflowState, milestone: string): boolean {
    if (!workflow.celebrationsShown) {
      workflow.celebrationsShown = [];
    }
    
    if (workflow.celebrationsShown.includes(milestone)) {
      return false;
    }
    
    workflow.celebrationsShown.push(milestone);
    this.saveWorkflow(workflow);
    return true;
  }

  /**
   * Complete current step and move to next
   */
  completeCurrentStep(draftId: string, metadata?: any): DraftWorkflowState | null {
    const workflow = this.getWorkflow(draftId);
    if (!workflow) return null;

    const currentStep = workflow.steps.find(s => s.key === workflow.currentStep);
    if (!currentStep) return null;

    return this.updateStepStatus(draftId, currentStep.key, 'completed', 100, metadata);
  }

  /**
   * Navigate to a specific step (if allowed)
   */
  navigateToStep(draftId: string, stepKey: string): boolean {
    const workflow = this.getWorkflow(draftId);
    if (!workflow) return false;

    const step = workflow.steps.find(s => s.key === stepKey);
    if (!step || step.status === 'not-started') return false;

    workflow.currentStep = stepKey;
    this.saveWorkflow(workflow);
    return true;
  }

  /**
   * Can access a specific step
   */
  canAccessStep(draftId: string, stepKey: string): boolean {
    const workflow = this.getWorkflow(draftId);
    if (!workflow) return false;

    const step = workflow.steps.find(s => s.key === stepKey);
    return step ? step.status !== 'not-started' : false;
  }
}

// Export singleton instance
export const draftWorkflowService = new DraftWorkflowService();