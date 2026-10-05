import { readFileSync } from 'node:fs';
import path from 'node:path';
import { setTimeout } from 'node:timers/promises';

import { TorrentState } from '@ctrl/shared-torrent';
import pWaitFor from 'p-wait-for';
import { afterEach, expect, it } from 'vitest';

import {
  RTorrent,
  RTorrentFilePriority,
  RTorrentPriority,
  RTorrentTrackerType,
} from '../src/index.js';

const baseUrl = 'http://localhost:8080';
const torrentName = 'ubuntu-18.04.1-desktop-amd64.iso';
const __dirname = new URL('.', import.meta.url).pathname;
const torrentFilePath = path.join(__dirname, 'ubuntu-18.04.1-desktop-amd64.iso.torrent');
const torrentFileBuffer = readFileSync(torrentFilePath);
// private torrent with a dead tracker and 3 files: a.txt, b.txt, sub/c.txt
const multiFileName = 'ctrl-rqbit-multi';
const multiFileHash = '893B9365EE2B98751C41A2B59296BEF747532221';
const multiFileBuffer = readFileSync(path.join(__dirname, 'multi-file.torrent'));
const magnet =
  'magnet:?xt=urn:btih:B0B81206633C42874173D22E564D293DAEFC45E2&dn=Ubuntu+11+10+Alternate+Amd64+Iso&tr=udp%3A%2F%2Ftracker.coppersurfer.tk%3A6969%2Fannounce&tr=udp%3A%2F%2F9.rarbg.to%3A2710%2Fannounce&tr=udp%3A%2F%2Ftracker.opentrackr.org%3A1337%2Fannounce&tr=udp%3A%2F%2Ftracker.leechers-paradise.org%3A6969%2Fannounce&tr=udp%3A%2F%2Ftracker.open-internet.nl%3A6969%2Fannounce&tr=udp%3A%2F%2Fopen.demonii.si%3A1337%2Fannounce&tr=udp%3A%2F%2Ftracker.pirateparty.gr%3A6969%2Fannounce&tr=udp%3A%2F%2Fdenis.stalker.upeer.me%3A6969%2Fannounce&tr=udp%3A%2F%2Fp4p.arenabg.com%3A1337%2Fannounce&tr=udp%3A%2F%2Fexodus.desync.com%3A6969%2Fannounce';

async function waitForTorrent(client: RTorrent, count = 1) {
  await pWaitFor(
    async () => {
      const torrents = await client.getAllTorrents();
      return torrents.length === count;
    },
    { timeout: 10_000 },
  );
}

/**
 * Adds torrent and returns hash
 * @returns torrent hash id
 */
async function setupTorrent(client: RTorrent): Promise<string> {
  await client.addTorrentFromFile(torrentFileBuffer);
  await waitForTorrent(client);
  // Add delay after torrent operations
  await setTimeout(300);
  const torrents = await client.getAllTorrents();
  return torrents[0]!.hash;
}

/**
 * Adds the ubuntu and multi-file torrents
 */
async function setupTwoTorrents(client: RTorrent) {
  await client.addTorrentFromFile(torrentFileBuffer);
  await client.addTorrentFromFile(multiFileBuffer, { start: false });
  await waitForTorrent(client, 2);
  await setTimeout(300);
}

afterEach(async () => {
  const client = new RTorrent({ baseUrl });
  const torrents = await client.getAllTorrents();
  for (const torrent of torrents) {
    // clean up all torrents
    await client.removeTorrent(torrent.hash, false);
  }
  // Add delay to prevent connection issues
  await setTimeout(500);
});

it('should be instantiable', () => {
  const client = new RTorrent({ baseUrl });
  expect(client).toBeInstanceOf(RTorrent);
});

it('should have config', () => {
  const client = new RTorrent({ baseUrl });
  expect(client.config.baseUrl).toBe(baseUrl);
});

it('should export state', () => {
  const client = new RTorrent({ baseUrl });
  const state = client.exportState();
  expect(state).toBeDefined();
});

