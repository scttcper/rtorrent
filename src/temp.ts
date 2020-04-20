import { Rtorrent } from '../src';

const baseUrl = 'http://decent.duckdns.org/deluge/';
const client = new Rtorrent({ baseUrl, username: 'admin', password: 'admin' });

(async () => {
  const results = await client.getTorrents();
  console.log(results);
})();
