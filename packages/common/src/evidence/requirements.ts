/**
 * Evidence photo requirements per device type.
 *
 * Shared by the listing form (what to ask the seller for) and Trust Lens (the
 * checklist admins review against), so the two can never disagree. A device
 * without a built-in screen must not be asked for "screen switched on" photos.
 * Dependency-free so the browser bundle can import it.
 */

export type EvidenceRequirementLevel = 'required' | 'optional' | 'hidden';

export interface EvidenceSlotRequirement {
  level: EvidenceRequirementLevel;
  /** Minimum number of photos when the slot is required. */
  minCount: number;
  label: string;
  hint: string;
}

export interface DeviceEvidenceRequirements {
  /** General photos of the device (stored as DEVICE_IMAGE). */
  device: EvidenceSlotRequirement;
  /** Display switched on (stored as SCREEN_IMAGE). */
  screen: EvidenceSlotRequirement;
  /** Model / storage / serial proof (stored as SETTINGS_SCREENSHOT). */
  settings: EvidenceSlotRequirement;
}

const hidden: EvidenceSlotRequirement = { level: 'hidden', minCount: 0, label: '', hint: '' };

const device = (hint: string): EvidenceSlotRequirement => ({
  level: 'required',
  minCount: 3,
  label: 'Device photos',
  hint,
});

const screen = (level: 'required' | 'optional', hint: string): EvidenceSlotRequirement => ({
  level,
  minCount: level === 'required' ? 1 : 0,
  label: 'Screen photo',
  hint,
});

const settings = (label: string, hint: string): EvidenceSlotRequirement => ({
  level: 'optional',
  minCount: 0,
  label,
  hint,
});

export const EVIDENCE_REQUIREMENTS: Record<string, DeviceEvidenceRequirements> = {
  SMARTPHONE: {
    device: device('Front, back and sides in good light, showing any marks.'),
    screen: screen('required', 'Screen switched on, so buyers can see any marks, burn-in or dead pixels.'),
    settings: settings('Settings screenshot', 'Settings → About (phone) showing the model and storage.'),
  },
  TABLET: {
    device: device('Front, back and edges in good light, showing any marks.'),
    screen: screen('required', 'Screen switched on, so buyers can see any marks or dead pixels.'),
    settings: settings('Settings screenshot', 'Settings → About showing the model and storage.'),
  },
  SMARTWATCH: {
    device: device('Face, back (sensor) and strap, showing any marks.'),
    screen: screen('required', 'Watch face switched on.'),
    settings: settings('Settings screenshot', 'Watch Settings → About showing the model.'),
  },
  LAPTOP: {
    device: device('Lid, base, keyboard and ports, showing any marks.'),
    screen: screen('required', 'Screen switched on (desktop or login screen).'),
    settings: settings('System info screenshot', 'About This Mac, or Windows Settings → System → About, showing the specs.'),
  },
  DESKTOP: {
    device: device('Front, back and ports, showing any marks.'),
    screen: screen('optional', 'If a display is included, show it switched on.'),
    settings: settings('System info screenshot', 'About This Mac, or Windows Settings → System → About, showing the specs.'),
  },
  GAMING_CONSOLE: {
    device: device('Console, controllers and ports, showing any marks.'),
    screen: screen('optional', 'Console powered on, showing the home or system screen.'),
    settings: settings('System info photo', 'System settings screen showing the model and storage.'),
  },
  AIRPODS: {
    device: device('Case open and closed, both earbuds, and the charging port.'),
    screen: hidden,
    settings: settings('Serial number photo', 'Inside the case lid, or Bluetooth settings on your paired phone.'),
  },
  OTHER: {
    device: device('All sides in good light, showing any marks.'),
    screen: screen('optional', 'If the device has a screen, show it switched on.'),
    settings: settings('Model or serial photo', 'A label or settings screen showing the model.'),
  },
};

export function getEvidenceRequirements(deviceType: string | null | undefined): DeviceEvidenceRequirements {
  return EVIDENCE_REQUIREMENTS[deviceType ?? ''] ?? EVIDENCE_REQUIREMENTS.OTHER;
}
