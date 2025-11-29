const RAILWAY_API_URL = 'https://web-production-60f63.up.railway.app/api/template';
const RAILWAY_API_URL_FROM_URL = 'https://web-production-60f63.up.railway.app/api/template-from-url';

export async function createTemplateViaRailway(imageBase64, headline, dateStr, templateBase64 = null) {
  try {
    console.log('[Railway] Calling API to create template...');
    
    const payload = {
      imageBase64: imageBase64,
      headline: headline,
      date: dateStr,
      ...(templateBase64 && { templateBase64: templateBase64 })
    };

    const response = await fetch(RAILWAY_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      timeout: 30000 // 30 second timeout
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[Railway] API Error:', response.status, error);
      throw new Error(`Railway API error: ${response.status}`);
    }

    const result = await response.json();
    
    if (!result.success || !result.template) {
      throw new Error('Invalid response from Railway API');
    }

    console.log('[Railway] ✅ Template created successfully');
    
    // Convert base64 to buffer
    const templateBuffer = Buffer.from(result.template, 'base64');
    return templateBuffer;

  } catch (error) {
    console.error('[Railway] Template generation failed:', error.message);
    throw new Error(`Failed to create template via Railway: ${error.message}`);
  }
}

export async function createTemplateViaRailwayUrl(imageUrl, headline, dateStr, templateUrl) {
  try {
    console.log('[Railway] Calling API to create template from URLs...');
    
    const payload = {
      imageUrl: imageUrl,
      headline: headline,
      date: dateStr,
      templateUrl: templateUrl
    };

    const response = await fetch(RAILWAY_API_URL_FROM_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      timeout: 30000
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[Railway] API Error:', response.status, error);
      throw new Error(`Railway API error: ${response.status}`);
    }

    const result = await response.json();
    
    if (!result.success || !result.template) {
      throw new Error('Invalid response from Railway API');
    }

    console.log('[Railway] ✅ Template created successfully from URLs');
    
    const templateBuffer = Buffer.from(result.template, 'base64');
    return templateBuffer;

  } catch (error) {
    console.error('[Railway] Template generation failed:', error.message);
    throw new Error(`Failed to create template via Railway: ${error.message}`);
  }
}

export const getRailwayStatus = () => ({
  apiUrl: RAILWAY_API_URL,
  status: 'connected'
});
