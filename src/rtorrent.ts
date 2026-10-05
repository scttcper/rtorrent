import { magnetDecode } from '@ctrl/magnet-link';
import type {
  AddTorrentOptions as NormalizedAddTorrentOptions,
  AllClientData,
  Label,
  NormalizedTorrent,
} from '@ctrl/shared-torrent';
import { hash as torrentFileHash } from '@ctrl/torrent-file';
import { ofetch } from 'ofetch';
import type { Jsonify } from 'type-fest';
import { joinURL } from 'ufo';
import { isUint8Array, stringToUint8Array, stringToBase64 } from 'uint8array-extras';

import { normalizeTorrentData } from './normalizeTorrentData.js';
import {
  AddTorrentFileOptions,
  AddTorrentOptions,
  AddTorrentUrlOptions,
  RTorrentClient,
  RTorrentConfig,
  RTorrentFile,
  RTorrentFilePriority,
  RTorrentMethodCall,
  RTorrentPeer,
  RTorrentPriority,
  RTorrentState,
  RTorrentSystemInfo,
  RTorrentTorrent,
  RTorrentTracker,
  RTorrentTrackerType,
  RTorrentView,
} from './types.js';
import { buildXmlRpcRequest, parseXmlRpcResponse } from './xmlrpcUtils.js';

const defaults: RTorrentConfig = {
  baseUrl: 'http://localhost:8080',
  path: '/RPC2',
  timeout: 5000,
  useSsl: false,
  username: '',
  password: '',
};

function toHashes(hash: string | string[]): string[] {
  return Array.isArray(hash) ? hash : [hash];
}

export class RTorrent implements RTorrentClient {
  /**
   * Create a new RTorrent client from a state
   */
  static createFromState(
    config: Readonly<RTorrentConfig>,
    state: Readonly<Jsonify<RTorrentState>>,
  ): RTorrent {
    const client = new RTorrent(config);
    client.state = {
      ...state,
      version: state.version ? { ...state.version } : undefined,
    };
    return client;
  }

  config: RTorrentConfig;
  state: RTorrentState = {};

  constructor(options: Partial<RTorrentConfig> = {}) {
    this.config = { ...defaults, ...options };
  }

  /**
   * Export the state of the client as JSON
   */
  exportState(): Jsonify<RTorrentState> {
    return JSON.parse(JSON.stringify(this.state));
  }

  /**
   * Get rTorrent system information
   * {@link https://github.com/rakshasa/rtorrent/wiki/Commands#system}
   */
  async getSystemInfo(): Promise<RTorrentSystemInfo> {
    const [clientVersion, libraryVersion, apiVersion] = await Promise.all([
      this.xmlRpcRequest<string>({ methodName: 'system.client_version', params: [] }),
      this.xmlRpcRequest<string>({ methodName: 'system.library_version', params: [] }),
      this.xmlRpcRequest<string>({ methodName: 'system.api_version', params: [] }),
    ]);

    return {
      clientVersion,
      libraryVersion,
      apiVersion,
    };
  }

  /**
   * Get rTorrent version
   * {@link https://github.com/rakshasa/rtorrent/wiki/Commands#system}
   */
  async getVersion(): Promise<string> {
    const version = await this.xmlRpcRequest<string>({
      methodName: 'system.client_version',
      params: [],
    });

    this.state.version = { version };

    return version;
  }