it('should get version', async () => {
  const client = new RTorrent({ baseUrl });
  const version = await client.getVersion();
  expect(version).toBeTruthy();
  expect(typeof version).toBe('string');
});

it('should get system info', async () => {
  const client = new RTorrent({ baseUrl });
  const systemInfo = await client.getSystemInfo();
  expect(systemInfo.clientVersion).toBeTruthy();
  expect(systemInfo.libraryVersion).toBeTruthy();
  expect(systemInfo.apiVersion).toBeTruthy();
  expect(typeof systemInfo.apiVersion).toBe('string');
});

it('should add torrent from buffer', async () => {
  const client = new RTorrent({ baseUrl });
  const res = await client.addTorrentFromFile(torrentFileBuffer);
  expect(res).toBe(true);
  await waitForTorrent(client);
  const torrents = await client.getAllTorrents();
  expect(torrents.length).toBe(1);
  // Add delay after test
  await setTimeout(500);
});

it('should add torrent with label', async () => {
  const client = new RTorrent({ baseUrl });
  const res = await client.addTorrentFromFile(torrentFileBuffer, {
    label: 'swag',
  });
  expect(res).toBe(true);
  await waitForTorrent(client);
  const torrents = await client.getAllTorrents();
  expect(torrents.length).toBe(1);
  expect(torrents[0]!.custom1).toBe('swag');
  // Add delay after test
  await setTimeout(500);
});

it('should add torrent with priority', async () => {
  const client = new RTorrent({ baseUrl });
  const res = await client.addTorrentFromFile(torrentFileBuffer, {
    priority: RTorrentPriority.High,
  });
  expect(res).toBe(true);
  await waitForTorrent(client);
  const torrents = await client.getAllTorrents();
  expect(torrents.length).toBe(1);
  expect(torrents[0]!.priority).toBe(RTorrentPriority.High);
  // Add delay after test
  await setTimeout(500);
});

it('should add torrent with directory', async () => {
  const client = new RTorrent({ baseUrl });
  const directory = '/downloads/linux/';
  const res = await client.addTorrentFromFile(torrentFileBuffer, {
    directory,
    start: false,
  });
  expect(res).toBe(true);
  await waitForTorrent(client);
  const torrents = await client.getAllTorrents();
  expect(torrents.length).toBe(1);
  // rTorrent returns path without trailing slash
  expect(torrents[0]!.basePath).toBe('/downloads/linux');
  // Add delay after test
  await setTimeout(500);
});

it('should add magnet link', async () => {
  const client = new RTorrent({ baseUrl });
  const res = await client.addTorrentFromUrl(magnet);
  expect(res).toBe(true);
  // Add delay after test
  await setTimeout(500);
});

it('should get torrent properties', async () => {
  const client = new RTorrent({ baseUrl });
  const torrentId = await setupTorrent(client);
  const res = await client.getTorrentProperties(torrentId);
  expect(res.name).toBe(torrentName);
  expect(res.hash).toBe(torrentId);
});

it('should get torrent files', async () => {
  const client = new RTorrent({ baseUrl });
  const torrentId = await setupTorrent(client);
  const res = await client.getTorrentFiles(torrentId);
  expect(Array.isArray(res)).toBeTruthy();
});

it('should get torrent trackers', async () => {
  const client = new RTorrent({ baseUrl });
  const torrentId = await setupTorrent(client);
  const res = await client.getTorrentTrackers(torrentId);
  expect(Array.isArray(res)).toBeTruthy();
});

it('should get torrent peers', async () => {
  const client = new RTorrent({ baseUrl });
  const torrentId = await setupTorrent(client);
  const res = await client.getTorrentPeers(torrentId);
  expect(Array.isArray(res)).toBeTruthy();
});

it('should pause/resume torrent', async () => {
  const client = new RTorrent({ baseUrl });
  const torrentId = await setupTorrent(client);
  expect(await client.pauseTorrent(torrentId)).toBeTruthy();
  expect(await client.resumeTorrent(torrentId)).toBeTruthy();
});

