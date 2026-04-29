/**
 * XLSX adapter using xlsx library
 */

let XLSX: any = null;

async function getXLSX() {
  if (!XLSX) {
    XLSX = await import('xlsx');
  }
  return XLSX;
}

export async function parseXLSX(
  buffer: Buffer,
  signal?: AbortSignal
): Promise<{ content: string; metadata?: Record<string, any> }> {
  const lib = await getXLSX();

  try {
    const workbook = lib.read(buffer, { type: 'buffer' });

    const sections: string[] = [];

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];

      // Add sheet header
      sections.push(`## Sheet: ${sheetName}\n`);

      // Convert to markdown table
      const tableMarkdown = sheetToMarkdownTable(sheet, lib);
      sections.push(tableMarkdown);
      sections.push('');
    }

    const content = sections.join('\n');

    return {
      content,
      metadata: {
        sheets: workbook.SheetNames.length,
      },
    };
  } catch (error) {
    throw new Error(`Failed to parse XLSX: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Convert sheet to markdown table
 */
function sheetToMarkdownTable(sheet: any, XLSX: any): string {
  // Get range
  const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');

  const rows: string[][] = [];

  // Iterate through rows
  for (let row = range.s.r; row <= range.e.r; row++) {
    const rowData: string[] = [];
    for (let col = range.s.c; col <= range.e.c; col++) {
      const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
      const cell = sheet[cellAddress];
      rowData.push(cell ? String(cell.v ?? '') : '');
    }
    rows.push(rowData);
  }

  // Skip empty rows at the end
  while (rows.length > 0 && rows[rows.length - 1].every(cell => cell === '')) {
    rows.pop();
  }

  if (rows.length === 0) {
    return '*(Empty sheet)*';
  }

  // Build markdown table
  const colCount = Math.max(...rows.map(r => r.length));
  const lines: string[] = [];

  // Header row
  if (rows.length > 0) {
    const header = rows[0];
    lines.push(`| ${header.map(padCell).join(' | ')} |`);
    lines.push(`| ${Array(colCount).fill('---').join(' | ')} |`);
  }

  // Data rows
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    while (row.length < colCount) {
      row.push('');
    }
    lines.push(`| ${row.map(padCell).join(' | ')} |`);
  }

  return lines.join('\n');
}

function padCell(cell: string): string {
  return cell.trim();
}