  /**
   * Get all torrents with detailed information
   * {@link https://github.com/rakshasa/rtorrent/wiki/Commands#multicall}
   */
  async getAllTorrents(): Promise<RTorrentTorrent[]> {
    const methodCall: RTorrentMethodCall = {
      methodName: 'd.multicall2',
      params: [
        '', // view
        '', // pattern
        'd.name=', // torrent name
        'd.hash=', // torrent hash
        'd.directory=', // download directory
        'd.custom1=', // label/category
        'd.size_bytes=', // total size
        'd.left_bytes=', // remaining bytes
        'd.down.rate=', // download rate
        'd.ratio=', // ratio
        'd.is_open=', // is open
        'd.is_active=', // is active
        'd.complete=', // is complete
        'd.timestamp.finished=', // finished time
        'd.state=', // state
        'd.up.rate=', // upload rate
        'd.priority=', // priority
        'd.peers_connected=', // connected peers
        'd.peers_accounted=', // accounted peers
        'd.peers_complete=', // complete peers
        'd.creation_date=', // creation date
        'd.is_private=', // is private
        'd.is_multi_file=', // is multi-file
        'd.chunk_size=', // chunk size
        'd.completed_chunks=', // completed chunks
        'd.size_chunks=', // total chunks
        'd.bytes_done=', // bytes done
        'd.up.total=', // total uploaded
        'd.free_diskspace=', // free disk space
        'd.throttle_name=', // throttle name
        'd.custom2=', // custom field 2
        'd.message=', // message
        'd.tracker_focus=', // tracker focus
        'd.state_changed=', // state changed
        'd.skip.total=', // skip total
        'd.hashing=', // hashing
        'd.chunks_hashed=', // chunks hashed
        'd.load_date=', // time the torrent was added
      ],
    };

    const response = await this.xmlRpcRequest<unknown[][]>(methodCall);

    return response.map(row => this.parseTorrentData(row));
  }

  /**
   * Get torrent by hash (raw rTorrent format)
   * {@link https://github.com/rakshasa/rtorrent/wiki/Commands#multicall}
   */
  async getTorrentRaw(hash: string): Promise<RTorrentTorrent | null> {
    const torrents = await this.getAllTorrents();
    return torrents.find(t => t.hash.toLowerCase() === hash.toLowerCase()) || null;
  }

  /**
   * Get torrent by hash (normalized format)
   * {@link https://github.com/rakshasa/rtorrent/wiki/Commands#multicall}
   */
  async getTorrent(hash: string): Promise<NormalizedTorrent> {
    const torrent = await this.getTorrentRaw(hash);
    if (!torrent) {
      throw new Error('Torrent not found');
    }
    return normalizeTorrentData(torrent);
  }

  /**
   * Add torrent from URL
   * {@link https://github.com/rakshasa/rtorrent/wiki/Commands#load}
   */
  async addTorrentFromUrl(url: string, options: AddTorrentUrlOptions = {}): Promise<boolean> {
    const commands: string[] = [];

    if (options.label) {
      commands.push(`d.custom1.set=${options.label}`);
    }

    if (options.priority !== undefined && options.priority !== RTorrentPriority.Normal) {
      commands.push(`d.priority.set=${options.priority}`);
    }

    if (options.directory) {
      commands.push(`d.directory.set=${options.directory}`);
    }

    const methodName = options.start !== false ? 'load.start' : 'load.normal';
    const methodCall: RTorrentMethodCall = {
      methodName,
      params: ['', url, ...commands],
    };

    const response = await this.xmlRpcRequest<number>(methodCall);
    return response === 0;
  }

  /**
   * Add torrent from file
   * {@link https://github.com/rakshasa/rtorrent/wiki/Commands#load}
   */
  async addTorrentFromFile(
    fileContent: Uint8Array,
    options: AddTorrentFileOptions = {},
  ): Promise<boolean> {
    const commands: string[] = [];

    if (options.label) {
      commands.push(`d.custom1.set=${options.label}`);
    }

    if (options.priority !== undefined && options.priority !== RTorrentPriority.Normal) {
      commands.push(`d.priority.set=${options.priority}`);
    }

    if (options.directory) {
      commands.push(`d.directory.set=${options.directory}`);
    }

    const methodName = options.start !== false ? 'load.raw_start' : 'load.raw';
    const methodCall: RTorrentMethodCall = {
      methodName,
      params: ['', fileContent, ...commands],
    };

    const response = await this.xmlRpcRequest<number>(methodCall);
    return response === 0;
  }

  /**
   * Remove torrent (internal implementation)
   * {@link https://github.com/rakshasa/rtorrent/wiki/Commands#erase}
   */
  private async removeTorrentInternal(hash: string): Promise<boolean> {
    const methodCall: RTorrentMethodCall = {
      methodName: 'd.erase',
      params: [hash],
    };

    const response = await this.xmlRpcRequest<number>(methodCall);
    return response === 0;
  }

