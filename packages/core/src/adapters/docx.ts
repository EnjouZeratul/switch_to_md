/**
 * DOCX adapter using mammoth
 */

let mammoth: any = null;

async function getMammoth() {
  if (!mammoth) {
    mammoth = await import('mammoth');
  }
  return mammoth;
}

export async function parseDOCX(
  buffer: Buffer,
  signal?: AbortSignal
): Promise<{ content: string; metadata?: Record<string, any> }> {
  const lib = await getMammoth();

  try {
    // Convert to markdown
    const result = await lib.convertToMarkdown(buffer, {
      styleMap: [
        "p[style-name='Title'] => #",
        "p[style-name='Heading 1'] => ##",
        "p[style-name='Heading 2'] => ###",
        "p[style-name='Heading 3'] => ####",
        "p[style-name='Heading 4'] => #####",
      ],
    });

    let content = result.value;

    // Handle any conversion messages/warnings
    const warnings = result.messages
      .filter((m: any) => m.type === 'warning')
      .map((m: any) => m.message);

    // Clean up content
    content = cleanupMarkdown(content);

    return {
      content,
      metadata: {
        warnings: warnings.length > 0 ? warnings : undefined,
      },
    };
  } catch (error) {
    throw new Error(`Failed to parse DOCX: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function cleanupMarkdown(markdown: string): string {
  // Remove excessive newlines
  markdown = markdown.replace(/\n{3,}/g, '\n\n');

  // Ensure proper spacing around headers
  markdown = markdown.replace(/([^\n])\n(#{1,6} )/g, '$1\n\n$2');

  return markdown.trim();
}
