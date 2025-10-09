import { XMLParser } from 'fast-xml-parser';
import { ofetch } from 'ofetch';
import type { Jsonify } from 'type-fest';
import { joinURL } from 'ufo';
import { isUint8Array, stringToUint8Array } from 'uint8array-extras';

import { magnetDecode } from '@ctrl/magnet-link';
import type {
  AddTorrentOptions as NormalizedAddTorrentOptions,
  AllClientData,
  Label,
  NormalizedTorrent,
  TorrentClient,
  TorrentClientState,
} from '@ctrl/shared-torrent';
import { hash } from '@ctrl/torrent-file';

import { normalizeTorrentData } from './normalizeTorrentData.js';
import {
  AddTorrentFileOptions,
  AddTorrentOptions,
  AddTorrentUrlOptions,
  RTorrentConfig,
  RTorrentMethodCall,
  RTorrentPeer,
  RTorrentPriority,
  RTorrentSystemInfo,
  RTorrentTorrent,
  RTorrentTracker,
  RTorrentView,
} from './types.js';

interface RTorrentState extends TorrentClientState {
  version?: {
    version: string;
    isVersion090OrHigher: boolean;
  };
}

const defaults: RTorrentConfig = {
  baseUrl: 'http://localhost:8080',
  path: '/RPC2',
  username: '',
  password: '',
  timeout: 5000,
  useSsl: false,
};

// XML-RPC parser configuration
const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  parseAttributeValue: true,
  parseTagValue: true,
  trimValues: true,
});

export class RTorrent implements TorrentClient {
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

    // Cache version info
    if (!this.state.version?.version) {
      const cleanVersion = version.replace(/^v/, '').split('-')[0]!;
      this.state.version = {
        version,
        isVersion090OrHigher:
          cleanVersion === '0.9.0' || this.isVersionGreater(cleanVersion, '0.9.0'),
      };
    }

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
  async getTorrentFiles(hash: string): Promise<unknown[]> {
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

    return this.xmlRpcRequest<unknown[][]>(methodCall);
  }

  /**
   * Get torrent trackers
   * {@link https://github.com/rakshasa/rtorrent/wiki/Commands#trackers}
   */
  async getTorrentTrackers(hash: string): Promise<RTorrentTracker[]> {
    const methodCall: RTorrentMethodCall = {
      methodName: 't.multicall',
      params: [hash, '', 't.url=', 't.is_enabled=', 't.is_open=', 't.is_usable=', 't.can_scrape='],
    };

    const response = await this.xmlRpcRequest<unknown[][]>(methodCall);
    return response.map(row => ({
      url: row[0] as string,
      status: row[1] as string,
      message: '',
      peers: 0,
      seeds: 0,
      leechers: 0,
      completed: 0,
    }));
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
        'p.client=',
        'p.down_rate=',
        'p.up_rate=',
        'p.peer_rate=',
        'p.peer_total=',
        'p.peer_downloaded=',
        'p.peer_uploaded=',
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
      flags: '',
      bytesDownloaded: row[8] as number,
      bytesUploaded: row[9] as number,
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

    const response = await this.xmlRpcRequest<string[]>(methodCall);
    return response.map(name => ({ name, count: 0 }));
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
   * Get torrent download rate limit
   * {@link https://github.com/rakshasa/rtorrent/wiki/Commands#throttle}
   */
  async getDownloadRateLimit(hash: string): Promise<number> {
    const methodCall: RTorrentMethodCall = {
      methodName: 'd.throttle.down',
      params: [hash],
    };

    return this.xmlRpcRequest<number>(methodCall);
  }

  /**
   * Get torrent upload rate limit
   * {@link https://github.com/rakshasa/rtorrent/wiki/Commands#throttle}
   */
  async getUploadRateLimit(hash: string): Promise<number> {
    const methodCall: RTorrentMethodCall = {
      methodName: 'd.throttle.up',
      params: [hash],
    };

    return this.xmlRpcRequest<number>(methodCall);
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
      } else {
        const fileContent = stringToUint8Array(torrent);
        return this.addTorrentFromFile(fileContent, options.rtorrent);
      }
    } else {
      return this.addTorrentFromFile(torrent, options.rtorrent);
    }
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
      torrentHash = hash(torrent);
      await this.addTorrent(torrent, { rtorrent: rtorrentOptions });
    }

    // Wait for torrent to be available before returning
    const maxAttempts = 20;
    const delayMs = 500;

    for (let i = 0; i < maxAttempts; i++) {
      const torrent = await this.getTorrentRaw(torrentHash);
      if (torrent !== null) {
        return this.getTorrent(torrentHash);
      }
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }

    throw new Error(`Torrent with hash ${torrentHash} not found after ${maxAttempts * delayMs}ms`);
  }

  async removeTorrent(hash: string, deleteFiles = false): Promise<boolean> {
    if (deleteFiles) {
      // rTorrent doesn't have a direct way to delete files,
      // this would need to be handled externally
      console.warn('rTorrent does not support deleting files via API');
    }
    return this.removeTorrentInternal(hash);
  }

  async pauseTorrent(hash: string): Promise<boolean> {
    return this.stopTorrent(hash);
  }

  async resumeTorrent(hash: string): Promise<boolean> {
    return this.startTorrent(hash);
  }

  async queueUp(hash: string): Promise<boolean> {
    // rTorrent doesn't have explicit queue up/down, use priority instead
    return this.setTorrentPriority(hash, RTorrentPriority.High);
  }

  async queueDown(hash: string): Promise<boolean> {
    // rTorrent doesn't have explicit queue up/down, use priority instead
    return this.setTorrentPriority(hash, RTorrentPriority.Low);
  }

  // Private helper methods

  private async xmlRpcRequest<T>(methodCall: RTorrentMethodCall): Promise<T> {
    const url = joinURL(this.config.baseUrl, this.config.path ?? '');

    const xmlBody = this.buildXmlRpcRequest(methodCall);
    const response = await ofetch<string>(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml',
        'User-Agent': 'RTorrent-Client/1.0',
      },
      body: xmlBody,
      timeout: this.config.timeout,
    });

    return this.parseXmlRpcResponse<T>(response);
  }

  private buildXmlRpcRequest(methodCall: RTorrentMethodCall): string {
    let xml = '<?xml version="1.0"?><methodCall>';
    xml += `<methodName>${methodCall.methodName}</methodName>`;
    xml += '<params>';

    for (const param of methodCall.params) {
      xml += '<param><value>';
      if (typeof param === 'string') {
        xml += `<string>${this.escapeXml(param)}</string>`;
      } else if (typeof param === 'number') {
        // Use i8 for large numbers, i4 for smaller ones
        if (param > 2147483647 || param < -2147483648) {
          xml += `<i8>${param}</i8>`;
        } else {
          xml += `<i4>${param}</i4>`;
        }
      } else if (param instanceof Uint8Array) {
        xml += `<base64>${Buffer.from(param).toString('base64')}</base64>`;
      } else {
        xml += `<string>${this.escapeXml(String(param))}</string>`;
      }
      xml += '</value></param>';
    }

    xml += '</params></methodCall>';
    return xml;
  }

  private parseXmlRpcResponse<T>(xml: string): T {
    try {
      const parsed = xmlParser.parse(xml);

      // Check for faults
      if (parsed.methodResponse?.fault) {
        this.handleXmlRpcFault(parsed.methodResponse.fault);
      }

      // Extract response value
      const value = parsed.methodResponse?.params?.param?.value;
      if (!value) {
        throw new Error('No value found in XML-RPC response');
      }

      return this.parseXmlValue(value) as T;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to parse XML-RPC response');
    }
  }

  private handleXmlRpcFault(fault: any): never {
    let faultCode = 'unknown';
    let faultString = 'Unknown error';

    if (fault.value?.struct?.member) {
      const members = Array.isArray(fault.value.struct.member)
        ? fault.value.struct.member
        : [fault.value.struct.member];

      const faultCodeMember = members.find((m: any) => m.name === 'faultCode');
      const faultStringMember = members.find((m: any) => m.name === 'faultString');

      if (faultCodeMember?.value) {
        const code = this.extractNumberValue(faultCodeMember.value);
        faultCode = code !== null ? String(code) : 'unknown';
      }
      if (faultStringMember?.value) {
        faultString = faultStringMember.value.string || 'Unknown error';
      }
    }

    throw new Error(`XML-RPC Fault ${faultCode}: ${faultString}`);
  }

  private parseXmlValue(value: any): unknown {
    // Handle string values
    if (value.string !== undefined) {
      return value.string;
    }

    // Handle integer values
    if ('int' in value || 'i4' in value || 'i8' in value) {
      return this.extractNumberValue(value);
    }

    // Handle array values
    if (value.array) {
      return this.parseXmlArrayFromParsed(value.array);
    }

    // Handle base64 values
    if (value.base64 !== undefined) {
      return Buffer.from(value.base64, 'base64');
    }

    throw new Error('Unable to parse XML-RPC response value');
  }

  private extractNumberValue(value: any): number | null {
    const numValue = value.int ?? value.i4 ?? value.i8;
    return numValue !== undefined ? Number(numValue) : null;
  }

  private parseXmlArrayFromParsed(array: any): unknown[][] {
    const results: unknown[][] = [];

    if (!array.data) {
      return results;
    }

    // Handle single array or array of arrays
    const dataItems = Array.isArray(array.data) ? array.data : [array.data];

    for (const dataItem of dataItems) {
      const row = this.parseXmlArrayItem(dataItem);
      if (row.length > 0) {
        results.push(row);
      }
    }

    return results;
  }

  private parseXmlArrayItem(dataItem: any): unknown[] {
    const row: unknown[] = [];

    if (dataItem.value && dataItem.value.array) {
      // Handle nested array structure
      let rowData = dataItem.value.array.data;

      // Handle nested value structure
      if (rowData && rowData.value) {
        rowData = rowData.value;
      }

      // Handle single value or array of values
      const values = Array.isArray(rowData) ? rowData : [rowData];
      for (const value of values) {
        row.push(this.parseXmlValue(value));
      }
    } else if (dataItem.value && Array.isArray(dataItem.value)) {
      // Handle direct array of values
      for (const value of dataItem.value) {
        row.push(this.parseXmlValue(value));
      }
    }

    return row;
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
      views: [],
    };
  }

  private escapeXml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private isVersionGreater(version1: string, version2: string): boolean {
    const v1Parts = version1.split('.').map(Number);
    const v2Parts = version2.split('.').map(Number);

    for (let i = 0; i < Math.max(v1Parts.length, v2Parts.length); i++) {
      const v1Part = v1Parts[i] || 0;
      const v2Part = v2Parts[i] || 0;

      if (v1Part > v2Part) return true;
      if (v1Part < v2Part) return false;
    }

    return false;
  }
}
