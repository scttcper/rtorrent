import {
  AddTorrentOptions as NormalizedAddTorrentOptions,
  AllClientData,
  NormalizedTorrent,
  TorrentClient,
  TorrentSettings,
  TorrentState,
} from '@ctrl/shared-torrent';
import { hash } from '@ctrl/torrent-file';
import FormData from 'form-data';
import fs from 'fs';
import got, { GotBodyOptions, GotJSONOptions, Response } from 'got';
import { Cookie } from 'tough-cookie';
import { URLSearchParams } from 'url';
import urlJoin from 'url-join';
import builder from 'xmlbuilder';
import htmlparser from 'htmlparser2';

const defaults: TorrentSettings = {
  baseUrl: 'http://localhost:8000/',
  path: '/RPC2',
  username: 'admin',
  password: '',
  timeout: 5000,
};

export class Rtorrent {
  config: TorrentSettings;

  constructor(options: Partial<TorrentSettings> = {}) {
    this.config = { ...defaults, ...options };
  }

  async getTorrents() {
    const obj = {
      methodCall: {
        methodName: 'd.multicall2',
        params: {
          param: [
            {
              value: {},
            },
            {
              value: { string: 'main' },
            },
            {
              value: { string: 'd.hash=' },
            },
            {
              value: { string: 'd.is_open=' },
            },
            {
              value: { string: 'd.is_hash_checking=' },
            },
            {
              value: { string: 'd.is_hash_checked=' },
            },
            {
              value: { string: 'd.state=' },
            },
            {
              value: { string: 'd.name=' },
            },
            {
              value: { string: 'd.size_bytes=' },
            },
            {
              value: { string: 'd.completed_chunks=' },
            },
            {
              value: { string: 'd.size_chunks=' },
            },
            {
              value: { string: 'd.bytes_done=' },
            },
            {
              value: { string: 'd.up.total=' },
            },
            {
              value: { string: 'd.ratio=' },
            },
            {
              value: { string: 'd.up.rate=' },
            },
            {
              value: { string: 'd.down.rate=' },
            },
            {
              value: { string: 'd.chunk_size=' },
            },
            {
              value: { string: 'd.custom1=' },
            },
            {
              value: { string: 'd.peers_accounted=' },
            },
            {
              value: { string: 'd.peers_not_connected=' },
            },
            {
              value: { string: 'd.peers_connected=' },
            },
            {
              value: { string: 'd.peers_complete=' },
            },
            {
              value: { string: 'd.left_bytes=' },
            },
            {
              value: { string: 'd.priority=' },
            },
            {
              value: { string: 'd.state_changed=' },
            },
            {
              value: { string: 'd.skip.total=' },
            },
            {
              value: { string: 'd.hashing=' },
            },
            {
              value: { string: 'd.chunks_hashed=' },
            },
            {
              value: { string: 'd.base_path=' },
            },
            {
              value: { string: 'd.creation_date=' },
            },
            {
              value: { string: 'd.tracker_focus=' },
            },
            {
              value: { string: 'd.is_active=' },
            },
            {
              value: { string: 'd.message=' },
            },
            {
              value: { string: 'd.custom2=' },
            },
            {
              value: { string: 'd.free_diskspace=' },
            },
            {
              value: { string: 'd.is_private=' },
            },
            {
              value: { string: 'd.is_multi_file=' },
            },
            {
              value: { string: 'd.throttle_name=' },
            },
            {
              value: { string: 'd.custom=chk-state' },
            },
            {
              value: { string: 'd.custom=chk-time' },
            },
            {
              value: { string: 'd.custom=sch_ignore' },
            },
            {
              value: {
                string: 'cat="$t.multicall=d.hash=,t.scrape_complete=,cat={#}"',
              },
            },
            {
              value: {
                string: 'cat="$t.multicall=d.hash=,t.scrape_incomplete=,cat={#}"',
              },
            },
            {
              value: { string: 'd.custom=x-pushbullet' },
            },
            {
              value: { string: 'cat=$d.views=' },
            },
            {
              value: { string: 'd.custom=seedingtime' },
            },
            {
              value: { string: 'd.custom=addtime' },
            },
          ],
        },
      },
    };

    const xml = builder.create(obj, { encoding: 'UTF-8' }).end();
    const res = await got.post('http://localhost:8080/plugins/rpc/rpc.php', {
      body: xml,
    });

    let count = 2;
    const parser = new htmlparser.Parser(
      {
        onopentag(name, attribs) {
          console.log({ name });
        },
        ontext(text) {
          console.log('-->', { key: obj.methodCall.params.param[count].value.string, value: text });
          count++;
        },
        onend() {
          console.log('That\'s it?!');
        },
      } as any,
      { decodeEntities: true },
    );
    parser.parseComplete(res.body.replace(/\r?\n|\r/g, ''));
    return res.body;
  }

  async request() {
    const url = urlJoin(this.config.baseUrl, this.config.path);
    const params = new URLSearchParams();
    const options: GotJSONOptions = {
      headers: {
        Authorization: this._authorization(),
      },
      query: params,
      retry: 0,
      json: true,
    };

    if (this.config.timeout) {
      options.timeout = this.config.timeout;
    }

    if (this.config.agent) {
      options.agent = this.config.agent;
    }

    return got.get(url, options);
  }

  private _authorization() {
    const str = `${this.config.username || ''}:${this.config.password || ''}`;
    const encoded = Buffer.from(str).toString('base64');
    return 'Basic ' + encoded;
  }
}