  /**
   * Start torrent
   * {@link https://github.com/rakshasa/rtorrent/wiki/Commands#start}
   */
  async startTorrent(hash: string): Promise<boolean> {
    const methodCall: RTorrentMethodCall = {
      methodName: 'd.start',
      params: [hash],
    };

    const response = await this.xmlRpcRequest<number>(methodCall);
    return response === 0;
  }

  /**
   * Stop torrent
   * {@link https://github.com/rakshasa/rtorrent/wiki/Commands#stop}
   */
  async stopTorrent(hash: string): Promise<boolean> {
    const methodCall: RTorrentMethodCall = {
      methodName: 'd.stop',
      params: [hash],
    };

    const response = await this.xmlRpcRequest<number>(methodCall);
    return response === 0;
  }

  /**
   * Recheck torrent data
   * {@link https://rtorrent-docs.readthedocs.io/en/latest/cmd-ref.html#term-d-check-hash}
   */
  async checkHash(hash: string): Promise<boolean> {
    const methodCall: RTorrentMethodCall = {
      methodName: 'd.check_hash',
      params: [hash],
    };

    const response = await this.xmlRpcRequest<number>(methodCall);
    return response === 0;
  }

  /**
   * Set torrent priority
   * {@link https://github.com/rakshasa/rtorrent/wiki/Commands#priority}
   */
  async setTorrentPriority(hash: string, priority: RTorrentPriority): Promise<boolean> {
    const methodCall: RTorrentMethodCall = {
      methodName: 'd.priority.set',
      params: [hash, priority],
    };

    const response = await this.xmlRpcRequest<number>(methodCall);
    return response === 0;
  }

  /**
   * Set torrent label
   * {@link https://github.com/rakshasa/rtorrent/wiki/Commands#custom}
   */
  async setTorrentLabel(hash: string, label: string): Promise<boolean> {
    const methodCall: RTorrentMethodCall = {
      methodName: 'd.custom1.set',
      params: [hash, label],
    };

    const response = await this.xmlRpcRequest<string>(methodCall);
    return response === label;
  }

  /**
   * Get torrent files
   * {@link https://github.com/rakshasa/rtorrent/wiki/Commands#files}
   */
  async getTorrentFiles(hash: string): Promise<RTorrentFile[]> {
    const methodCall: RTorrentMethodCall = {
      methodName: 'f.multicall',
      params: [
        hash,
        '',
        'f.path=',
        'f.size_bytes=',
        'f.priority=',
        'f.completed_chunks=',
        'f.size_chunks=',
      ],
    };

    const response = await this.xmlRpcRequest<unknown[][]>(methodCall);
    return response.map((row, index) => ({
      index,
      path: row[0] as string,
      size: row[1] as number,
      priority: row[2] as RTorrentFilePriority,
      isCompleted: row[3] === row[4],
      completedChunks: row[3] as number,
      totalChunks: row[4] as number,
    }));
  }

  /**
   * Set the priority of a file by its index in {@link getTorrentFiles}
   * {@link https://rtorrent-docs.readthedocs.io/en/latest/cmd-ref.html#term-f-priority-set}
   */
  async setFilePriority(
    hash: string,
    index: number,
    priority: RTorrentFilePriority,
  ): Promise<boolean> {
    await this.xmlRpcRequest<number>({
      methodName: 'f.priority.set',
      params: [`${hash}:f${index}`, priority],
    });

    // file priorities are only applied to the download after d.update_priorities
    // https://rtorrent-docs.readthedocs.io/en/latest/cmd-ref.html#term-d-update-priorities
    const response = await this.xmlRpcRequest<number>({
      methodName: 'd.update_priorities',
      params: [hash],
    });
    return response === 0;
  }

