
import sharp from 'sharp';
import { tmpdir } from 'os';
import { writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';

const IMAGE_BOX = { width: 920, height: 520, x: 52, y: 195 };
const DATE_BOX = { width: 920, height: 45, x: 52, y: 150 };
const HEADLINE_Y = 745;

export async function createNewsTemplate(userImageBuffer, headline, dateStr, templateBuffer) {
  try {
    // Resize user image to fit content box
    const resizedImage = await sharp(userImageBuffer)
      .resize(IMAGE_BOX.width, IMAGE_BOX.height, { fit: 'cover', position: 'center' })
      .toBuffer();

    // Create date box with SVG
    const dateBoxSvg = `
      <svg width="920" height="45" xmlns="http://www.w3.org/2000/svg">
        <rect width="920" height="45" fill="rgba(139,0,0,0.85)"/>
        <text x="900" y="30" font-family="Arial" font-size="28" font-weight="bold" fill="white" text-anchor="end">${escapeXml(dateStr)}</text>
      </svg>
    `;

    // Create headline image with SVG text
    const headlineImageBuffer = await createHeadlineImage(headline);

    // Composite all layers onto template
    const result = await sharp(templateBuffer)
      .composite([
        { input: Buffer.from(dateBoxSvg), top: DATE_BOX.y, left: DATE_BOX.x },
        { input: resizedImage, top: IMAGE_BOX.y, left: IMAGE_BOX.x },
        { input: headlineImageBuffer, top: HEADLINE_Y, left: 0 }
      ])
      .png()
      .toBuffer();

    return result;
  } catch (e) {
    console.error('[Template] Error creating template:', e.message);
    throw new Error(`Failed to create template: ${e.message}`);
  }
}

async function createHeadlineImage(headline) {
  try {
    let fontSize = 56;
    if (headline.length > 50) fontSize = 32;
    else if (headline.length > 40) fontSize = 38;
    else if (headline.length > 30) fontSize = 44;
    else if (headline.length > 20) fontSize = 52;

    const lines = wrapText(headline, fontSize, 860);

    let finalFontSize = fontSize;
    if (lines.length > 4) finalFontSize = Math.max(24, fontSize - 12);
    else if (lines.length > 2) finalFontSize = Math.max(28, fontSize - 6);

    const lineHeight = Math.ceil(finalFontSize * 1.4);
    const height = lineHeight * lines.length + 40;

    let textElements = '';
    lines.forEach((line, idx) => {
      const y = finalFontSize + 20 + (idx * lineHeight);
      textElements += `<text x="512" y="${y}" font-family="Arial" font-size="${finalFontSize}" font-weight="bold" fill="white" text-anchor="middle">${escapeXml(line)}</text>`;
    });

    const svg = `<svg width="1024" height="${height}" xmlns="http://www.w3.org/2000/svg">
      ${textElements}
    </svg>`;

    const tmpFile = join(tmpdir(), `headline_${Date.now()}.svg`);
    writeFileSync(tmpFile, svg);

    const pngBuffer = await sharp(tmpFile).resize(1024, height).png().toBuffer();

    try {
      unlinkSync(tmpFile);
    } catch (e) {}
    return pngBuffer;
  } catch (e) {
    console.error('[Template] Error creating headline:', e.message);
    throw e;
  }
}

function wrapText(text, fontSize, maxWidth) {
  const charWidth = fontSize * 0.6;
  const maxCharsPerLine = Math.floor(maxWidth / charWidth);
  const hasSpaces = text.includes(' ');

  if (!hasSpaces && text.length > maxCharsPerLine) {
    const lines = [];
    for (let i = 0; i < text.length; i += maxCharsPerLine) {
      lines.push(text.substring(i, i + maxCharsPerLine));
    }
    return lines.slice(0, 5);
  } else {
    const words = text.split(' ');
    const lines = [];
    let line = '';
    for (const word of words) {
      const test = line ? line + ' ' + word : word;
      if (test.length > maxCharsPerLine && line) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    return lines.slice(0, 5);
  }
}

function escapeXml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export async function createNewsTemplateFromUrl(imageUrl, headline, dateStr, templateUrl) {
  try {
    // Fetch images
    const [templateResponse, imageResponse] = await Promise.all([
      fetch(templateUrl),
      fetch(imageUrl)
    ]);

    const templateBuffer = await templateResponse.arrayBuffer();
    const imageBuffer = await imageResponse.arrayBuffer();

    return await createNewsTemplate(
      Buffer.from(imageBuffer),
      headline,
      dateStr,
      Buffer.from(templateBuffer)
    );
  } catch (e) {
    console.error('[Template] Error fetching images:', e.message);
    throw new Error(`Failed to fetch images: ${e.message}`);
  }
}
