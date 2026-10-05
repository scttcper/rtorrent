import type {
  AddTorrentOptions as NormalizedAddTorrentOptions,
  TorrentClient,
  TorrentClientConfig,
  TorrentClientState,
} from '@ctrl/shared-torrent';

/**
 * rTorrent XML-RPC API Configuration
 * {@link https://github.com/rakshasa/rtorrent/wiki/RPC-Setup-XMLRPC}
 */
export interface RTorrentConfig extends TorrentClientConfig {
  /**
   * rTorrent XML-RPC endpoint path
   * @default '/RPC2'
   */
  path?: string;
  /**
   * Use SSL for XML-RPC connections
   * @default false
   */
  useSsl?: boolean;
  /**
   * Username for HTTP Basic Authentication
   */
  username?: string;
  /**
   * Password for HTTP Basic Authentication
   */
  password?: string;
}

/**
 * rTorrent client state
 */
export interface RTorrentState extends TorrentClientState {
  /**
   * rTorrent version information
   */
  version?: {
    version: string;
  };
}

/**
 * rTorrent torrent priority levels
 * {@link https://github.com/rakshasa/rtorrent/wiki/Commands#priority}
 */
export enum RTorrentPriority {
  /**
   * Do not download
   */
  DoNotDownload = 0,
  /**
   * Low priority
   */
  Low = 1,
  /**
   * Normal priority
   */
  Normal = 2,
  /**
   * High priority
   */
  High = 3,
}

/**
 * rTorrent file priority levels, set with {@link RTorrentClient.setFilePriority}
 * {@link https://rtorrent-docs.readthedocs.io/en/latest/cmd-ref.html#f-commands}
 */
export enum RTorrentFilePriority {
  /**
   * Do not download
   */
  Off = 0,
  /**
   * Normal priority
   */
  Normal = 1,
  /**
   * High priority
   */
  High = 2,
}

/**
 * rTorrent torrent state from `d.state`. A started torrent can still be paused (`d.is_active` is 0)
 * {@link https://rtorrent-docs.readthedocs.io/en/latest/cmd-ref.html#term-d-state}
 */
export enum RTorrentTorrentState {
  /**
   * Torrent is stopped
   */
  Stopped = 0,
  /**
   * Torrent is started
   */
  Started = 1,
}

/**
 * rTorrent tracker type from `t.type`
 * {@link https://rtorrent-docs.readthedocs.io/en/latest/cmd-ref.html#t-commands}
 */
export enum RTorrentTrackerType {
  Http = 1,
  Udp = 2,
  Dht = 3,
}

/**
 * rTorrent torrent data structure
 * Based on d.multicall2 response format
 * {@link https://github.com/rakshasa/rtorrent/wiki/Commands#multicall}
 */
export interface RTorrentTorrent {
  /**
   * Torrent name
   */
  name: string;
  /**
   * Torrent hash
   */
  hash: string;
  /**
   * `d.directory`, the parent directory for single-file torrents and the torrent's own folder for multi-file torrents
   */
  basePath: string;
  /**
   * Custom label/category
   */
  custom1: string;
  /**
   * Total size in bytes
   */
  sizeBytes: number;
  /**
   * Remaining bytes to download
   */
  leftBytes: number;
  /**
   * Download rate in bytes per second
   */
  downRate: number;
  /**
   * Upload ratio (in thousandths, e.g., 1000 = 1.0)
   */
  ratio: number;
  /**
   * Whether torrent is open
   */
  isOpen: boolean;
  /**
   * Whether torrent is active
   */
  isActive: boolean;
  /**
   * Whether torrent is complete
   */
  isComplete: boolean;
  /**
   * Finished timestamp (Unix)
   */
  finishedTime: number;
  /**
   * Torrent state
   */
  state: RTorrentTorrentState;
  /**
   * Upload rate in bytes per second
   */
  upRate: number;
  /**
   * Priority level
   */
  priority: RTorrentPriority;
  /**
   * Number of connected peers
   */
  peersConnected: number;
  /**
   * Number of peers in swarm
   */
  peersAccounted: number;
  /**
   * Number of complete peers
   */
  peersComplete: number;
  /**
   * Creation date (Unix timestamp)
   */
  creationDate: number;
  /**
   * Whether torrent is private
   */
  isPrivate: boolean;
  /**
   * Whether torrent is multi-file
   */
  isMultiFile: boolean;
  /**
   * Chunk size in bytes
   */
  chunkSize: number;
  /**
   * Number of completed chunks
   */
  completedChunks: number;
  /**
   * Total number of chunks
   */
  sizeChunks: number;
  /**
   * Bytes downloaded
   */
  bytesDone: number;
  /**
   * Total uploaded bytes
   */
  upTotal: number;
  /**
   * Free disk space
   */
  freeDiskspace: number;
  /**
   * Throttle name
   */
  throttleName: string;
  /**
   * Custom field 2
   */
  custom2: string;
  /**
   * Torrent message
   */
  message: string;
  /**
   * Tracker focus
   */
  trackerFocus: number;
  /**
   * State changed timestamp
   */
  stateChanged: number;
  /**
   * Skip total
   */
  skipTotal: number;
  /**
   * Hashing status
   */
  hashing: number;
  /**
   * Chunks hashed
   */
  chunksHashed: number;
  /**
   * Unix time the torrent was added
   */
  loadDate: number;
  /**
   * Associated views
   */
  views: string[];
}

