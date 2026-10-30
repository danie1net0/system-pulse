import type Adw from 'gi://Adw';
import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';
import {fillPreferences} from './ui/preferences.ts';

export default class SystemPulsePreferences extends ExtensionPreferences {
    override async fillPreferencesWindow(window: Adw.PreferencesWindow): Promise<void> {
        fillPreferences(window, this.getSettings());
    }
}
