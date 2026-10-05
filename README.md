# @ctrl/rtorrent [![npm version](https://img.shields.io/npm/v/@ctrl/rtorrent.svg)](https://www.npmjs.com/package/@ctrl/rtorrent)

TypeScript API wrapper for rTorrent XML-RPC interface

DOCS: https://rtorrent.ep.workers.dev

Normalized torrent types are shared through [@ctrl/shared-torrent](https://github.com/scttcper/shared-torrent).

## Installation

```bash
npm install @ctrl/rtorrent
```

## Usage

### Basic Setup

```typescript
import { RTorrent } from '@ctrl/rtorrent';

const rtorrent = new RTorrent({
  baseUrl: 'http://localhost:8080',
  path: '/RPC2',
  username: 'admin',
  password: 'admin',
  timeout: 5000,
  useSsl: false,
});
```

### Getting Torrents

```typescript
// Get all torrents (normalized format)
const torrents = await rtorrent.getAllData();

// Get all torrents (raw rTorrent format)
const rawTorrents = await rtorrent.getAllTorrents();

// Get specific torrent by hash
const torrent = await rtorrent.getTorrent('abc123...');
```

### Adding Torrents

```typescript
// Add from magnet URL
await rtorrent.addMagnet('magnet:?xt=urn:btih:...', {
  rtorrent: {
    label: 'movies',
    priority: RTorrentPriority.High,
    directory: '/downloads/movies',
    start: true,
  },
});

// Add from torrent file
const fileContent = new Uint8Array(/* torrent file bytes */);
await rtorrent.addTorrentFromFile(fileContent, {
  label: 'tv-shows',
  priority: RTorrentPriority.Normal,
  directory: '/downloads/tv',
});

// Add using normalized interface
const normalizedTorrent = await rtorrent.normalizedAddTorrent('magnet:?xt=urn:btih:...', {
  startPaused: false,
  label: 'movies',
});
```

### Managing Torrents

```typescript
// Start/stop torrents
await rtorrent.startTorrent('abc123...');
await rtorrent.stopTorrent('abc123...');

// Pause/resume (normalized), resume also undoes ruTorrent's d.pause
await rtorrent.pauseTorrent('abc123...');
await rtorrent.resumeTorrent('abc123...');

// Recheck data
await rtorrent.checkHash('abc123...');

// Move in the queue
await rtorrent.queueUp('abc123...');
await rtorrent.queueDown('abc123...');

// Set priority
await rtorrent.setTorrentPriority('abc123...', RTorrentPriority.High);

// Set label/category
await rtorrent.setTorrentLabel('abc123...', 'completed');

// Remove one or more torrents, throws if a torrent doesn't exist
await rtorrent.removeTorrent(['abc123...', 'def456...'], false); // false = don't delete files
```

### Getting Detailed Information

```typescript
// Get torrent files
const files = await rtorrent.getTorrentFiles('abc123...');

// Skip a file, file priorities are 0 off, 1 normal, 2 high
await rtorrent.setFilePriority('abc123...', files[0].index, RTorrentFilePriority.Off);

// Get torrent trackers
const trackers = await rtorrent.getTorrentTrackers('abc123...');
await rtorrent.setTrackerEnabled('abc123...', trackers[0].index, false);

// Get torrent peers
const peers = await rtorrent.getTorrentPeers('abc123...');

// Get system information
const systemInfo = await rtorrent.getSystemInfo();
const version = await rtorrent.getVersion();
```

### Rate Limiting

rTorrent has no per-torrent limits. Torrents are assigned to named [throttle groups](https://rtorrent-docs.readthedocs.io/en/latest/cmd-ref.html#throttle-commands) and torrents without a group use the global limit.

```typescript
// Global limits in bytes/s, 0 is unlimited
await rtorrent.setGlobalDownloadRateLimit(1024 * 1024);
await rtorrent.setGlobalUploadRateLimit(512 * 1024);

// Create a throttle group (KiB/s) and assign a stopped torrent to it
await rtorrent.setThrottleGroup('slow', 100, 50);
await rtorrent.stopTorrent('abc123...');
await rtorrent.setTorrentThrottle('abc123...', 'slow');

// Limit of the torrent's throttle group in bytes/s
const downloadLimit = await rtorrent.getDownloadRateLimit('abc123...');
const uploadLimit = await rtorrent.getUploadRateLimit('abc123...');
```

### Views Management

```typescript
// Get available views
const views = await rtorrent.getViews();

// Add torrent to view
await rtorrent.addTorrentToView('abc123...', 'completed');

// Remove torrent from view
await rtorrent.removeTorrentFromView('abc123...', 'completed');
```

### State Management

```typescript
// Export client state for persistence
const state = rtorrent.exportState();

// Restore client from state
const restoredClient = RTorrent.createFromState(config, state);
```

## API Reference

### Configuration Options

```typescript
interface RTorrentConfig {
  baseUrl: string; // rTorrent XML-RPC endpoint URL
  path?: string; // XML-RPC path (default: '/RPC2')
  username?: string; // Username for HTTP Basic Authentication
  password?: string; // Password for HTTP Basic Authentication
  timeout?: number; // Request timeout in ms (default: 5000)
  useSsl?: boolean; // Use HTTPS (default: false)
}
```

### Priority Levels

```typescript
enum RTorrentPriority {
  DoNotDownload = 0,
  Low = 1,
  Normal = 2,
  High = 3,
}
```

### Torrent States

```typescript
enum RTorrentTorrentState {
  Stopped = 0,
  Started = 1,
}
```

A started torrent can still be paused, check `isActive`.

## Testing with Docker

Start a test rTorrent container:

```bash
docker run -d \
  --name=rutorrent \
  -e PUID=1000 \
  -e PGID=1000 \
  -e TZ=Etc/UTC \
  -p 8080:80 \
  -p 49164:49164 \
  -p 49164:49164/udp \
  --restart unless-stopped \
  lscr.io/linuxserver/rutorrent:latest
```

The XML-RPC endpoint will be available at `http://localhost:8080/RPC2`.

## XML-RPC API

This library communicates with rTorrent using its XML-RPC interface. Key methods used:

- `d.multicall2` - Get torrent information, still available on rTorrent 0.16 and supported by older versions that don't have `d.multicall`
- `load.start` / `load.normal` - Add torrents from URL
- `load.raw_start` / `load.raw` - Add torrents from file
- `d.erase` - Remove torrents
- `d.start` / `d.stop` - Control torrent state
- `system.client_version` - Get version information

For complete API documentation, see the [rTorrent XML-RPC wiki](https://github.com/rakshasa/rtorrent/wiki/RPC-Setup-XMLRPC).

rTorrent 0.16.9+ lets the SCGI proxy mark connections with the `UNTRUSTED_CONNECTION` header, which limits them to an allowlist of safe methods. Write commands this library uses (adding, removing, labeling, throttling) can fault on those connections, so point the client at a trusted endpoint. See the [0.16.9 release notes](https://github.com/rakshasa/rtorrent/releases/tag/v0.16.9).

## Compatibility

- rTorrent 0.9.0 or higher
- Node.js 18 or higher
- TypeScript 5.0 or higher

## See Also

All of the following npm modules provide the same normalized functions along with supporting the unique apis for each client.

- shared types - [@ctrl/shared-torrent](https://github.com/scttcper/shared-torrent)
- deluge - [@ctrl/deluge](https://github.com/scttcper/deluge)
- transmission - [@ctrl/transmission](https://github.com/scttcper/transmission)
- qbittorrent - [@ctrl/qbittorrent](https://github.com/scttcper/qbittorrent)
- utorrent - [@ctrl/utorrent](https://github.com/scttcper/utorrent)
- rqbit - [@ctrl/rqbit](https://github.com/scttcper/rqbit)

Usenet clients with the same normalized approach:

- usenet shared types - [@ctrl/shared-usenet](https://github.com/scttcper/shared-usenet)
- nzbget - [@ctrl/nzbget](https://github.com/scttcper/nzbget)
- sabnzbd - [@ctrl/sabnzbd](https://github.com/scttcper/sabnzbd)

## License

MIT
