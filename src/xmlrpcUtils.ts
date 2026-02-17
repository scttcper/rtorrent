import { XMLParser } from 'fast-xml-parser';

// Centralized XML parser instance to share configuration across the project
export const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  parseAttributeValue: true,
  parseTagValue: true,
  trimValues: true,
});

export function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function isVersionGreater(version1: string, version2: string): boolean {
  const v1Parts = version1.split('.').map(Number);
  const v2Parts = version2.split('.').map(Number);

  for (let i = 0; i < Math.max(v1Parts.length, v2Parts.length); i++) {
    const v1Part = v1Parts[i] || 0;
    const v2Part = v2Parts[i] || 0;

    if (v1Part > v2Part) {
      return true;
    }
    if (v1Part < v2Part) {
      return false;
    }
  }

  return false;
}

export function extractNumberValue(value: any): number | null {
  const numValue = value.int ?? value.i4 ?? value.i8;
  return numValue !== undefined ? Number(numValue) : null;
}

export function parseXmlValue(value: any): unknown {
  if (value.string !== undefined) {
    return value.string;
  }

  if ('int' in value || 'i4' in value || 'i8' in value) {
    return extractNumberValue(value);
  }

  if (value.array) {
    return parseXmlArrayFromParsed(value.array);
  }

  if (value.base64 !== undefined) {
    return Buffer.from(value.base64, 'base64');
  }

  throw new Error('Unable to parse XML-RPC response value');
}

export function parseXmlArrayFromParsed(array: any): unknown[][] {
  const results: unknown[][] = [];

  if (!array.data) {
    return results;
  }

  const dataItems = Array.isArray(array.data) ? array.data : [array.data];

  for (const dataItem of dataItems) {
    const row = parseXmlArrayItem(dataItem);
    if (row.length > 0) {
      results.push(row);
    }
  }

  return results;
}

export function parseXmlArrayItem(dataItem: any): unknown[] {
  const row: unknown[] = [];

  if (dataItem.value && dataItem.value.array) {
    let rowData = dataItem.value.array.data;
    if (rowData && rowData.value) {
      rowData = rowData.value;
    }
    const values = Array.isArray(rowData) ? rowData : [rowData];
    for (const value of values) {
      row.push(parseXmlValue(value));
    }
  } else if (dataItem.value && Array.isArray(dataItem.value)) {
    for (const value of dataItem.value) {
      row.push(parseXmlValue(value));
    }
  }

  return row;
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
    if (!value) {
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
  let faultCode = 'unknown';
  let faultString = 'Unknown error';

  if (fault.value?.struct?.member) {
    const members = Array.isArray(fault.value.struct.member)
      ? fault.value.struct.member
      : [fault.value.struct.member];

    const faultCodeMember = members.find((m: any) => m.name === 'faultCode');
    const faultStringMember = members.find((m: any) => m.name === 'faultString');

    if (faultCodeMember?.value) {
      const code = extractNumberValue(faultCodeMember.value);
      faultCode = code !== null ? String(code) : 'unknown';
    }
    if (faultStringMember?.value) {
      faultString = faultStringMember.value.string || 'Unknown error';
    }
  }

  throw new Error(`XML-RPC Fault ${faultCode}: ${faultString}`);
}
