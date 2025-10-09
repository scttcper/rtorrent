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
    isVersion090OrHigher: boolean;
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
 * rTorrent torrent state
 * {@link https://github.com/rakshasa/rtorrent/wiki/Commands#state}
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
  /**
   * Torrent is checking
   */
  Checking = 2,
  /**
   * Torrent is starting
   */
  Starting = 3,
  /**
   * Torrent is stopping
   */
  Stopping = 4,
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
   * Base download path
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
   * File path
   */
  path: string;
  /**
   * File size in bytes
   */
  size: number;
  /**
   * File priority
   */
  priority: RTorrentPriority;
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
   * Tracker URL
   */
  url: string;
  /**
   * Tracker status
   */
  status: string;
  /**
   * Tracker message
   */
  message: string;
  /**
   * Number of peers
   */
  peers: number;
  /**
   * Number of seeds
   */
  seeds: number;
  /**
   * Number of leechers
   */
  leechers: number;
  /**
   * Number of completed downloads
   */
  completed: number;
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
   * Peer client name
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
   * Peer flags
   */
  flags: string;
  /**
   * Bytes downloaded from peer
   */
  bytesDownloaded: number;
  /**
   * Bytes uploaded to peer
   */
  bytesUploaded: number;
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
   * Number of torrents in view
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
   * Remove torrent
   * {@link https://github.com/rakshasa/rtorrent/wiki/Commands#erase}
   */
  removeTorrent(hash: string): Promise<boolean>;

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
   * Get torrent trackers
   * {@link https://github.com/rakshasa/rtorrent/wiki/Commands#trackers}
   */
  getTorrentTrackers(hash: string): Promise<RTorrentTracker[]>;

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
   * Set torrent download rate limit
   * {@link https://github.com/rakshasa/rtorrent/wiki/Commands#throttle}
   */
  setDownloadRateLimit(hash: string, rate: number): Promise<boolean>;

  /**
   * Set torrent upload rate limit
   * {@link https://github.com/rakshasa/rtorrent/wiki/Commands#throttle}
   */
  setUploadRateLimit(hash: string, rate: number): Promise<boolean>;

  /**
   * Get torrent download rate limit
   * {@link https://github.com/rakshasa/rtorrent/wiki/Commands#throttle}
   */
  getDownloadRateLimit(hash: string): Promise<number>;

  /**
   * Get torrent upload rate limit
   * {@link https://github.com/rakshasa/rtorrent/wiki/Commands#throttle}
   */
  getUploadRateLimit(hash: string): Promise<number>;
}

/**
 * Default rTorrent configuration
 */
export const defaultRTorrentConfig: RTorrentConfig = {
  baseUrl: 'http://localhost:8080',
  path: '/RPC2',
  timeout: 5000,
  useSsl: false,
};
