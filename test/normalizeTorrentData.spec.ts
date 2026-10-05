import { TorrentState } from '@ctrl/shared-torrent';
import { describe, expect, it } from 'vitest';

import { normalizeTorrentData, type RTorrentTorrent } from '../src/index.js';

// captured from getTorrentRaw on linuxserver/rutorrent
const started: RTorrentTorrent = {
  name: 'ubuntu-18.04.1-desktop-amd64.iso',
  hash: 'E84213A794F3CCD890382A54A64CA68B7E925433',
  basePath: '/downloads/incoming',
  custom1: '',
  sizeBytes: 1_953_349_632,
  leftBytes: 1_953_349_632,
  downRate: 0,
  ratio: 0,
  isOpen: true,
  isActive: true,
  isComplete: false,
  finishedTime: 0,
  state: 1,
  upRate: 0,
  priority: 2,
  peersConnected: 0,
  peersAccounted: 0,
  peersComplete: 0,
  creationDate: 1_532_624_126,
  isPrivate: false,
  isMultiFile: false,
  chunkSize: 524_288,
  completedChunks: 0,
  sizeChunks: 3726,
  bytesDone: 0,
  upTotal: 0,
  freeDiskspace: 450_397_405_184,
  throttleName: '',
  custom2: '',
  message:
    'Tracker: [Failure reason "Requested download is not authorized for use with this tracker."]',
  trackerFocus: 3,
  stateChanged: 1_791_170_471,
  skipTotal: 0,
  hashing: 0,
  chunksHashed: 3726,
  loadDate: 1_791_170_471,
  views: [],
};

describe('normalizeTorrentData', () => {
  it('should normalize a started torrent', () => {
    const result = normalizeTorrentData(started);
    expect(result).toMatchObject({
      id: 'e84213a794f3ccd890382a54a64ca68b7e925433',
      state: TorrentState.downloading,
      stateMessage: started.message,
      progress: 0,
      dateAdded: new Date(1_791_170_471 * 1000).toISOString(),
      dateCompleted: undefined,
      queuePosition: 0,
      eta: -1,
      label: undefined,
      connectedPeers: 0,
      totalPeers: 0,
      totalSeeds: 0,
      totalSelected: 1_953_349_632,
      totalSize: 1_953_349_632,
    });
  });

  it('should use the load date instead of the .torrent creation date', () => {
    expect(normalizeTorrentData(started).dateAdded).not.toBe(
      new Date(started.creationDate * 1000).toISOString(),
    );
  });

  it('should treat stopped and inactive started torrents as paused', () => {
    expect(normalizeTorrentData({ ...started, state: 0, isActive: false }).state).toBe(
      TorrentState.paused,
    );
    expect(normalizeTorrentData({ ...started, isActive: false }).state).toBe(TorrentState.paused);
  });

  it('should normalize a hashing torrent as checking', () => {
    expect(normalizeTorrentData({ ...started, hashing: 1 }).state).toBe(TorrentState.checking);
  });

  it('should normalize a complete active torrent as seeding', () => {
    const result = normalizeTorrentData({
      ...started,
      isComplete: true,
      leftBytes: 0,
      bytesDone: 1_953_349_632,
      finishedTime: 1_791_171_000,
    });
    expect(result.state).toBe(TorrentState.seeding);
    expect(result.progress).toBe(1);
    expect(result.dateCompleted).toBe(new Date(1_791_171_000 * 1000).toISOString());
  });

  it('should not round progress', () => {
    expect(normalizeTorrentData({ ...started, bytesDone: 33_341_497 }).progress).toBeCloseTo(
      0.01707,
      5,
    );
  });

  it('should use the parent of d.directory as savePath for multi-file torrents', () => {
    const result = normalizeTorrentData({
      ...started,
      basePath: '/downloads/incoming/ctrl-rqbit-multi',
      isMultiFile: true,
    });
    expect(result.savePath).toBe('/downloads/incoming');
    expect(normalizeTorrentData(started).savePath).toBe('/downloads/incoming');
  });
});