/**
 * rTorrent system information
 * {@link https://github.com/rakshasa/rtorrent/wiki/Commands#system}
 */
export interface RTorrentSystemInfo {
  /**
   * Client version
   */
  clientVersion: string;
  /**
   * Library version
   */
  libraryVersion: string;
  /**
   * API version
   */
  apiVersion: string;
}

/**
 * rTorrent file information
 * {@link https://github.com/rakshasa/rtorrent/wiki/Commands#files}
 */
export interface RTorrentFile {
  /**
   * File index, used by {@link RTorrentClient.setFilePriority}
   */
  index: number;
  /**
   * File path relative to the torrent directory
   */
  path: string;
  /**
   * File size in bytes
   */
  size: number;
  /**
   * File priority
   */
  priority: RTorrentFilePriority;
  /**
   * Whether file is completed
   */
  isCompleted: boolean;
  /**
   * Number of chunks completed
   */
  completedChunks: number;
  /**
   * Total number of chunks
   */
  totalChunks: number;
}

/**
 * rTorrent tracker information
 * {@link https://github.com/rakshasa/rtorrent/wiki/Commands#trackers}
 */
export interface RTorrentTracker {
  /**
   * Tracker index, used by {@link RTorrentClient.setTrackerEnabled}
   */
  index: number;
  /**
   * Tracker URL
   */
  url: string;
  /**
   * Tracker type
   */
  type: RTorrentTrackerType;
  /**
   * Whether the tracker is enabled
   */
  isEnabled: boolean;
  /**
   * Number of peers returned by the last announce
   */
  peers: number;
  /**
   * Number of seeds from the last scrape
   */
  seeds: number;
  /**
   * Number of leechers from the last scrape
   */
  leechers: number;
  /**
   * Number of completed downloads from the last scrape
   */
  completed: number;
  /**
   * Number of failed requests since the last success
   */
  failedCounter: number;
}

/**
 * rTorrent peer information
 * {@link https://github.com/rakshasa/rtorrent/wiki/Commands#peers}
 */
export interface RTorrentPeer {
  /**
   * Peer ID
   */
  id: string;
  /**
   * Peer IP address
   */
  ip: string;
  /**
   * Peer port
   */
  port: number;
  /**
   * Peer client name and version
   */
  client: string;
  /**
   * Download rate from peer
   */
  downRate: number;
  /**
   * Upload rate to peer
   */
  upRate: number;
  /**
   * Bytes downloaded from peer
   */
  bytesDownloaded: number;
  /**
   * Bytes uploaded to peer
   */
  bytesUploaded: number;
  /**
   * Percent of the torrent the peer has, 0-100
   */
  completedPercent: number;
  /**
   * Whether the connection is encrypted
   */
  isEncrypted: boolean;
  /**
   * Whether the peer connected to us
   */
  isIncoming: boolean;
}

/**
 * rTorrent view information
 * {@link https://github.com/rakshasa/rtorrent/wiki/Commands#views}
 */
export interface RTorrentView {
  /**
   * View name
   */
  name: string;
  /**
   * Number of torrents in view from `view.size`
   */
  count: number;
}

/**
 * Options for adding torrents via URL
 * {@link https://github.com/rakshasa/rtorrent/wiki/Commands#load}
 */
export interface AddTorrentUrlOptions {
  /**
   * Label/category for the torrent
   */
  label?: string;
  /**
   * Priority level
   */
  priority?: RTorrentPriority;
  /**
   * Download directory
   */
  directory?: string;
  /**
   * Whether to start torrent immediately
   */
  start?: boolean;
}