  /**
   * Get torrent trackers
   * {@link https://github.com/rakshasa/rtorrent/wiki/Commands#trackers}
   */
  async getTorrentTrackers(hash: string): Promise<RTorrentTracker[]> {
    const methodCall: RTorrentMethodCall = {
      methodName: 't.multicall',
      params: [
        hash,
        '',
        't.url=',
        't.type=',
        't.is_enabled=',
        't.latest_sum_peers=',
        't.scrape_complete=',
        't.scrape_incomplete=',
        't.scrape_downloaded=',
        't.failed_counter=',
      ],
    };

    const response = await this.xmlRpcRequest<unknown[][]>(methodCall);
    return response.map((row, index) => ({
      index,
      url: row[0] as string,
      type: row[1] as RTorrentTrackerType,
      isEnabled: row[2] === 1,
      peers: row[3] as number,
      seeds: row[4] as number,
      leechers: row[5] as number,
      completed: row[6] as number,
      failedCounter: row[7] as number,
    }));
  }

  /**
   * Enable or disable a tracker by its index in {@link getTorrentTrackers}
   * {@link https://rtorrent-docs.readthedocs.io/en/latest/cmd-ref.html#term-t-is-enabled-set}
   */
  async setTrackerEnabled(hash: string, index: number, enabled: boolean): Promise<boolean> {
    const methodCall: RTorrentMethodCall = {
      methodName: 't.is_enabled.set',
      params: [`${hash}:t${index}`, enabled ? 1 : 0],
    };

    const response = await this.xmlRpcRequest<number>(methodCall);
    return response === 0;
  }

  /**
   * Get torrent peers
   * {@link https://github.com/rakshasa/rtorrent/wiki/Commands#peers}
   */
  async getTorrentPeers(hash: string): Promise<RTorrentPeer[]> {
    const methodCall: RTorrentMethodCall = {
      methodName: 'p.multicall',
      params: [
        hash,
        '',
        'p.id=',
        'p.address=',
        'p.port=',
        'p.client_version=',
        'p.down_rate=',
        'p.up_rate=',
        'p.down_total=',
        'p.up_total=',
        'p.completed_percent=',
        'p.is_encrypted=',
        'p.is_incoming=',
      ],
    };

    const response = await this.xmlRpcRequest<unknown[][]>(methodCall);
    return response.map(row => ({
      id: row[0] as string,
      ip: row[1] as string,
      port: row[2] as number,
      client: row[3] as string,
      downRate: row[4] as number,
      upRate: row[5] as number,
      bytesDownloaded: row[6] as number,
      bytesUploaded: row[7] as number,
      completedPercent: row[8] as number,
      isEncrypted: row[9] === 1,
      isIncoming: row[10] === 1,
    }));
  }

  /**
   * Get available views
   * {@link https://github.com/rakshasa/rtorrent/wiki/Commands#views}
   */
  async getViews(): Promise<RTorrentView[]> {
    const methodCall: RTorrentMethodCall = {
      methodName: 'view.list',
      params: [],
    };

    const names = await this.xmlRpcRequest<string[]>(methodCall);
    return Promise.all(
      names.map(async name => ({
        name,
        count: await this.xmlRpcRequest<number>({ methodName: 'view.size', params: ['', name] }),
      })),
    );
  }

  /**
   * Add torrent to view
   * {@link https://github.com/rakshasa/rtorrent/wiki/Commands#views}
   */
  async addTorrentToView(hash: string, view: string): Promise<boolean> {
    const methodCall: RTorrentMethodCall = {
      methodName: 'd.views.push_back_unique',
      params: [hash, view],
    };

    const response = await this.xmlRpcRequest<number>(methodCall);
    return response === 0;
  }

  /**
   * Remove torrent from view
   * {@link https://github.com/rakshasa/rtorrent/wiki/Commands#views}
   */
  async removeTorrentFromView(hash: string, view: string): Promise<boolean> {
    const methodCall: RTorrentMethodCall = {
      methodName: 'd.views.remove',
      params: [hash, view],
    };

    const response = await this.xmlRpcRequest<number>(methodCall);
    return response === 0;
  }