it('should set torrent priority', async () => {
  const client = new RTorrent({ baseUrl });
  const torrentId = await setupTorrent(client);
  expect(await client.setTorrentPriority(torrentId, RTorrentPriority.High)).toBe(true);
  expect(await client.setTorrentPriority(torrentId, RTorrentPriority.Low)).toBe(true);
});

it('should set torrent label', async () => {
  const client = new RTorrent({ baseUrl });
  const torrentId = await setupTorrent(client);
  expect(await client.setTorrentLabel(torrentId, 'movies')).toBe(true);
  const torrent = await client.getTorrentRaw(torrentId);
  expect(torrent?.custom1).toBe('movies');
});

it('should get views', async () => {
  const client = new RTorrent({ baseUrl });
  const views = await client.getViews();
  expect(Array.isArray(views)).toBeTruthy();
});

it('should add torrent to view', async () => {
  const client = new RTorrent({ baseUrl });
  const torrentId = await setupTorrent(client);
  expect(await client.addTorrentToView(torrentId, 'completed')).toBe(true);
});

it('should remove torrent from view', async () => {
  const client = new RTorrent({ baseUrl });
  const torrentId = await setupTorrent(client);
  await client.addTorrentToView(torrentId, 'completed');
  expect(await client.removeTorrentFromView(torrentId, 'completed')).toBe(true);
});

it('should check if torrent exists', async () => {
  const client = new RTorrent({ baseUrl });
  const torrentId = await setupTorrent(client);
  expect(await client.hasTorrent(torrentId)).toBe(true);
  expect(await client.hasTorrent('nonexistent')).toBe(false);
});

it('should return normalized torrent data', async () => {
  const client = new RTorrent({ baseUrl });
  await setupTorrent(client);
  const res = await client.getAllData();
  const torrent = res.torrents[0]!;

  // Basic identity
  expect(torrent.name).toBe(torrentName);
  expect(torrent.id).toBeTruthy();

  // Core state and speeds
  expect(torrent.state).toBeDefined();
  expect(typeof torrent.state).toBe('string');
  expect(typeof torrent.uploadSpeed).toBe('number');
  expect(typeof torrent.downloadSpeed).toBe('number');

  // Sizes and progress
  expect(typeof torrent.totalSize).toBe('number');
  expect(typeof torrent.totalDownloaded).toBe('number');
  expect(typeof torrent.totalUploaded).toBe('number');
  expect(typeof torrent.progress).toBe('number');
  expect(torrent.progress).toBeGreaterThanOrEqual(0);
  expect(torrent.progress).toBeLessThanOrEqual(1);

  // Paths and metadata
  expect(typeof torrent.savePath).toBe('string');
  expect(Array.isArray(torrent.tags)).toBe(true);
  expect(typeof torrent.dateAdded).toBe('string');
  expect(torrent.dateCompleted).toBeUndefined();
  expect(typeof torrent.label).toBe('string');

  // Peers and queue
  expect(typeof torrent.connectedPeers).toBe('number');
  expect(typeof torrent.connectedSeeds).toBe('number');
  expect(typeof torrent.totalPeers).toBe('number');
  expect(typeof torrent.totalSeeds).toBe('number');
  expect(typeof torrent.queuePosition).toBe('number');

  // Ratio
  expect(typeof torrent.ratio).toBe('number');
  expect(torrent.ratio).toBeGreaterThanOrEqual(0);
});

it('should add normalized torrent', async () => {
  const client = new RTorrent({ baseUrl });
  const torrent = await client.normalizedAddTorrent(torrentFileBuffer, {
    startPaused: true,
    label: 'swag',
  });
  expect(torrent.name).toBe(torrentName);
  expect(torrent.label).toBe('swag');
  expect(torrent.id).toBeTruthy();
  // Add delay after test
  await setTimeout(500);
}, 20_000);

