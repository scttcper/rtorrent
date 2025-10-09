import { readFileSync } from 'node:fs';
import path from 'node:path';

import pWaitFor from 'p-wait-for';
import { afterEach, expect, it } from 'vitest';

import { RTorrent, RTorrentPriority } from '../src/index.js';

const baseUrl = 'http://localhost:8080';
const torrentName = 'ubuntu-18.04.1-desktop-amd64.iso';
const __dirname = new URL('.', import.meta.url).pathname;
const torrentFilePath = path.join(__dirname, 'ubuntu-18.04.1-desktop-amd64.iso.torrent');
const torrentFileBuffer = readFileSync(torrentFilePath);
const username = 'admin';
const password = 'admin';
const magnet =
  'magnet:?xt=urn:btih:B0B81206633C42874173D22E564D293DAEFC45E2&dn=Ubuntu+11+10+Alternate+Amd64+Iso&tr=udp%3A%2F%2Ftracker.coppersurfer.tk%3A6969%2Fannounce&tr=udp%3A%2F%2F9.rarbg.to%3A2710%2Fannounce&tr=udp%3A%2F%2Ftracker.opentrackr.org%3A1337%2Fannounce&tr=udp%3A%2F%2Ftracker.leechers-paradise.org%3A6969%2Fannounce&tr=udp%3A%2F%2Ftracker.open-internet.nl%3A6969%2Fannounce&tr=udp%3A%2F%2Fopen.demonii.si%3A1337%2Fannounce&tr=udp%3A%2F%2Ftracker.pirateparty.gr%3A6969%2Fannounce&tr=udp%3A%2F%2Fdenis.stalker.upeer.me%3A6969%2Fannounce&tr=udp%3A%2F%2Fp4p.arenabg.com%3A1337%2Fannounce&tr=udp%3A%2F%2Fexodus.desync.com%3A6969%2Fannounce';

