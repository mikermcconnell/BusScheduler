/**
 * Google Drive Storage Service
 * Provides backup and sync functionality for schedule data using Google Drive API
 */

import { SavedSchedule, DraftSchedule } from './scheduleStorage';

interface GoogleDriveConfig {
  clientId: string;
  apiKey: string;
  discoveryDocs: string[];
  scopes: string[];
}

interface GoogleDriveFile {
  id: string;
  name: string;
  modifiedTime: string;
  size: string;
}

class GoogleDriveStorageService {
  private gapi: any = null;
  private isSignedIn: boolean = false;
  private config: GoogleDriveConfig = {
    clientId: process.env.REACT_APP_GOOGLE_CLIENT_ID || '',
    apiKey: process.env.REACT_APP_GOOGLE_API_KEY || '',
    discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
    scopes: ['https://www.googleapis.com/auth/drive.file']
  };

  private readonly FOLDER_NAME = 'Scheduler2_Backups';
  private readonly SCHEDULES_FILE = 'schedules_backup.json';
  private readonly DRAFTS_FILE = 'drafts_backup.json';
  private folderID: string | null = null;

  /**
   * Initialize Google Drive API
   */
  async initialize(): Promise<{ success: boolean; error?: string }> {
    try {
      // Load Google API script if not already loaded
      if (!(window as any).gapi) {
        await this.loadGoogleAPI();
      }

      this.gapi = (window as any).gapi;
      
      // Initialize the API
      await new Promise<void>((resolve, reject) => {
        this.gapi.load('client:auth2', async () => {
          try {
            await this.gapi.client.init({
              apiKey: this.config.apiKey,
              clientId: this.config.clientId,
              discoveryDocs: this.config.discoveryDocs,
              scope: this.config.scopes
            });
            
            // Check if already signed in
            const authInstance = this.gapi.auth2.getAuthInstance();
            this.isSignedIn = authInstance.isSignedIn.get();
            
            resolve();
          } catch (error) {
            reject(error);
          }
        });
      });

      return { success: true };

    } catch (error) {
      console.error('Error initializing Google Drive API:', error);
      return { 
        success: false, 
        error: 'Failed to initialize Google Drive. Please check your API configuration.' 
      };
    }
  }