it('should be able to export and create from state', async () => {
  const client = new RTorrent({ baseUrl });
  const state = client.exportState();
  const client2 = RTorrent.createFromState(client.config, state);
  expect(client2).toBeDefined();
  expect(client2.state).toBeDefined();
});

it('should get multiple torrents', async () => {
  const client = new RTorrent({ baseUrl });
  await setupTwoTorrents(client);
  const torrents = await client.getAllTorrents();
  expect(torrents.map(t => t.name).toSorted()).toEqual([multiFileName, torrentName]);

  const torrent = await client.getTorrent(multiFileHash);
  expect(torrent.id).toBe(multiFileHash.toLowerCase());
  expect(torrent.name).toBe(multiFileName);
  expect(torrent.totalSize).toBe(70_000);

  const data = await client.getAllData();
  expect(data.torrents).toHaveLength(2);
  expect(data.raw).toHaveLength(2);
});

it('should use the same savePath for single and multi-file torrents', async () => {
  const client = new RTorrent({ baseUrl });
  await setupTwoTorrents(client);
  const multi = await client.getTorrentRaw(multiFileHash);
  expect(multi?.isMultiFile).toBe(true);
  expect(multi?.basePath).toBe(`/downloads/incoming/${multiFileName}`);

  const { torrents } = await client.getAllData();
  expect(torrents.map(t => t.savePath)).toEqual(['/downloads/incoming', '/downloads/incoming']);
});

it('should not coerce or trim labels', async () => {
  const client = new RTorrent({ baseUrl });
  await client.addTorrentFromFile(torrentFileBuffer, { label: '007' });
  await client.addTorrentFromFile(multiFileBuffer, { start: false });
  await waitForTorrent(client, 2);
  expect(await client.setTorrentLabel(multiFileHash, '  spaced  ')).toBe(true);

  const { torrents, labels } = await client.getAllData();
  expect(torrents.map(t => t.label).toSorted()).toEqual(['  spaced  ', '007']);
  expect(labels.map(l => l.name).toSorted()).toEqual(['  spaced  ', '007']);
});

it('should get files of a multi-file torrent', async () => {
  const client = new RTorrent({ baseUrl });
  await setupTwoTorrents(client);
  const files = await client.getTorrentFiles(multiFileHash);
  expect(files).toEqual([
    {
      index: 0,
      path: 'a.txt',
      size: 40_000,
      priority: RTorrentFilePriority.Normal,
      isCompleted: false,
      completedChunks: 0,
      totalChunks: 3,
    },
    {
      index: 1,
      path: 'b.txt',
      size: 20_000,
      priority: RTorrentFilePriority.Normal,
      isCompleted: false,
      completedChunks: 0,
      totalChunks: 2,
    },
    {
      index: 2,
      path: 'sub/c.txt',
      size: 10_000,
      priority: RTorrentFilePriority.Normal,
      isCompleted: false,
      completedChunks: 0,
      totalChunks: 2,
    },
  ]);
});

it('should set file priority', async () => {
  const client = new RTorrent({ baseUrl });
  await setupTwoTorrents(client);
  expect(await client.setFilePriority(multiFileHash, 1, RTorrentFilePriority.Off)).toBe(true);
  expect(await client.setFilePriority(multiFileHash, 2, RTorrentFilePriority.High)).toBe(true);
  const files = await client.getTorrentFiles(multiFileHash);
  expect(files.map(f => f.priority)).toEqual([
    RTorrentFilePriority.Normal,
    RTorrentFilePriority.Off,
    RTorrentFilePriority.High,
  ]);
});