/**
 * Options for adding torrents via file
 * {@link https://github.com/rakshasa/rtorrent/wiki/Commands#load}
 */
export interface AddTorrentFileOptions extends AddTorrentUrlOptions {
  /**
   * Filename for the torrent file
   */
  filename?: string;
}

/**
 * Options for adding torrents (normalized)
 */
export interface AddTorrentOptions extends NormalizedAddTorrentOptions {
  /**
   * rTorrent-specific options
   */
  rtorrent?: AddTorrentUrlOptions;
}

/**
 * rTorrent XML-RPC fault information
 */
export interface RTorrentFault {
  /**
   * Fault code
   */
  faultCode: number;
  /**
   * Fault string description
   */
  faultString: string;
}

/**
 * rTorrent XML-RPC method call parameters
 */
export interface RTorrentMethodCall {
  /**
   * Method name
   */
  methodName: string;
  /**
   * Method parameters
   */
  params: unknown[];
}

/**
 * rTorrent XML-RPC response
 */
export interface RTorrentResponse<T = unknown> {
  /**
   * Response data
   */
  data: T;
  /**
   * Whether response indicates success
   */
  success: boolean;
  /**
   * Error message if any
   */
  error?: string;
}

/**
 * rTorrent client interface
 */
export interface RTorrentClient extends TorrentClient {
  /**
   * Get rTorrent system information
   * {@link https://github.com/rakshasa/rtorrent/wiki/Commands#system}
   */
  getSystemInfo(): Promise<RTorrentSystemInfo>;

  /**
   * Get rTorrent version
   * {@link https://github.com/rakshasa/rtorrent/wiki/Commands#system}
   */
  getVersion(): Promise<string>;

  /**
   * Get all torrents with detailed information
   * {@link https://github.com/rakshasa/rtorrent/wiki/Commands#multicall}
   */
  getAllTorrents(): Promise<RTorrentTorrent[]>;

  /**
   * Get torrent by hash (raw rTorrent format)
   * {@link https://github.com/rakshasa/rtorrent/wiki/Commands#multicall}
   */
  getTorrentRaw(hash: string): Promise<RTorrentTorrent | null>;

  /**
   * Add torrent from URL
   * {@link https://github.com/rakshasa/rtorrent/wiki/Commands#load}
   */
  addTorrentFromUrl(url: string, options?: AddTorrentUrlOptions): Promise<boolean>;

  /**
   * Add torrent from file
   * {@link https://github.com/rakshasa/rtorrent/wiki/Commands#load}
   */
  addTorrentFromFile(fileContent: Uint8Array, options?: AddTorrentFileOptions): Promise<boolean>;

  /**
   * Remove torrent, deleting files is not supported and throws
   * {@link https://github.com/rakshasa/rtorrent/wiki/Commands#erase}
   */
  removeTorrent(hash: string, deleteFiles?: boolean): Promise<boolean>;

  /**
   * Start torrent
   * {@link https://github.com/rakshasa/rtorrent/wiki/Commands#start}
   */
  startTorrent(hash: string): Promise<boolean>;

  /**
   * Stop torrent
   * {@link https://github.com/rakshasa/rtorrent/wiki/Commands#stop}
   */
  stopTorrent(hash: string): Promise<boolean>;

  /**
   * Pause torrent with `d.stop`
   * {@link https://github.com/rakshasa/rtorrent/wiki/Commands#stop}
   */
  pauseTorrent(hash: string): Promise<boolean>;

  /**
   * Resume a stopped or paused torrent with `d.start` and `d.resume`
   * {@link https://rtorrent-docs.readthedocs.io/en/latest/cmd-ref.html#term-d-start}
   */
  resumeTorrent(hash: string): Promise<boolean>;

  /**
   * Recheck torrent data
   * {@link https://rtorrent-docs.readthedocs.io/en/latest/cmd-ref.html#term-d-check-hash}
   */
  checkHash(hash: string): Promise<boolean>;

  /**
   * Set torrent priority
   * {@link https://github.com/rakshasa/rtorrent/wiki/Commands#priority}
   */
  setTorrentPriority(hash: string, priority: RTorrentPriority): Promise<boolean>;

  /**
   * Set torrent label
   * {@link https://github.com/rakshasa/rtorrent/wiki/Commands#custom}
   */
  setTorrentLabel(hash: string, label: string): Promise<boolean>;

  /**
   * Get torrent files
   * {@link https://github.com/rakshasa/rtorrent/wiki/Commands#files}
   */
  getTorrentFiles(hash: string): Promise<RTorrentFile[]>;

