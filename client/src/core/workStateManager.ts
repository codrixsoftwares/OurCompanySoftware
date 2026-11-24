/**
 * CodRix Enterprise OS - Work State Manager
 * Preserves user drafts, active tab context, form states across unexpected sessions,
 * and particularly during 15-minute inactivity session timeouts.
 */

export interface SavedWorkState {
  currentTab: string;
  actionTitle?: string;
  summary: string;
  leadDraft?: {
    companyName: string;
    contactName: string;
    email: string;
    phone: string;
    website?: string;
    location?: string;
    serviceInterest: string;
    priority: string;
    currentTechStack?: string;
    clientNeeds: string;
    budgetRange?: string;
    decisionMakerRole?: string;
    codrixSolution: string;
    projectScale?: string;
    pitchAngle?: string;
    proofLinks: string;
    researchPoints: string;
    assignedBdeEmail?: string;
    formStage?: number;
    updatedAt: string;
  };
  mailboxDraft?: {
    to: string;
    subject: string;
    body: string;
    updatedAt: string;
  };
  timestamp: string;
}

const STORAGE_KEY = 'codrix_saved_work_state';
const TIMEOUT_NOTICE_KEY = 'codrix_timeout_notice';

class WorkStateManager {
  private activeState: SavedWorkState = {
    currentTab: 'dashboard',
    summary: 'CodRix Enterprise OS Workspace',
    timestamp: new Date().toISOString()
  };

  constructor() {
    this.restoreFromStorage();
  }

  private restoreFromStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        this.activeState = JSON.parse(raw);
      }
    } catch {
      // ignore
    }
  }

  public setTab(tab: string, summary?: string) {
    this.activeState.currentTab = tab;
    if (summary) {
      this.activeState.summary = summary;
    } else {
      this.activeState.summary = `Viewing ${tab.toUpperCase()} Workspace`;
    }
    this.activeState.timestamp = new Date().toISOString();
    this.persist();
  }

  public saveLeadDraft(draft: SavedWorkState['leadDraft']) {
    if (!draft) return;
    this.activeState.leadDraft = draft;
    this.activeState.currentTab = 'crm';
    this.activeState.actionTitle = 'Creating Lead & Survey Intelligence';
    this.activeState.summary = draft.companyName
      ? `Drafting Lead & BDE Survey for "${draft.companyName}"`
      : 'Drafting Lead & BDE Survey Intelligence';
    this.activeState.timestamp = new Date().toISOString();
    this.persist();
  }

  public clearLeadDraft() {
    delete this.activeState.leadDraft;
    this.persist();
  }

  public getLeadDraft(): SavedWorkState['leadDraft'] | undefined {
    return this.activeState.leadDraft;
  }

  public saveMailboxDraft(draft: SavedWorkState['mailboxDraft']) {
    if (!draft) return;
    this.activeState.mailboxDraft = draft;
    this.activeState.currentTab = 'mailbox';
    this.activeState.actionTitle = 'Composing Email';
    this.activeState.summary = draft.subject
      ? `Composing Email: "${draft.subject}"`
      : 'Composing email draft';
    this.activeState.timestamp = new Date().toISOString();
    this.persist();
  }

  public clearMailboxDraft() {
    delete this.activeState.mailboxDraft;
    this.persist();
  }

  public getActiveSummary(): string {
    if (this.activeState.leadDraft && (this.activeState.leadDraft.companyName || this.activeState.leadDraft.clientNeeds)) {
      return `BDE Survey & Lead creation draft for "${this.activeState.leadDraft.companyName || 'New Prospect'}"`;
    }
    if (this.activeState.mailboxDraft && (this.activeState.mailboxDraft.subject || this.activeState.mailboxDraft.to)) {
      return `Drafting email to ${this.activeState.mailboxDraft.to || 'recipient'} ("${this.activeState.mailboxDraft.subject || 'Untitled'}")`;
    }
    return this.activeState.summary || 'CodRix Enterprise OS Workspace session';
  }

  public getState(): SavedWorkState {
    return this.activeState;
  }

  public persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.activeState));
    } catch {
      // storage quota or private mode
    }
  }

  public recordTimeoutNotice(userEmail?: string) {
    const summary = this.getActiveSummary();
    const notice = {
      timedOutAt: new Date().toISOString(),
      userEmail: userEmail || '',
      summary,
      tab: this.activeState.currentTab,
      hasLeadDraft: Boolean(this.activeState.leadDraft && this.activeState.leadDraft.companyName),
      hasMailboxDraft: Boolean(this.activeState.mailboxDraft && this.activeState.mailboxDraft.subject)
    };
    try {
      localStorage.setItem(TIMEOUT_NOTICE_KEY, JSON.stringify(notice));
    } catch {
      // ignore
    }
  }

  public getTimeoutNotice(): any | null {
    try {
      const raw = localStorage.getItem(TIMEOUT_NOTICE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  public clearTimeoutNotice() {
    try {
      localStorage.removeItem(TIMEOUT_NOTICE_KEY);
    } catch {
      // ignore
    }
  }
}

export const workStateManager = new WorkStateManager();
