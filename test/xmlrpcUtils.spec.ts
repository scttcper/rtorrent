import { describe, expect, it } from 'vitest';

import { buildXmlRpcRequest, parseXmlRpcResponse } from '../src/xmlrpcUtils.js';

function response(value: string) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<methodResponse>
<params>
<param><value>${value}</value></param>
</params>
</methodResponse>`;
}

describe('parseXmlRpcResponse', () => {
  it('should parse multicall rows', () => {
    // shape of a d.multicall2 response from rTorrent 0.9.8
    const xml = response(`<array><data>
<value><array><data>
<value><string>E84213A794F3CCD890382A54A64CA68B7E925433</string></value>
<value><i8>1953349632</i8></value>
</data></array></value>
<value><array><data>
<value><string>893B9365EE2B98751C41A2B59296BEF747532221</string></value>
<value><i8>70000</i8></value>
</data></array></value>
</data></array>`);
    expect(parseXmlRpcResponse(xml)).toEqual([
      ['E84213A794F3CCD890382A54A64CA68B7E925433', 1_953_349_632],
      ['893B9365EE2B98751C41A2B59296BEF747532221', 70_000],
    ]);
  });

  it('should parse single row and single column arrays', () => {
    const xml = response(
      '<array><data><value><array><data><value><i8>1</i8></value></data></array></value></data></array>',
    );
    expect(parseXmlRpcResponse(xml)).toEqual([[1]]);
  });

  it('should parse empty arrays', () => {
    expect(parseXmlRpcResponse(response('<array><data>\n</data></array>'))).toEqual([]);
    expect(
      parseXmlRpcResponse(
        response('<array><data><value><array><data></data></array></value></data></array>'),
      ),
    ).toEqual([[]]);
  });

  it('should parse a flat string array', () => {
    const xml = response(
      '<array><data><value><string>main</string></value><value><string>default</string></value></data></array>',
    );
    expect(parseXmlRpcResponse(xml)).toEqual(['main', 'default']);
  });

  it('should not coerce or trim strings', () => {
    expect(parseXmlRpcResponse(response('<string>007</string>'))).toBe('007');
    expect(parseXmlRpcResponse(response('<string>10</string>'))).toBe('10');
    expect(parseXmlRpcResponse(response('<string>  spaced  </string>'))).toBe('  spaced  ');
    expect(parseXmlRpcResponse(response('<string>a &amp; &lt;b&gt;</string>'))).toBe('a & <b>');
    expect(parseXmlRpcResponse(response('<string></string>'))).toBe('');
  });

  it('should treat a value without a type as a string', () => {
    expect(parseXmlRpcResponse(response('007'))).toBe('007');
    expect(parseXmlRpcResponse(response(''))).toBe('');
  });

  it('should parse scalar types', () => {
    expect(parseXmlRpcResponse(response('<i4>0</i4>'))).toBe(0);
    expect(parseXmlRpcResponse(response('<i8>-1</i8>'))).toBe(-1);
    expect(parseXmlRpcResponse(response('<int>42</int>'))).toBe(42);
    expect(parseXmlRpcResponse(response('<double>1.5</double>'))).toBe(1.5);
    expect(parseXmlRpcResponse(response('<boolean>1</boolean>'))).toBe(true);
    expect(parseXmlRpcResponse(response('<boolean>0</boolean>'))).toBe(false);
    expect(parseXmlRpcResponse(response('<nil/>'))).toBeNull();
    expect(parseXmlRpcResponse(response('<base64>aGk=</base64>'))).toEqual(Buffer.from('hi'));
  });

  it('should parse structs', () => {
    const xml = response(`<struct>
<member><name>name</name><value><string>007</string></value></member>
<member><name>files</name><value><array><data><value><i8>1</i8></value></data></array></value></member>
</struct>`);
    expect(parseXmlRpcResponse(xml)).toEqual({ name: '007', files: [1] });
  });

  it('should throw faults', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<methodResponse><fault><value><struct><member><name>faultCode</name><value><i4>-506</i4></value></member><member><name>faultString</name><value><string>Method 'd.throttle.down' not defined</string></value></member></struct></value></fault></methodResponse>`;
    expect(() => parseXmlRpcResponse(xml)).toThrow(
      "XML-RPC Fault -506: Method 'd.throttle.down' not defined",
    );
  });
});

describe('buildXmlRpcRequest', () => {
  it('should escape strings', () => {
    expect(buildXmlRpcRequest({ methodName: 'd.custom1.set', params: ['hash', '<a&b>'] })).toBe(
      '<?xml version="1.0"?><methodCall><methodName>d.custom1.set</methodName><params><param><value><string>hash</string></value></param><param><value><string>&lt;a&amp;b&gt;</string></value></param></params></methodCall>',
    );
  });
});