  /**
   * Set the priority of a file by its index
   * {@link https://rtorrent-docs.readthedocs.io/en/latest/cmd-ref.html#f-commands}
   */
  setFilePriority(hash: string, index: number, priority: RTorrentFilePriority): Promise<boolean>;

  /**
   * Get torrent trackers
   * {@link https://github.com/rakshasa/rtorrent/wiki/Commands#trackers}
   */
  getTorrentTrackers(hash: string): Promise<RTorrentTracker[]>;

  /**
   * Enable or disable a tracker by its index
   * {@link https://rtorrent-docs.readthedocs.io/en/latest/cmd-ref.html#t-commands}
   */
  setTrackerEnabled(hash: string, index: number, enabled: boolean): Promise<boolean>;

  /**
   * Get torrent peers
   * {@link https://github.com/rakshasa/rtorrent/wiki/Commands#peers}
   */
  getTorrentPeers(hash: string): Promise<RTorrentPeer[]>;

  /**
   * Get available views
   * {@link https://github.com/rakshasa/rtorrent/wiki/Commands#views}
   */
  getViews(): Promise<RTorrentView[]>;

  /**
   * Add torrent to view
   * {@link https://github.com/rakshasa/rtorrent/wiki/Commands#views}
   */
  addTorrentToView(hash: string, view: string): Promise<boolean>;

  /**
   * Remove torrent from view
   * {@link https://github.com/rakshasa/rtorrent/wiki/Commands#views}
   */
  removeTorrentFromView(hash: string, view: string): Promise<boolean>;

  /**
   * Check if torrent exists
   * {@link https://github.com/rakshasa/rtorrent/wiki/Commands#name}
   */
  hasTorrent(hash: string): Promise<boolean>;

  /**
   * Get torrent properties
   * {@link https://github.com/rakshasa/rtorrent/wiki/Commands#multicall}
   */
  getTorrentProperties(hash: string): Promise<Partial<RTorrentTorrent>>;

  /**
   * Get the download limit in bytes/s of the torrent's throttle group
   * {@link https://rtorrent-docs.readthedocs.io/en/latest/cmd-ref.html#throttle-commands}
   */
  getDownloadRateLimit(hash: string): Promise<number>;

  /**
   * Get the upload limit in bytes/s of the torrent's throttle group
   * {@link https://rtorrent-docs.readthedocs.io/en/latest/cmd-ref.html#throttle-commands}
   */
  getUploadRateLimit(hash: string): Promise<number>;

  /**
   * Create or update a named throttle group, limits are in KiB/s
   * {@link https://rtorrent-docs.readthedocs.io/en/latest/cmd-ref.html#throttle-commands}
   */
  setThrottleGroup(name: string, downKiB?: number, upKiB?: number): Promise<boolean>;

  /**
   * Assign a torrent to a throttle group, the torrent must be stopped
   * {@link https://rtorrent-docs.readthedocs.io/en/latest/cmd-ref.html#term-d-throttle-name}
   */
  setTorrentThrottle(hash: string, name: string): Promise<boolean>;

  /**
   * Get the global download limit in bytes/s, 0 is unlimited
   * {@link https://rtorrent-docs.readthedocs.io/en/latest/cmd-ref.html#throttle-commands}
   */
  getGlobalDownloadRateLimit(): Promise<number>;

  /**
   * Set the global download limit in bytes/s, 0 is unlimited
   * {@link https://rtorrent-docs.readthedocs.io/en/latest/cmd-ref.html#throttle-commands}
   */
  setGlobalDownloadRateLimit(bytesPerSecond: number): Promise<boolean>;

  /**
   * Get the global upload limit in bytes/s, 0 is unlimited
   * {@link https://rtorrent-docs.readthedocs.io/en/latest/cmd-ref.html#throttle-commands}
   */
  getGlobalUploadRateLimit(): Promise<number>;

  /**
   * Set the global upload limit in bytes/s, 0 is unlimited
   * {@link https://rtorrent-docs.readthedocs.io/en/latest/cmd-ref.html#throttle-commands}
   */
  setGlobalUploadRateLimit(bytesPerSecond: number): Promise<boolean>;
}

/**
 * Default rTorrent configuration
 */
export const defaultRTorrentConfig: RTorrentConfig = {
  baseUrl: 'http://localhost:8080',
  path: '/RPC2',
  timeout: 5000,
  useSsl: false,
  username: '',
  password: '',
};