it('should get and disable trackers', async () => {
  const client = new RTorrent({ baseUrl });
  const torrentId = await setupTorrent(client);
  const trackers = await client.getTorrentTrackers(torrentId);
  expect(trackers.map(t => t.url)).toEqual([
    'http://torrent.ubuntu.com:6969/announce',
    'http://ipv6.torrent.ubuntu.com:6969/announce',
    'dht://',
  ]);
  expect(trackers[0]).toMatchObject({
    index: 0,
    type: RTorrentTrackerType.Http,
    isEnabled: true,
  });
  expect(trackers[2]!.type).toBe(RTorrentTrackerType.Dht);
  for (const tracker of trackers) {
    expect(typeof tracker.peers).toBe('number');
    expect(typeof tracker.seeds).toBe('number');
    expect(typeof tracker.leechers).toBe('number');
    expect(typeof tracker.completed).toBe('number');
    expect(typeof tracker.failedCounter).toBe('number');
  }

  expect(await client.setTrackerEnabled(torrentId, 0, false)).toBe(true);
  const updated = await client.getTorrentTrackers(torrentId);
  expect(updated.map(t => t.isEnabled)).toEqual([false, true, true]);
});

it('should get view counts', async () => {
  const client = new RTorrent({ baseUrl });
  await setupTwoTorrents(client);
  const views = await client.getViews();
  expect(views.find(v => v.name === 'main')?.count).toBe(2);
  expect(views.find(v => v.name === 'started')?.count).toBe(1);
  expect(views.find(v => v.name === 'stopped')?.count).toBe(1);
});

it('should resume torrents stopped or paused with d.pause', async () => {
  const client = new RTorrent({ baseUrl });
  const torrentId = await setupTorrent(client);
  expect(await client.pauseTorrent(torrentId)).toBe(true);
  expect((await client.getTorrent(torrentId)).state).toBe(TorrentState.paused);
  expect(await client.resumeTorrent(torrentId)).toBe(true);
  expect((await client.getTorrentRaw(torrentId))?.isActive).toBe(true);

  // ruTorrent's pause button uses d.pause, which d.start does not undo
  await client['xmlRpcRequest']({ methodName: 'd.pause', params: [torrentId] });
  expect((await client.getTorrent(torrentId)).state).toBe(TorrentState.paused);
  expect(await client.resumeTorrent(torrentId)).toBe(true);
  expect((await client.getTorrentRaw(torrentId))?.isActive).toBe(true);
});

it('should check hash', async () => {
  const client = new RTorrent({ baseUrl });
  const torrentId = await setupTorrent(client);
  expect(await client.checkHash(torrentId)).toBe(true);
});

it('should get torrent rate limits from its throttle group', async () => {
  const client = new RTorrent({ baseUrl });
  await setupTwoTorrents(client);

  // torrents without a throttle group use the global limit
  expect(await client.getDownloadRateLimit(multiFileHash)).toBe(
    await client.getGlobalDownloadRateLimit(),
  );
  expect(await client.getUploadRateLimit(multiFileHash)).toBe(
    await client.getGlobalUploadRateLimit(),
  );

  expect(await client.setThrottleGroup('ctrl-slow', 100, 50)).toBe(true);
  expect(await client.setTorrentThrottle(multiFileHash, 'ctrl-slow')).toBe(true);
  expect((await client.getTorrentRaw(multiFileHash))?.throttleName).toBe('ctrl-slow');
  expect(await client.getDownloadRateLimit(multiFileHash)).toBe(100 * 1024);
  expect(await client.getUploadRateLimit(multiFileHash)).toBe(50 * 1024);
});

it('should set global rate limits', async () => {
  const client = new RTorrent({ baseUrl });
  const download = await client.getGlobalDownloadRateLimit();
  const upload = await client.getGlobalUploadRateLimit();
  try {
    expect(await client.setGlobalDownloadRateLimit(200 * 1024)).toBe(true);
    expect(await client.setGlobalUploadRateLimit(100 * 1024)).toBe(true);
    expect(await client.getGlobalDownloadRateLimit()).toBe(200 * 1024);
    expect(await client.getGlobalUploadRateLimit()).toBe(100 * 1024);
  } finally {
    await client.setGlobalDownloadRateLimit(download);
    await client.setGlobalUploadRateLimit(upload);
  }
});
