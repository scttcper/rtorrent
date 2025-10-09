import {
  type NormalizedTorrent,
  TorrentState as NormalizedTorrentState,
} from '@ctrl/shared-torrent';

import type { RTorrentTorrent } from './types.js';

/**
 * Normalizes rTorrent torrent data to the shared torrent format
 * Converts rTorrent-specific fields to the standardized format used across torrent clients
 *
 * @param torrent - rTorrent torrent data
 * @returns Normalized torrent data
 */
export function normalizeTorrentData(torrent: RTorrentTorrent): NormalizedTorrent {
  // Calculate progress percentage
  const progress =
    torrent.sizeBytes > 0 ? Math.round((torrent.bytesDone / torrent.sizeBytes) * 100) / 100 : 0;

  // Determine torrent status based on rTorrent state
  let state = NormalizedTorrentState.unknown;
  let stateMessage = '';

  if (torrent.isComplete) {
    state = NormalizedTorrentState.seeding;
  } else if (torrent.isActive && torrent.downRate > 0) {
    state = NormalizedTorrentState.downloading;
  } else if (torrent.isActive && torrent.upRate > 0) {
    state = NormalizedTorrentState.seeding;
  } else if (torrent.state === 2) {
    // Checking
    state = NormalizedTorrentState.checking;
  } else if (torrent.state === 0) {
    // Stopped
    state = NormalizedTorrentState.paused;
  } else {
    state = NormalizedTorrentState.queued;
  }

  // Calculate ETA in seconds
  const eta =
    torrent.downRate > 0 && torrent.leftBytes > 0
      ? Math.round(torrent.leftBytes / torrent.downRate)
      : 0;

  // Convert ratio from thousandths to decimal
  const ratio = torrent.ratio / 1000;

  // Calculate completion time
  const dateCompleted =
    torrent.finishedTime > 0 ? new Date(torrent.finishedTime * 1000).toISOString() : '';

  // Calculate added time (using creation date as fallback)
  const dateAdded =
    torrent.creationDate > 0
      ? new Date(torrent.creationDate * 1000).toISOString()
      : new Date().toISOString();

  const isCompleted = torrent.isComplete;

  return {
    id: torrent.hash,
    name: torrent.name,
    stateMessage,
    state,
    eta,
    dateAdded,
    isCompleted,
    progress,
    label: torrent.custom1 || '',
    tags: [],
    dateCompleted,
    savePath: torrent.basePath,
    uploadSpeed: torrent.upRate,
    downloadSpeed: torrent.downRate,
    queuePosition: torrent.priority,
    connectedPeers: torrent.peersConnected,
    connectedSeeds: torrent.peersComplete,
    totalPeers: torrent.peersAccounted,
    totalSeeds: torrent.peersComplete,
    totalSelected: torrent.bytesDone,
    totalSize: torrent.sizeBytes,
    totalUploaded: torrent.upTotal,
    totalDownloaded: torrent.bytesDone,
    ratio,
    raw: torrent,
  };
}