  /**
   * Check if torrent exists
   * {@link https://github.com/rakshasa/rtorrent/wiki/Commands#name}
   */
  async hasTorrent(hash: string): Promise<boolean> {
    try {
      const methodCall: RTorrentMethodCall = {
        methodName: 'd.name',
        params: [hash],
      };

      const name = await this.xmlRpcRequest<string>(methodCall);
      return name !== '' && name !== `${hash}.meta`;
    } catch {
      return false;
    }
  }

  /**
   * Get torrent properties
   * {@link https://github.com/rakshasa/rtorrent/wiki/Commands#multicall}
   */
  async getTorrentProperties(hash: string): Promise<Partial<RTorrentTorrent>> {
    const torrent = await this.getTorrentRaw(hash);
    return torrent || {};
  }

  /**
   * Get the download limit in bytes/s of the torrent's throttle group.
   * Torrents without a group use the global limit, 0 is unlimited and -1 means the group has no download limit.
   * rTorrent has no per-torrent limits, torrents are assigned to named throttle groups instead.
   * {@link https://rtorrent-docs.readthedocs.io/en/latest/cmd-ref.html#throttle-commands}
   */
  async getDownloadRateLimit(hash: string): Promise<number> {
    const name = await this.getThrottleName(hash);
    return this.xmlRpcRequest<number>({ methodName: 'throttle.down.max', params: ['', name] });
  }

  /**
   * Get the upload limit in bytes/s of the torrent's throttle group.
   * Torrents without a group use the global limit, 0 is unlimited and -1 means the group has no upload limit.
   * {@link https://rtorrent-docs.readthedocs.io/en/latest/cmd-ref.html#throttle-commands}
   */
  async getUploadRateLimit(hash: string): Promise<number> {
    const name = await this.getThrottleName(hash);
    return this.xmlRpcRequest<number>({ methodName: 'throttle.up.max', params: ['', name] });
  }

  /**
   * Create or update a named throttle group, limits are in KiB/s.
   * Assign torrents to it with {@link setTorrentThrottle}
   * {@link https://rtorrent-docs.readthedocs.io/en/latest/cmd-ref.html#term-throttle-down}
   */
  async setThrottleGroup(name: string, downKiB?: number, upKiB?: number): Promise<boolean> {
    const responses: number[] = [];
    // sequential, both calls can create the group
    if (downKiB !== undefined) {
      responses.push(
        await this.xmlRpcRequest<number>({
          methodName: 'throttle.down',
          params: ['', name, String(downKiB)],
        }),
      );
    }
    if (upKiB !== undefined) {
      responses.push(
        await this.xmlRpcRequest<number>({
          methodName: 'throttle.up',
          params: ['', name, String(upKiB)],
        }),
      );
    }

    return responses.every(response => response === 0);
  }

  /**
   * Assign a torrent to a throttle group, an empty name removes it from its group.
   * rTorrent only allows this while the torrent is stopped.
   * {@link https://rtorrent-docs.readthedocs.io/en/latest/cmd-ref.html#term-d-throttle-name-set}
   */
  async setTorrentThrottle(hash: string, name: string): Promise<boolean> {
    const response = await this.xmlRpcRequest<number>({
      methodName: 'd.throttle_name.set',
      params: [hash, name],
    });
    return response === 0;
  }

  /**
   * Get the global download limit in bytes/s, 0 is unlimited
   * {@link https://rtorrent-docs.readthedocs.io/en/latest/cmd-ref.html#term-throttle-global-down-max-rate}
   */
  async getGlobalDownloadRateLimit(): Promise<number> {
    return this.xmlRpcRequest<number>({ methodName: 'throttle.global_down.max_rate', params: [] });
  }

  /**
   * Set the global download limit in bytes/s, 0 is unlimited
   * {@link https://rtorrent-docs.readthedocs.io/en/latest/cmd-ref.html#term-throttle-global-down-max-rate}
   */
  async setGlobalDownloadRateLimit(bytesPerSecond: number): Promise<boolean> {
    const response = await this.xmlRpcRequest<number>({
      methodName: 'throttle.global_down.max_rate.set',
      params: ['', bytesPerSecond],
    });
    return response === 0;
  }

