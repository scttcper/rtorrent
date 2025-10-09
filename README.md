# @ctrl/rtorrent [![npm version](https://img.shields.io/npm/v/@ctrl/rtorrent.svg)](https://www.npmjs.com/package/@ctrl/rtorrent)

TypeScript API wrapper for rTorrent XML-RPC interface

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

// Set priority
await rtorrent.setTorrentPriority('abc123...', RTorrentPriority.High);

// Set label/category
await rtorrent.setTorrentLabel('abc123...', 'completed');

// Remove torrent
await rtorrent.removeTorrent('abc123...', false); // false = don't delete files
```

### Getting Detailed Information

```typescript
// Get torrent files
const files = await rtorrent.getTorrentFiles('abc123...');

// Get torrent trackers
const trackers = await rtorrent.getTorrentTrackers('abc123...');

// Get torrent peers
const peers = await rtorrent.getTorrentPeers('abc123...');

// Get system information
const systemInfo = await rtorrent.getSystemInfo();
const version = await rtorrent.getVersion();
```

### Rate Limiting

```typescript
// Set download/upload rate limits (bytes per second)
await rtorrent.setDownloadRateLimit('abc123...', 1024 * 1024); // 1 MB/s
await rtorrent.setUploadRateLimit('abc123...', 512 * 1024); // 512 KB/s

// Get current limits
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
  username?: string; // Username for authentication
  password?: string; // Password for authentication
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
  Checking = 2,
  Starting = 3,
  Stopping = 4,
}
```

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

- `d.multicall2` - Get torrent information
- `load.start` / `load.normal` - Add torrents from URL
- `load.raw_start` / `load.raw` - Add torrents from file
- `d.erase` - Remove torrents
- `d.start` / `d.stop` - Control torrent state
- `system.client_version` - Get version information

For complete API documentation, see the [rTorrent XML-RPC wiki](https://github.com/rakshasa/rtorrent/wiki/RPC-Setup-XMLRPC).

## Compatibility

- rTorrent 0.9.0 or higher
- Node.js 18 or higher
- TypeScript 5.0 or higher

## License

MIT