async function waitForTorrent(client: RTorrent) {
  await pWaitFor(
    async () => {
      const torrents = await client.getAllTorrents();
      return torrents.length === 1;
    },
    { timeout: 10000 },
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
  await new Promise(resolve => setTimeout(resolve, 300));
  const torrents = await client.getAllTorrents();
  return torrents[0]!.hash;
}

afterEach(async () => {
  const client = new RTorrent({ baseUrl, username, password });
  const torrents = await client.getAllTorrents();
  for (const torrent of torrents) {
    // clean up all torrents
    await client.removeTorrent(torrent.hash, false);
  }
  // Add delay to prevent connection issues
  await new Promise(resolve => setTimeout(resolve, 500));
});

it('should be instantiable', () => {
  const client = new RTorrent({ baseUrl, username, password });
  expect(client).toBeInstanceOf(RTorrent);
});

it('should have config', () => {
  const client = new RTorrent({ baseUrl, username, password });
  expect(client.config.baseUrl).toBe(baseUrl);
});

it('should export state', () => {
  const client = new RTorrent({ baseUrl, username, password });
  const state = client.exportState();
  expect(state).toBeDefined();
});

it('should get version', async () => {
  const client = new RTorrent({ baseUrl, username, password });
  const version = await client.getVersion();
  expect(version).toBeTruthy();
  expect(typeof version).toBe('string');
});

it('should get system info', async () => {
  const client = new RTorrent({ baseUrl, username, password });
  const systemInfo = await client.getSystemInfo();
  expect(systemInfo.clientVersion).toBeTruthy();
  expect(systemInfo.libraryVersion).toBeTruthy();
  expect(systemInfo.apiVersion).toBeTruthy();
});

it('should add torrent from buffer', async () => {
  const client = new RTorrent({ baseUrl, username, password });
  const res = await client.addTorrentFromFile(torrentFileBuffer);
  expect(res).toBe(true);
  await waitForTorrent(client);
  const torrents = await client.getAllTorrents();
  expect(torrents.length).toBe(1);
  // Add delay after test
  await new Promise(resolve => setTimeout(resolve, 500));
});

it('should add torrent with label', async () => {
  const client = new RTorrent({ baseUrl, username, password });
  const res = await client.addTorrentFromFile(torrentFileBuffer, {
    label: 'swag',
  });
  expect(res).toBe(true);
  await waitForTorrent(client);
  const torrents = await client.getAllTorrents();
  expect(torrents.length).toBe(1);
  expect(torrents[0]!.custom1).toBe('swag');
  // Add delay after test
  await new Promise(resolve => setTimeout(resolve, 500));
});

it('should add torrent with priority', async () => {
  const client = new RTorrent({ baseUrl, username, password });
  const res = await client.addTorrentFromFile(torrentFileBuffer, {
    priority: RTorrentPriority.High,
  });
  expect(res).toBe(true);
  await waitForTorrent(client);
  const torrents = await client.getAllTorrents();
  expect(torrents.length).toBe(1);
  expect(torrents[0]!.priority).toBe(RTorrentPriority.High);
  // Add delay after test
  await new Promise(resolve => setTimeout(resolve, 500));
});

it('should add torrent with directory', async () => {
  const client = new RTorrent({ baseUrl, username, password });
  const path = '/downloads/linux/';
  const res = await client.addTorrentFromFile(torrentFileBuffer, {
    directory: path,
    start: false,
  });
  expect(res).toBe(true);
  await waitForTorrent(client);
  const torrents = await client.getAllTorrents();
  expect(torrents.length).toBe(1);
  // rTorrent returns path without trailing slash
  expect(torrents[0]!.basePath).toBe('/downloads/linux');
  // Add delay after test
  await new Promise(resolve => setTimeout(resolve, 500));
});

it('should add magnet link', async () => {
  const client = new RTorrent({ baseUrl, username, password });
  const res = await client.addTorrentFromUrl(magnet);
  expect(res).toBe(true);
  // Add delay after test
  await new Promise(resolve => setTimeout(resolve, 500));
});

it('should get torrent properties', async () => {
  const client = new RTorrent({ baseUrl, username, password });
  const torrentId = await setupTorrent(client);
  const res = await client.getTorrentProperties(torrentId);
  expect(res.name).toBe(torrentName);
  expect(res.hash).toBe(torrentId);
});

it('should get torrent files', async () => {
  const client = new RTorrent({ baseUrl, username, password });
  const torrentId = await setupTorrent(client);
  const res = await client.getTorrentFiles(torrentId);
  expect(Array.isArray(res)).toBeTruthy();
});

it('should get torrent trackers', async () => {
  const client = new RTorrent({ baseUrl, username, password });
  const torrentId = await setupTorrent(client);
  const res = await client.getTorrentTrackers(torrentId);
  expect(Array.isArray(res)).toBeTruthy();
});

it('should get torrent peers', async () => {
  const client = new RTorrent({ baseUrl, username, password });
  const torrentId = await setupTorrent(client);
  const res = await client.getTorrentPeers(torrentId);
  expect(Array.isArray(res)).toBeTruthy();
});

it('should pause/resume torrent', async () => {
  const client = new RTorrent({ baseUrl, username, password });
  const torrentId = await setupTorrent(client);
  expect(await client.pauseTorrent(torrentId)).toBeTruthy();
  expect(await client.resumeTorrent(torrentId)).toBeTruthy();
});

it('should set torrent priority', async () => {
  const client = new RTorrent({ baseUrl, username, password });
  const torrentId = await setupTorrent(client);
  expect(await client.setTorrentPriority(torrentId, RTorrentPriority.High)).toBe(true);
  expect(await client.setTorrentPriority(torrentId, RTorrentPriority.Low)).toBe(true);
});

it('should set torrent label', async () => {
  const client = new RTorrent({ baseUrl, username, password });
  const torrentId = await setupTorrent(client);
  expect(await client.setTorrentLabel(torrentId, 'movies')).toBe(true);
  const torrent = await client.getTorrentRaw(torrentId);
  expect(torrent?.custom1).toBe('movies');
});

it('should get views', async () => {
  const client = new RTorrent({ baseUrl, username, password });
  const views = await client.getViews();
  expect(Array.isArray(views)).toBeTruthy();
});

it('should add torrent to view', async () => {
  const client = new RTorrent({ baseUrl, username, password });
  const torrentId = await setupTorrent(client);
  expect(await client.addTorrentToView(torrentId, 'completed')).toBe(true);
});

it('should remove torrent from view', async () => {
  const client = new RTorrent({ baseUrl, username, password });
  const torrentId = await setupTorrent(client);
  await client.addTorrentToView(torrentId, 'completed');
  expect(await client.removeTorrentFromView(torrentId, 'completed')).toBe(true);
});

it('should check if torrent exists', async () => {
  const client = new RTorrent({ baseUrl, username, password });
  const torrentId = await setupTorrent(client);
  expect(await client.hasTorrent(torrentId)).toBe(true);
  expect(await client.hasTorrent('nonexistent')).toBe(false);
});

it('should return normalized torrent data', async () => {
  const client = new RTorrent({ baseUrl, username, password });
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
  expect(typeof torrent.dateCompleted).toBe('string');
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
  const client = new RTorrent({ baseUrl, username, password });
  const torrent = await client.normalizedAddTorrent(torrentFileBuffer, {
    startPaused: true,
    label: 'swag',
  });
  expect(torrent.name).toBe(torrentName);
  expect(torrent.label).toBe('swag');
  expect(torrent.id).toBeTruthy();
  // Add delay after test
  await new Promise(resolve => setTimeout(resolve, 500));
}, 20000);

it('should be able to export and create from state', async () => {
  const client = new RTorrent({ baseUrl, username, password });
  const state = client.exportState();
  const client2 = RTorrent.createFromState(client.config, state);
  expect(client2).toBeDefined();
  expect(client2.state).toBeDefined();
});
