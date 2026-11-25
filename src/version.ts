/**
 * Rig 50 SOAR Platform - Version & Deployment Registry
 * This file is updated with each release to verify GitHub -> Hostinger CI/CD synchronization.
 */

export const APP_VERSION = '2.4.0';
export const APP_BUILD_DATE = '2026-10-03';
export const APP_RELEASE_NAME = 'Rig 50 Sentinel • Hostinger CI/CD Ready';
export const APP_RELEASE_TAG = 'v2.4.0-hostinger-sync';

export interface DeploymentDiagnostics {
  appVersion: string;
  buildDate: string;
  releaseTag: string;
  serverVersion?: string;
  serverUptime?: number;
  serverEnvironment?: string;
  isSynced: boolean;
  msFormsReachable: boolean;
  msFormsEndpoint: string;
  lastChecked: string;
}

/**
 * Checks live server status and verifies whether the deployed frontend matches the Hostinger backend
 */
export async function checkDeploymentStatus(): Promise<DeploymentDiagnostics> {
  const diagnostics: DeploymentDiagnostics = {
    appVersion: APP_VERSION,
    buildDate: APP_BUILD_DATE,
    releaseTag: APP_RELEASE_TAG,
    isSynced: false,
    msFormsReachable: false,
    msFormsEndpoint: 'https://forms.cloud.microsoft',
    lastChecked: new Date().toLocaleTimeString()
  };

  try {
    const versionRes = await fetch('/api/version', { cache: 'no-store' });
    if (versionRes.ok) {
      const data = await versionRes.json();
      diagnostics.serverVersion = data.version;
      diagnostics.serverUptime = data.uptime;
      diagnostics.serverEnvironment = data.nodeEnv;
      diagnostics.isSynced = data.version === APP_VERSION;
    }
  } catch {
    // If backend is not reached, isSynced remains false
  }

  try {
    const formCheckRes = await fetch('/api/test-form-connection', { cache: 'no-store' });
    if (formCheckRes.ok) {
      const formData = await formCheckRes.json();
      diagnostics.msFormsReachable = formData.reachable === true;
    }
  } catch {
    // Form check fallback
  }

  return diagnostics;
}
