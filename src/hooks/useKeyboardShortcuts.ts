import { useEffect, useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  alt?: boolean;
  shift?: boolean;
  action: () => void;
  description: string;
  category: string;
}

interface UseKeyboardShortcutsOptions {
  enabled?: boolean;
  showHelp?: boolean;
}

const useKeyboardShortcuts = (options: UseKeyboardShortcutsOptions = {}) => {
  const { enabled = true, showHelp = true } = options;
  const navigate = useNavigate();
  const [helpVisible, setHelpVisible] = useState(false);

  // Define keyboard shortcuts
  const shortcuts: KeyboardShortcut[] = [
    // Navigation shortcuts
    {
      key: 'h',
      alt: true,
      action: () => navigate('/'),
      description: 'Go to Dashboard',
      category: 'Navigation'
    },
    {
      key: 'u',
      alt: true,
      action: () => navigate('/new-schedule'),
      description: 'New Schedule',
      category: 'Navigation'
    },
    {
      key: 'd',
      alt: true,
      action: () => navigate('/drafts'),
      description: 'Draft Schedules',
      category: 'Navigation'
    },
    {
      key: 't',
      alt: true,
      action: () => navigate('/timepoints'),
      description: 'TimePoints Analysis',
      category: 'Navigation'
    },
    {
      key: 'b',
      alt: true,
      action: () => navigate('/block-configuration'),
      description: 'Block Configuration',
      category: 'Navigation'
    },
    {
      key: 's',
      alt: true,
      action: () => navigate('/schedules'),
      description: 'View Schedules',
      category: 'Navigation'
    },
    {
      key: 'r',
      alt: true,
      action: () => navigate('/routes'),
      description: 'Manage Routes',
      category: 'Navigation'
    },
    
    // Action shortcuts
    {
      key: 's',
      ctrl: true,
      action: () => {
        // Trigger save action based on current page
        const saveButton = document.querySelector('[data-testid="save-button"], button[title*="Save"], button:contains("Save")') as HTMLButtonElement;
        if (saveButton && !saveButton.disabled) {
          saveButton.click();
        }
      },
      description: 'Save current work',
      category: 'Actions'
    },
    {
      key: 'n',
      ctrl: true,
      action: () => {
        // Trigger new/create action based on current page
        const newButton = document.querySelector('[data-testid="new-button"], button[title*="New"], button:contains("New"), button:contains("Create")') as HTMLButtonElement;
        if (newButton && !newButton.disabled) {
          newButton.click();
        }
      },
      description: 'Create new item',
      category: 'Actions'
    },
    {
      key: 'e',
      ctrl: true,
      action: () => {
        // Trigger export action
        const exportButton = document.querySelector('[data-testid="export-button"], button[title*="Export"], button:contains("Export")') as HTMLButtonElement;
        if (exportButton && !exportButton.disabled) {
          exportButton.click();
        }
      },
      description: 'Export data',
      category: 'Actions'
    },
    {
      key: 'f',
      ctrl: true,
      action: () => {
        // Focus search input
        const searchInput = document.querySelector('input[placeholder*="search" i], input[type="search"]') as HTMLInputElement;
        if (searchInput) {
          searchInput.focus();
          searchInput.select();
        }
      },
      description: 'Focus search',
      category: 'Actions'
    },
    
    // Workflow shortcuts
    {
      key: 'ArrowLeft',
      alt: true,
      action: () => window.history.back(),
      description: 'Go back in workflow',
      category: 'Workflow'
    },
    {
      key: 'ArrowRight',
      alt: true,
      action: () => {
        // Find and click "Next" or "Continue" button
        const nextButton = document.querySelector('button:contains("Next"), button:contains("Continue"), button[title*="Next"]') as HTMLButtonElement;
        if (nextButton && !nextButton.disabled) {
          nextButton.click();
        }
      },
      description: 'Go forward in workflow',
      category: 'Workflow'
    },
    {
      key: 'g',
      alt: true,
      action: () => {
        // Find and click "Generate" button
        const generateButton = document.querySelector('button:contains("Generate"), button[title*="Generate"]') as HTMLButtonElement;
        if (generateButton && !generateButton.disabled) {
          generateButton.click();
        }
      },
      description: 'Generate schedule',
      category: 'Workflow'
    },
    
    // Help and utility
    {
      key: '?',
      action: () => setHelpVisible(!helpVisible),
      description: 'Toggle keyboard shortcuts help',
      category: 'Help'
    },
    {
      key: 'Escape',
      action: () => {
        setHelpVisible(false);
        // Close any open modals or dialogs
        const closeButtons = document.querySelectorAll('[data-testid="close-button"], button[title*="Close"], .MuiDialog-root button[aria-label="close"]');
        if (closeButtons.length > 0) {
          (closeButtons[closeButtons.length - 1] as HTMLButtonElement).click();
        }
      },
      description: 'Close modals/dialogs or help',
      category: 'Help'
    }
  ];

  const formatShortcut = useCallback((shortcut: KeyboardShortcut): string => {
    const parts: string[] = [];
    
    if (shortcut.ctrl) parts.push('Ctrl');
    if (shortcut.alt) parts.push('Alt');
    if (shortcut.shift) parts.push('Shift');
    
    // Format key name
    let keyName = shortcut.key;
    if (keyName === 'ArrowLeft') keyName = '←';
    if (keyName === 'ArrowRight') keyName = '→';
    if (keyName === 'ArrowUp') keyName = '↑';
    if (keyName === 'ArrowDown') keyName = '↓';
    if (keyName === 'Escape') keyName = 'Esc';
    if (keyName === ' ') keyName = 'Space';
    
    parts.push(keyName.toUpperCase());
    
    return parts.join(' + ');
  }, []);

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!enabled) return;
    
    // Don't trigger shortcuts when typing in inputs, textareas, or contenteditable elements
    const target = event.target as HTMLElement;
    if (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.contentEditable === 'true' ||
      target.closest('[contenteditable="true"]')
    ) {
      // Only allow escape and help shortcuts in input fields
      if (event.key !== 'Escape' && event.key !== '?') {
        return;
      }
    }

    const matchingShortcut = shortcuts.find(shortcut => {
      return (
        shortcut.key === event.key &&
        !!shortcut.ctrl === event.ctrlKey &&
        !!shortcut.alt === event.altKey &&
        !!shortcut.shift === event.shiftKey
      );
    });

    if (matchingShortcut) {
      event.preventDefault();
      event.stopPropagation();
      matchingShortcut.action();
    }
  }, [enabled, shortcuts]);

  useEffect(() => {
    if (enabled) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [enabled, handleKeyDown]);

  // Group shortcuts by category
  const shortcutsByCategory = shortcuts.reduce((acc, shortcut) => {
    if (!acc[shortcut.category]) {
      acc[shortcut.category] = [];
    }
    acc[shortcut.category].push(shortcut);
    return acc;
  }, {} as Record<string, KeyboardShortcut[]>);

  return {
    shortcuts,
    shortcutsByCategory,
    formatShortcut,
    helpVisible,
    setHelpVisible,
    toggleHelp: () => setHelpVisible(!helpVisible)
  };
};

export default useKeyboardShortcuts;
