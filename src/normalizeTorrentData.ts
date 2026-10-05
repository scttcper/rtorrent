import { dirname } from 'node:path/posix';

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
  const progress = torrent.sizeBytes > 0 ? torrent.bytesDone / torrent.sizeBytes : 0;

  // rTorrent has no queue. d.state is 0 stopped or 1 started, a started torrent is paused when it is not active
  let state = NormalizedTorrentState.paused;
  if (torrent.hashing > 0) {
    state = NormalizedTorrentState.checking;
  } else if (torrent.state === 1 && torrent.isActive) {
    state = torrent.isComplete
      ? NormalizedTorrentState.seeding
      : NormalizedTorrentState.downloading;
  }

  // Calculate ETA in seconds
  const eta =
    torrent.downRate > 0 && torrent.leftBytes > 0
      ? Math.round(torrent.leftBytes / torrent.downRate)
      : 0;

  // Convert ratio from thousandths to decimal
  const ratio = torrent.ratio / 1000;

  const dateCompleted =
    torrent.finishedTime > 0 ? new Date(torrent.finishedTime * 1000).toISOString() : undefined;
  const dateAdded = new Date(torrent.loadDate * 1000).toISOString();

  const isCompleted = torrent.isComplete;

  // d.directory includes the torrent's folder for multi-file torrents, use the parent to match single-file torrents
  const savePath = torrent.isMultiFile ? dirname(torrent.basePath) : torrent.basePath;

  return {
    id: torrent.hash.toLowerCase(),
    name: torrent.name,
    stateMessage: torrent.message,
    state,
    eta,
    dateAdded,
    isCompleted,
    progress,
    label: torrent.custom1 || '',
    tags: [],
    dateCompleted,
    savePath,
    uploadSpeed: torrent.upRate,
    downloadSpeed: torrent.downRate,
    // rTorrent has no queue, priority is available in raw
    queuePosition: 0,
    connectedPeers: torrent.peersConnected,
    connectedSeeds: torrent.peersComplete,
    totalPeers: torrent.peersAccounted,
    totalSeeds: torrent.peersComplete,
    totalSelected: torrent.sizeBytes,
    totalSize: torrent.sizeBytes,
    totalUploaded: torrent.upTotal,
    totalDownloaded: torrent.bytesDone,
    ratio,
    raw: torrent,
  };
}
