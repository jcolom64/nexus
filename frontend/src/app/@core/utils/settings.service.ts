import { Injectable } from '@angular/core';
import { NbThemeService } from '@nebular/theme';

export interface AppSettings {
  theme: string;
  sidebarCollapsed: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class SettingsService {
  
  private readonly STORAGE_KEY = 'nexus-app-settings';
  
  private defaultSettings: AppSettings = {
    theme: 'default',
    sidebarCollapsed: false
  };

  constructor(
    private themeService: NbThemeService
  ) {
    this.loadAndApplySettings();
  }

  /**
   * Load settings from localStorage and apply them to the application
   */
  private loadAndApplySettings(): void {
    const settings = this.getSettings();
    
    // Apply theme
    this.themeService.changeTheme(settings.theme);
  }

  /**
   * Get current settings from localStorage or return defaults
   */
  getSettings(): AppSettings {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const parsedSettings = JSON.parse(stored);
        // Merge with defaults to ensure all properties exist
        return { ...this.defaultSettings, ...parsedSettings };
      }
    } catch (error) {
      console.warn('Failed to load settings from localStorage:', error);
    }
    
    return { ...this.defaultSettings };
  }

  /**
   * Save settings to localStorage
   */
  private saveSettings(settings: AppSettings): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(settings));
    } catch (error) {
      console.error('Failed to save settings to localStorage:', error);
    }
  }

  /**
   * Update theme setting and persist
   */
  setTheme(themeName: string): void {
    const settings = this.getSettings();
    settings.theme = themeName;
    this.saveSettings(settings);
    this.themeService.changeTheme(themeName);
  }

  /**
   * Update sidebar collapsed state and persist
   */
  setSidebarCollapsed(collapsed: boolean): void {
    const settings = this.getSettings();
    settings.sidebarCollapsed = collapsed;
    this.saveSettings(settings);
  }

  /**
   * Reset all settings to defaults
   */
  resetSettings(): void {
    localStorage.removeItem(this.STORAGE_KEY);
    this.loadAndApplySettings();
  }

  /**
   * Get current theme
   */
  getCurrentTheme(): string {
    return this.getSettings().theme;
  }

  /**
   * Get current sidebar state
   */
  getSidebarCollapsed(): boolean {
    return this.getSettings().sidebarCollapsed;
  }
}