  /**
   * Get the global upload limit in bytes/s, 0 is unlimited
   * {@link https://rtorrent-docs.readthedocs.io/en/latest/cmd-ref.html#term-throttle-global-up-max-rate}
   */
  async getGlobalUploadRateLimit(): Promise<number> {
    return this.xmlRpcRequest<number>({ methodName: 'throttle.global_up.max_rate', params: [] });
  }

  /**
   * Set the global upload limit in bytes/s, 0 is unlimited
   * {@link https://rtorrent-docs.readthedocs.io/en/latest/cmd-ref.html#term-throttle-global-up-max-rate}
   */
  async setGlobalUploadRateLimit(bytesPerSecond: number): Promise<boolean> {
    const response = await this.xmlRpcRequest<number>({
      methodName: 'throttle.global_up.max_rate.set',
      params: ['', bytesPerSecond],
    });
    return response === 0;
  }

  // Shared torrent interface methods

  async getAllData(): Promise<AllClientData> {
    const torrents = await this.getAllTorrents();
    const results: AllClientData = {
      torrents: [],
      labels: [],
      raw: torrents,
    };

    const labels: Record<string, Label> = {};
    for (const torrent of torrents) {
      const normalizedTorrent = normalizeTorrentData(torrent);
      results.torrents.push(normalizedTorrent);

      // Setup label
      if (normalizedTorrent.label) {
        if (labels[normalizedTorrent.label] === undefined) {
          labels[normalizedTorrent.label] = {
            id: normalizedTorrent.label,
            name: normalizedTorrent.label,
            count: 1,
          };
        } else {
          labels[normalizedTorrent.label]!.count += 1;
        }
      }
    }

    results.labels = Object.values(labels);
    return results;
  }

  async addTorrent(
    torrent: string | Uint8Array,
    options: Partial<AddTorrentOptions> = {},
  ): Promise<boolean> {
    if (typeof torrent === 'string') {
      if (torrent.startsWith('magnet:')) {
        return this.addMagnet(torrent, options);
      }
      const fileContent = stringToUint8Array(torrent);
      return this.addTorrentFromFile(fileContent, options.rtorrent);
    }
    return this.addTorrentFromFile(torrent, options.rtorrent);
  }

  async addMagnet(magnetUrl: string, options: Partial<AddTorrentOptions> = {}): Promise<boolean> {
    return this.addTorrentFromUrl(magnetUrl, options.rtorrent);
  }

  async normalizedAddTorrent(
    torrent: string | Uint8Array,
    options: Partial<NormalizedAddTorrentOptions> = {},
  ): Promise<NormalizedTorrent> {
    const rtorrentOptions: AddTorrentUrlOptions = {};

    if (options.startPaused) {
      rtorrentOptions.start = false;
    }

    if (options.label) {
      rtorrentOptions.label = options.label;
    }

    let torrentHash: string | undefined;
    if (typeof torrent === 'string' && torrent.startsWith('magnet:')) {
      torrentHash = magnetDecode(torrent).infoHash;
      if (!torrentHash) {
        throw new Error('Magnet did not contain hash');
      }
      await this.addMagnet(torrent, { rtorrent: rtorrentOptions });
    } else {
      if (!isUint8Array(torrent)) {
        torrent = stringToUint8Array(torrent);
      }
      torrentHash = torrentFileHash(torrent);
      await this.addTorrent(torrent, { rtorrent: rtorrentOptions });
    }

    // Wait for torrent to be available before returning
    const maxAttempts = 20;
    const delayMs = 500;

    for (let i = 0; i < maxAttempts; i++) {
      const found = await this.getTorrentRaw(torrentHash);
      if (found !== null) {
        return this.getTorrent(torrentHash);
      }
      await new Promise(resolve => {
        setTimeout(resolve, delayMs);
      });
    }

    throw new Error(`Torrent with hash ${torrentHash} not found after ${maxAttempts * delayMs}ms`);
  }

