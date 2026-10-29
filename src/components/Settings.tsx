import React, { useEffect, useState } from 'react';
import { Settings as SettingsIcon, RefreshCw, Download, RotateCw, GitBranch, ExternalLink } from 'lucide-react';
import type { DesktopUpdateState } from '../types';

const REPOSITORY_URL = 'https://github.com/rajat2859/Dev-Utility-tool';
const RELEASES_URL = `${REPOSITORY_URL}/releases`;

const UPDATE_STATUS_LABELS: Record<DesktopUpdateState['status'], string> = {
  idle: 'Not checked yet',
  checking: 'Checking for updates…',
  downloading: 'Downloading update…',
  'up-to-date': 'You are on the latest version',
  'ready-to-install': 'Update downloaded and ready to install',
  error: 'Update check failed',
};

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 border-b border-slate-100 last:border-b-0">
      <dt className="text-xs font-medium text-slate-500">{label}</dt>
      <dd className="text-xs font-semibold text-slate-900 text-right min-w-0 break-words">{children}</dd>
    </div>
  );
}

export default function Settings() {
  const [updateState, setUpdateState] = useState<DesktopUpdateState | null>(null);
  const desktopUpdater = window.desktopUpdater;

  useEffect(() => {
    if (!desktopUpdater) return;
    desktopUpdater.getState().then(setUpdateState);
    return desktopUpdater.onStateChange(setUpdateState);
  }, [desktopUpdater]);

  const isBusy = updateState?.status === 'checking' || updateState?.status === 'downloading';
  const isReadyToInstall = updateState?.status === 'ready-to-install';
  const canUpdate = Boolean(updateState?.isSupported);

  const handleUpdateClick = () => {
    if (!desktopUpdater) return;
    if (isReadyToInstall) desktopUpdater.installUpdate();
    else desktopUpdater.checkForUpdates().then(setUpdateState);
  };

  const ButtonIcon = isReadyToInstall ? RotateCw : isBusy ? RefreshCw : Download;
  const buttonLabel = isReadyToInstall ? 'Restart & install update' : isBusy ? UPDATE_STATUS_LABELS[updateState!.status] : 'Check for updates';

  let unavailableReason: string | null = null;
  if (!desktopUpdater) unavailableReason = 'Updates are only available in the desktop app.';
  else if (updateState && !updateState.isSupported) unavailableReason = 'Updates are only available in the installed desktop app, not in development.';

  return (
    <div className="max-w-2xl space-y-4 text-slate-900">
      <div className="flex items-center gap-2.5">
        <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl border border-blue-100 shadow-2xs">
          <SettingsIcon className="h-4 w-4" />
        </div>
        <div>
          <h2 className="text-base font-semibold tracking-tight">Settings</h2>
          <p className="text-xs text-slate-500 font-medium">App updates and repository info</p>
        </div>
      </div>

      <section className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xs">
        <h3 className="text-sm font-semibold tracking-tight">Updates</h3>
        <dl className="mt-2">
          <InfoRow label="Current version">{updateState?.currentVersion ?? '—'}</InfoRow>
          <InfoRow label="Latest version">{updateState?.latestVersion ?? '—'}</InfoRow>
          <InfoRow label="Status">
            {updateState ? UPDATE_STATUS_LABELS[updateState.status] : '—'}
            {updateState?.status === 'downloading' && ` (${updateState.downloadPercent}%)`}
          </InfoRow>
          <InfoRow label="Last checked">
            {updateState?.lastCheckedAt ? new Date(updateState.lastCheckedAt).toLocaleString() : '—'}
          </InfoRow>
        </dl>

        {updateState?.status === 'error' && (
          <p role="alert" className="mt-3 text-xs text-red-600 break-words">{updateState.errorMessage}</p>
        )}
        {unavailableReason && <p className="mt-3 text-xs text-slate-500">{unavailableReason}</p>}

        <button
          onClick={handleUpdateClick}
          disabled={!canUpdate || isBusy}
          className="mt-4 px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 shadow-2xs cursor-pointer transition-colors bg-blue-600 text-white hover:bg-blue-800 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed"
        >
          <ButtonIcon className={`h-3.5 w-3.5 ${isBusy ? 'animate-spin motion-reduce:animate-none' : ''}`} />
          {buttonLabel}
        </button>
      </section>

      <section className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xs">
        <h3 className="text-sm font-semibold tracking-tight">Repository</h3>
        <dl className="mt-2">
          <InfoRow label="Source">
            <a href={REPOSITORY_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-800 hover:underline">
              <GitBranch className="h-3.5 w-3.5" />
              rajat2859/Dev-Utility-tool
            </a>
          </InfoRow>
          <InfoRow label="Releases">
            <a href={RELEASES_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-800 hover:underline">
              View all releases
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </InfoRow>
        </dl>
      </section>
    </div>
  );
}