  /**
   * Load Google API script dynamically
   */
  private loadGoogleAPI(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (document.querySelector('script[src="https://apis.google.com/js/api.js"]')) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://apis.google.com/js/api.js';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load Google API script'));
      document.body.appendChild(script);
    });
  }

  /**
   * Sign in to Google Drive
   */
  async signIn(): Promise<{ success: boolean; error?: string }> {
    try {
      if (!this.gapi) {
        const initResult = await this.initialize();
        if (!initResult.success) {
          return initResult;
        }
      }

      const authInstance = this.gapi.auth2.getAuthInstance();
      
      if (!authInstance.isSignedIn.get()) {
        await authInstance.signIn();
      }
      
      this.isSignedIn = true;
      return { success: true };

    } catch (error) {
      console.error('Error signing in to Google Drive:', error);
      return { 
        success: false, 
        error: 'Failed to sign in to Google Drive. Please try again.' 
      };
    }
  }

  /**
   * Sign out from Google Drive
   */
  async signOut(): Promise<void> {
    try {
      if (this.gapi && this.isSignedIn) {
        const authInstance = this.gapi.auth2.getAuthInstance();
        await authInstance.signOut();
        this.isSignedIn = false;
      }
    } catch (error) {
      console.error('Error signing out from Google Drive:', error);
    }
  }

  /**
   * Check if user is signed in
   */
  getSignInStatus(): boolean {
    return this.isSignedIn;
  }

  /**
   * Get or create the backup folder
   */
  private async getBackupFolder(): Promise<string | null> {
    try {
      if (this.folderID) {
        return this.folderID;
      }

      // Search for existing folder
      const response = await this.gapi.client.drive.files.list({
        q: `name='${this.FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        spaces: 'drive'
      });

      if (response.result.files && response.result.files.length > 0) {
        this.folderID = response.result.files[0].id;
        return this.folderID;
      }

      // Create folder if it doesn't exist
      const folderResponse = await this.gapi.client.drive.files.create({
        resource: {
          name: this.FOLDER_NAME,
          mimeType: 'application/vnd.google-apps.folder'
        }
      });

      this.folderID = folderResponse.result.id;
      return this.folderID;

    } catch (error) {
      console.error('Error getting/creating backup folder:', error);
      return null;
    }
  }

  /**
   * Upload data to Google Drive
   */
  private async uploadFile(
    fileName: string, 
    data: any, 
    folderId: string
  ): Promise<{ success: boolean; error?: string; fileId?: string }> {
    try {
      const boundary = '-------314159265358979323846';
      const delimiter = "\r\n--" + boundary + "\r\n";
      const close_delim = "\r\n--" + boundary + "--";

      const metadata = {
        name: fileName,
        parents: [folderId]
      };

      const multipartRequestBody =
        delimiter +
        'Content-Type: application/json\r\n\r\n' +
        JSON.stringify(metadata) +
        delimiter +
        'Content-Type: application/json\r\n\r\n' +
        JSON.stringify(data, null, 2) +
        close_delim;

      const request = this.gapi.client.request({
        path: 'https://www.googleapis.com/upload/drive/v3/files',
        method: 'POST',
        params: { uploadType: 'multipart' },
        headers: {
          'Content-Type': 'multipart/related; boundary="' + boundary + '"'
        },
        body: multipartRequestBody
      });

      const response = await request;
      
      return { 
        success: true, 
        fileId: response.result.id 
      };

    } catch (error) {
      console.error('Error uploading file to Google Drive:', error);
      return { 
        success: false, 
        error: 'Failed to upload file to Google Drive' 
      };
    }
  }

  /**
   * Update existing file on Google Drive
   */
  private async updateFile(
    fileId: string, 
    data: any
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const boundary = '-------314159265358979323846';
      const delimiter = "\r\n--" + boundary + "\r\n";
      const close_delim = "\r\n--" + boundary + "--";

      const multipartRequestBody =
        delimiter +
        'Content-Type: application/json\r\n\r\n' +
        JSON.stringify(data, null, 2) +
        close_delim;

      const request = this.gapi.client.request({
        path: `https://www.googleapis.com/upload/drive/v3/files/${fileId}`,
        method: 'PATCH',
        params: { uploadType: 'media' },
        headers: {
          'Content-Type': 'multipart/related; boundary="' + boundary + '"'
        },
        body: multipartRequestBody
      });

      await request;
      return { success: true };

    } catch (error) {
      console.error('Error updating file on Google Drive:', error);
      return { 
        success: false, 
        error: 'Failed to update file on Google Drive' 
      };
    }
  }

  /**
   * Download file from Google Drive
   */
  private async downloadFile(fileId: string): Promise<any | null> {
    try {
      const response = await this.gapi.client.drive.files.get({
        fileId: fileId,
        alt: 'media'
      });

      return JSON.parse(response.body);

    } catch (error) {
      console.error('Error downloading file from Google Drive:', error);
      return null;
    }
  }

  /**
   * Find file in backup folder
   */
  private async findFile(fileName: string): Promise<GoogleDriveFile | null> {
    try {
      const folderId = await this.getBackupFolder();
      if (!folderId) return null;

      const response = await this.gapi.client.drive.files.list({
        q: `name='${fileName}' and parents in '${folderId}' and trashed=false`,
        fields: 'files(id, name, modifiedTime, size)'
      });

      if (response.result.files && response.result.files.length > 0) {
        return response.result.files[0];
      }

      return null;

    } catch (error) {
      console.error('Error finding file on Google Drive:', error);
      return null;
    }
  }

  /**
   * Backup schedules to Google Drive
   */
  async backupSchedules(schedules: SavedSchedule[]): Promise<{ success: boolean; error?: string }> {
    try {
      if (!this.isSignedIn) {
        const signInResult = await this.signIn();
        if (!signInResult.success) {
          return signInResult;
        }
      }

      const folderId = await this.getBackupFolder();
      if (!folderId) {
        return { success: false, error: 'Failed to access backup folder' };
      }

      // Check if file exists
      const existingFile = await this.findFile(this.SCHEDULES_FILE);

      const backupData = {
        version: '1.0',
        timestamp: new Date().toISOString(),
        schedules: schedules
      };

      if (existingFile) {
        // Update existing file
        return await this.updateFile(existingFile.id, backupData);
      } else {
        // Create new file
        const result = await this.uploadFile(this.SCHEDULES_FILE, backupData, folderId);
        return { success: result.success, error: result.error };
      }

    } catch (error) {
      console.error('Error backing up schedules:', error);
      return { success: false, error: 'Failed to backup schedules to Google Drive' };
    }
  }

  /**
   * Backup drafts to Google Drive
   */
  async backupDrafts(drafts: DraftSchedule[]): Promise<{ success: boolean; error?: string }> {
    try {
      if (!this.isSignedIn) {
        const signInResult = await this.signIn();
        if (!signInResult.success) {
          return signInResult;
        }
      }

      const folderId = await this.getBackupFolder();
      if (!folderId) {
        return { success: false, error: 'Failed to access backup folder' };
      }

      // Check if file exists
      const existingFile = await this.findFile(this.DRAFTS_FILE);

      const backupData = {
        version: '1.0',
        timestamp: new Date().toISOString(),
        drafts: drafts
      };

      if (existingFile) {
        // Update existing file
        return await this.updateFile(existingFile.id, backupData);
      } else {
        // Create new file
        const result = await this.uploadFile(this.DRAFTS_FILE, backupData, folderId);
        return { success: result.success, error: result.error };
      }

    } catch (error) {
      console.error('Error backing up drafts:', error);
      return { success: false, error: 'Failed to backup drafts to Google Drive' };
    }
  }

  /**
   * Restore schedules from Google Drive
   */
  async restoreSchedules(): Promise<{ success: boolean; error?: string; schedules?: SavedSchedule[] }> {
    try {
      if (!this.isSignedIn) {
        const signInResult = await this.signIn();
        if (!signInResult.success) {
          return signInResult;
        }
      }

      const file = await this.findFile(this.SCHEDULES_FILE);
      if (!file) {
        return { success: false, error: 'No schedule backup found on Google Drive' };
      }

      const data = await this.downloadFile(file.id);
      if (!data || !data.schedules) {
        return { success: false, error: 'Invalid backup file format' };
      }

      return { 
        success: true, 
        schedules: data.schedules 
      };

    } catch (error) {
      console.error('Error restoring schedules:', error);
      return { success: false, error: 'Failed to restore schedules from Google Drive' };
    }
  }

  /**
   * Restore drafts from Google Drive
   */
  async restoreDrafts(): Promise<{ success: boolean; error?: string; drafts?: DraftSchedule[] }> {
    try {
      if (!this.isSignedIn) {
        const signInResult = await this.signIn();
        if (!signInResult.success) {
          return signInResult;
        }
      }

      const file = await this.findFile(this.DRAFTS_FILE);
      if (!file) {
        return { success: false, error: 'No draft backup found on Google Drive' };
      }

      const data = await this.downloadFile(file.id);
      if (!data || !data.drafts) {
        return { success: false, error: 'Invalid backup file format' };
      }

      return { 
        success: true, 
        drafts: data.drafts 
      };

    } catch (error) {
      console.error('Error restoring drafts:', error);
      return { success: false, error: 'Failed to restore drafts from Google Drive' };
    }
  }

  /**
   * Get backup information
   */
  async getBackupInfo(): Promise<{
    success: boolean;
    error?: string;
    schedules?: { lastModified: string; size: string };
    drafts?: { lastModified: string; size: string };
  }> {
    try {
      if (!this.isSignedIn) {
        return { success: false, error: 'Not signed in to Google Drive' };
      }

      const schedulesFile = await this.findFile(this.SCHEDULES_FILE);
      const draftsFile = await this.findFile(this.DRAFTS_FILE);

      return {
        success: true,
        schedules: schedulesFile ? {
          lastModified: schedulesFile.modifiedTime,
          size: schedulesFile.size
        } : undefined,
        drafts: draftsFile ? {
          lastModified: draftsFile.modifiedTime,
          size: draftsFile.size
        } : undefined
      };

    } catch (error) {
      console.error('Error getting backup info:', error);
      return { success: false, error: 'Failed to get backup information' };
    }
  }

  /**
   * Auto-backup with error handling
   */
  async autoBackup(schedules: SavedSchedule[], drafts: DraftSchedule[]): Promise<void> {
    try {
      if (!this.isSignedIn) {
        return; // Skip auto-backup if not signed in
      }

      // Run backups in parallel
      const [schedulesResult, draftsResult] = await Promise.allSettled([
        this.backupSchedules(schedules),
        this.backupDrafts(drafts)
      ]);

      // Log results for debugging
      if (schedulesResult.status === 'fulfilled' && schedulesResult.value.success) {
        console.log('Schedules auto-backup successful');
      }

      if (draftsResult.status === 'fulfilled' && draftsResult.value.success) {
        console.log('Drafts auto-backup successful');
      }

    } catch (error) {
      console.error('Error during auto-backup:', error);
      // Don't throw - auto-backup should be silent
    }
  }
}

// Export singleton instance
export const googleDriveStorage = new GoogleDriveStorageService();
export default googleDriveStorage;