  async removeTorrent(hash: string | string[], deleteFiles = false): Promise<void> {
    if (deleteFiles) {
      // rTorrent doesn't have a direct way to delete files,
      // ruTorrent could potentially handle, radarr does this via filesystem
      throw new Error('rTorrent does not support deleting files via API');
    }

    for (const h of toHashes(hash)) {
      await this.removeTorrentInternal(h);
    }
  }

  async pauseTorrent(hash: string | string[]): Promise<void> {
    for (const h of toHashes(hash)) {
      await this.stopTorrent(h);
    }
  }

  /**
   * Resumes stopped torrents and torrents paused with `d.pause` (ruTorrent's pause button).
   * `d.start` does nothing for a paused torrent and `d.resume` does nothing for a stopped one.
   * {@link https://rtorrent-docs.readthedocs.io/en/latest/cmd-ref.html#term-d-resume}
   */
  async resumeTorrent(hash: string | string[]): Promise<void> {
    for (const h of toHashes(hash)) {
      await this.startTorrent(h);
      await this.xmlRpcRequest<number>({ methodName: 'd.resume', params: [h] });
    }
  }

  async queueUp(hash: string | string[]): Promise<void> {
    // rTorrent doesn't have explicit queue up/down, use priority instead
    for (const h of toHashes(hash)) {
      await this.setTorrentPriority(h, RTorrentPriority.High);
    }
  }

  async queueDown(hash: string | string[]): Promise<void> {
    // rTorrent doesn't have explicit queue up/down, use priority instead
    for (const h of toHashes(hash)) {
      await this.setTorrentPriority(h, RTorrentPriority.Low);
    }
  }

  // Private helper methods

  private async getThrottleName(hash: string): Promise<string> {
    return this.xmlRpcRequest<string>({ methodName: 'd.throttle_name', params: [hash] });
  }

  private async xmlRpcRequest<T>(methodCall: RTorrentMethodCall): Promise<T> {
    const url = joinURL(this.config.baseUrl, this.config.path ?? '');

    const xmlBody = buildXmlRpcRequest(methodCall);

    const headers: Record<string, string> = {
      'Content-Type': 'text/xml',
      'User-Agent': 'RTorrent-Client/1.0',
    };

    // Add Basic Auth header if credentials are provided
    if (this.config.username && this.config.password) {
      const credentials = stringToBase64(`${this.config.username}:${this.config.password}`);
      headers.Authorization = `Basic ${credentials}`;
    }

    const response = await ofetch<string>(url, {
      method: 'POST',
      headers,
      body: xmlBody,
      timeout: this.config.timeout,
    });

    return parseXmlRpcResponse<T>(response);
  }

  private parseTorrentData(row: unknown[]): RTorrentTorrent {
    return {
      name: row[0] as string,
      hash: row[1] as string,
      basePath: row[2] as string,
      custom1: row[3] as string,
      sizeBytes: row[4] as number,
      leftBytes: row[5] as number,
      downRate: row[6] as number,
      ratio: row[7] as number,
      isOpen: Boolean(row[8]),
      isActive: Boolean(row[9]),
      isComplete: Boolean(row[10]),
      finishedTime: row[11] as number,
      state: row[12] as number,
      upRate: row[13] as number,
      priority: row[14] as RTorrentPriority,
      peersConnected: row[15] as number,
      peersAccounted: row[16] as number,
      peersComplete: row[17] as number,
      creationDate: row[18] as number,
      isPrivate: Boolean(row[19]),
      isMultiFile: Boolean(row[20]),
      chunkSize: row[21] as number,
      completedChunks: row[22] as number,
      sizeChunks: row[23] as number,
      bytesDone: row[24] as number,
      upTotal: row[25] as number,
      freeDiskspace: row[26] as number,
      throttleName: row[27] as string,
      custom2: row[28] as string,
      message: row[29] as string,
      trackerFocus: row[30] as number,
      stateChanged: row[31] as number,
      skipTotal: row[32] as number,
      hashing: row[33] as number,
      chunksHashed: row[34] as number,
      loadDate: row[35] as number,
      views: [],
    };
  }
}
