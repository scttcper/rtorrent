import { XMLParser } from 'fast-xml-parser';

import type { RTorrentFault } from './types.js';

// Centralized XML parser instance to share configuration across the project
export const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  parseAttributeValue: true,
  // keep string values as-is, numeric XML-RPC types are converted in parseXmlValue
  parseTagValue: false,
  trimValues: false,
});

export function escapeXml(str: string): string {
  return str
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function toArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

/**
 * Converts a parsed XML-RPC `<value>` into a JS value
 * {@link https://xmlrpc.com/spec.md}
 */
export function parseXmlValue(value: any): unknown {
  // A <value> without a type element is a string
  if (typeof value === 'string') {
    return value;
  }

  if ('string' in value) {
    return value.string;
  }

  if ('i8' in value || 'i4' in value || 'int' in value) {
    return Number(value.i8 ?? value.i4 ?? value.int);
  }

  if ('double' in value) {
    return Number(value.double);
  }

  if ('boolean' in value) {
    return value.boolean === '1';
  }

  if ('array' in value) {
    return toArray(value.array?.data?.value).map(item => parseXmlValue(item));
  }

  if ('struct' in value) {
    return Object.fromEntries(
      toArray<any>(value.struct?.member).map(member => [member.name, parseXmlValue(member.value)]),
    );
  }

  if ('base64' in value) {
    return Buffer.from(value.base64, 'base64');
  }

  if ('nil' in value) {
    return null;
  }

  throw new Error('Unable to parse XML-RPC response value');
}

export function buildXmlRpcRequest(methodCall: { methodName: string; params: unknown[] }): string {
  let xml = '<?xml version="1.0"?><methodCall>';
  xml += `<methodName>${methodCall.methodName}</methodName>`;
  xml += '<params>';

  for (const param of methodCall.params) {
    xml += '<param><value>';
    if (typeof param === 'string') {
      xml += `<string>${escapeXml(param)}</string>`;
    } else if (typeof param === 'number') {
      // Use i8 for large numbers, i4 for smaller ones
      if (param > 2_147_483_647 || param < -2_147_483_648) {
        xml += `<i8>${param}</i8>`;
      } else {
        xml += `<i4>${param}</i4>`;
      }
    } else if (param instanceof Uint8Array) {
      xml += `<base64>${Buffer.from(param).toString('base64')}</base64>`;
    } else {
      xml += `<string>${escapeXml(String(param))}</string>`;
    }
    xml += '</value></param>';
  }

  xml += '</params></methodCall>';
  return xml;
}

export function parseXmlRpcResponse<T>(xml: string): T {
  try {
    const parsed = xmlParser.parse(xml);

    // Check for faults
    if (parsed.methodResponse?.fault) {
      handleXmlRpcFault(parsed.methodResponse.fault);
    }

    // Extract response value
    const value = parsed.methodResponse?.params?.param?.value;
    if (value === undefined) {
      throw new Error('No value found in XML-RPC response');
    }

    return parseXmlValue(value) as T;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to parse XML-RPC response');
  }
}

export function handleXmlRpcFault(fault: any): never {
  const { faultCode, faultString } = parseXmlValue(fault.value) as RTorrentFault;

  throw new Error(`XML-RPC Fault ${faultCode}: ${faultString}`);
}
