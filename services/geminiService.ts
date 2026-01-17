
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

const IMAGE_MODEL = 'gemini-3-pro-image-preview';
const VIDEO_MODEL = 'veo-3.1-fast-generate-preview';

const seasonModifiers = {
  summer: { vibe: "summer heat, clear sky", lighting: "bright midday sun" },
  autumn: { vibe: "golden leaves, autumn air", lighting: "warm sunset lighting" },
  winter: { vibe: "winter snow, cold frost", lighting: "soft diffused winter light" },
  spring: { vibe: "spring blossoms, fresh morning", lighting: "bright soft morning light" },
  default: { vibe: "", lighting: "natural photography lighting" }
} as const;

export const editImageWithGemini = async (
  characterImages: string[],
  styleReference: string | null,
  masterPrompt: string,
  season: string,
  camera: { angle: string | null; scale: string | null; lens: string | null; aspectRatio: string }
): Promise<{ url: string; name: string }> => {
  // API key kontrolü
  if (!process.env.API_KEY) {
    throw new Error('API key bulunamadı! Lütfen .env.local dosyasında GEMINI_API_KEY ayarlandığından emin olun.');
  }

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const parts: any[] = [];

  // Karakter DNA'sı (Kimlik Bilgisi)
  characterImages.forEach((base64, index) => {
    parts.push({ text: `Subject Identity Reference (DNA) ${index + 1}:` });
    parts.push({ inlineData: { data: base64.split(',')[1], mimeType: 'image/png' } });
  });

  // Stil ve Poz Referansı
  if (styleReference) {
    parts.push({ text: "POSE & COMPOSITION REFERENCE (Follow this pose exactly):" });
    parts.push({ inlineData: { data: styleReference.split(',')[1], mimeType: 'image/png' } });
  }

  const currentSeason = seasonModifiers[season as keyof typeof seasonModifiers] || seasonModifiers.default;
  
  let techDirectives = "";
  if (camera.angle === 'DRONE ÇEKİMİ' || camera.angle === 'KUŞ BAKIŞI') {
    techDirectives += "CRITICAL: AERIAL SHOT. Camera high above. ";
  }
  if (camera.scale === 'GENEL PLAN' || camera.scale === 'UZAK MESAFE') {
    techDirectives += "CRITICAL: WIDE SHOT. ";
  }

  const isNightRequested = /akşam|gece|night|evening|dark|sunset|moonlight|parti|party/i.test(masterPrompt);
  const lightingFinal = isNightRequested ? "STRICTLY OVERRIDE LIGHTING: Cinematic night/evening lighting." : currentSeason.lighting;

  const fullPrompt = `
    TASK: Generate a high-end photo of the person in the Identity References.
    
    IDENTITY CORE (NON-NEGOTIABLE):
    - FACE: Exact facial features, eye shape, and bone structure from Identity References.
    - HAIR COLOR: STICK TO THE EXACT HAIR COLOR seen in Identity References. Do not change it.
    - SKIN TONE: Maintain the original skin tone.
    
    SCENE ADAPTATION (STYLE & CLOTHING): 
    - You MAY change the hair STYLE (e.g., messy, tied up, wavy) to fit the scene: "${masterPrompt}".
    - You MUST change the CLOTHING and ACCESSORIES (earrings, glasses, jewelry) to be appropriate for the scene.
    - Outfit should be professional high-fashion based on: "${masterPrompt}".
    
    POSE & COMPOSITION:
    - IF a Pose Reference is provided, FOLLOW that pose and camera framing PRECISELY.
    - Camera angle: ${camera.angle || "standard"}. 
    - Shot scale: ${camera.scale || "medium"}.
    
    ENVIRONMENT:
    - Atmosphere: ${currentSeason.vibe}.
    - Lighting: ${lightingFinal}.
    
    QUALITY: Photorealistic, 8k resolution, professional studio/location photography, cinematic depth of field.
    NO MORPHING. NO EXTRA LIMBS. PERFECT ANATOMY.
  `;

    parts.push({ text: fullPrompt });

    console.log('Gemini API çağrısı yapılıyor...', { 
      model: IMAGE_MODEL, 
      partsCount: parts.length,
      aspectRatio: camera.aspectRatio 
    });

    const response: GenerateContentResponse = await ai.models.generateContent({
      model: IMAGE_MODEL,
      contents: { parts },
      config: { 
        imageConfig: { 
          aspectRatio: camera.aspectRatio as any, 
          imageSize: "1K" 
        } 
      }
    });

    console.log('API yanıtı alındı:', { 
      hasCandidates: !!response.candidates?.[0],
      candidatesCount: response.candidates?.length || 0
    });

    if (!response.candidates || response.candidates.length === 0) {
      throw new Error("API yanıt vermedi. Lütfen tekrar deneyin.");
    }

    const candidate = response.candidates[0];
    if (candidate.finishReason && candidate.finishReason !== 'STOP') {
      // IMAGE_SAFETY hatası için özel mesaj
      if (candidate.finishReason.includes('SAFETY') || candidate.finishReason.includes('IMAGE_SAFETY')) {
        throw new Error('Görsel üretilemedi: IMAGE_SAFETY - İçerik güvenlik kontrolünden geçemedi. Lütfen farklı bir prompt veya referans görsel deneyin.');
      }
      throw new Error(`Görsel üretilemedi: ${candidate.finishReason}`);
    }

    const part = candidate?.content?.parts?.find(p => p.inlineData);
    if (!part?.inlineData) {
      console.error('API yanıt detayları:', JSON.stringify(response, null, 2));
      throw new Error("Görsel üretilemedi. API geçerli bir görsel döndürmedi.");
    }
    
    const nameBase = masterPrompt.split(' ').slice(0, 2).join('_').replace(/[^a-zA-Z0-9_]/g, '') || 'Shot';
    const generatedName = `${nameBase}_${Date.now().toString().slice(-4)}`;

    console.log('Görsel başarıyla üretildi:', generatedName);

    return { 
      url: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`,
      name: generatedName.toUpperCase()
    };
  } catch (error: any) {
    console.error('Gemini API hatası:', error);
    
    // Daha açıklayıcı hata mesajları
    if (error.message) {
      throw error;
    } else if (error.response) {
      throw new Error(`API Hatası: ${error.response.status} - ${error.response.statusText || 'Bilinmeyen hata'}`);
    } else if (error.code) {
      throw new Error(`API Hatası (${error.code}): ${error.message || 'Bilinmeyen hata'}`);
    } else {
      throw new Error(`Görsel üretimi başarısız: ${error.toString()}`);
    }
  }
};

// Hızlı görsel oluşturma - karakter DNA'sı olmadan
export const generateQuickImage = async (
  referenceImage: string | null,
  prompt: string
): Promise<{ url: string; name: string }> => {
  // API key kontrolü
  if (!process.env.API_KEY) {
    throw new Error('API key bulunamadı! Lütfen .env.local dosyasında GEMINI_API_KEY ayarlandığından emin olun.');
  }

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const parts: any[] = [];

    // Referans görsel varsa ekle
    if (referenceImage) {
      parts.push({ text: "STYLE & COMPOSITION REFERENCE (Use this as inspiration):" });
      parts.push({ inlineData: { data: referenceImage.split(',')[1], mimeType: 'image/png' } });
    }

    const fullPrompt = `
      TASK: Generate a high-quality, professional photo based on the following description: "${prompt}"
      
      ${referenceImage ? 'You can use the reference image as inspiration for style, composition, or pose, but create a NEW unique image based on the prompt.' : ''}
      
      REQUIREMENTS:
      - High-end professional photography quality
      - Photorealistic, 8k resolution
      - Professional studio/location photography
      - Cinematic depth of field
      - Perfect anatomy, no extra limbs
      - Natural lighting and composition
      - Creative and visually striking
      
      Create a unique, original image that matches the prompt description.
    `;

    parts.push({ text: fullPrompt });

    console.log('Hızlı görsel üretimi başlatılıyor...', { 
      hasReference: !!referenceImage,
      prompt: prompt.substring(0, 50) + '...'
    });

    const response: GenerateContentResponse = await ai.models.generateContent({
      model: IMAGE_MODEL,
      contents: [{ role: 'user', parts }]
    });

    if (!response.candidates || response.candidates.length === 0) {
      throw new Error("API yanıt vermedi. Lütfen tekrar deneyin.");
    }

    const candidate = response.candidates[0];
    if (candidate.finishReason && candidate.finishReason !== 'STOP') {
      if (candidate.finishReason.includes('SAFETY') || candidate.finishReason.includes('IMAGE_SAFETY')) {
        throw new Error('Görsel üretilemedi: IMAGE_SAFETY - İçerik güvenlik kontrolünden geçemedi. Lütfen farklı bir prompt deneyin.');
      }
      throw new Error(`Görsel üretilemedi: ${candidate.finishReason}`);
    }

    const part = candidate?.content?.parts?.find(p => p.inlineData);
    if (!part?.inlineData) {
      console.error('API yanıt detayları:', JSON.stringify(response, null, 2));
      throw new Error("Görsel üretilemedi. API geçerli bir görsel döndürmedi.");
    }
    
    const nameBase = prompt.split(' ').slice(0, 2).join('_').replace(/[^a-zA-Z0-9_]/g, '') || 'Quick';
    const generatedName = `QUICK_${nameBase}_${Date.now().toString().slice(-4)}`;

    console.log('Hızlı görsel başarıyla üretildi:', generatedName);

    return { 
      url: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`,
      name: generatedName.toUpperCase()
    };
  } catch (error: any) {
    console.error('Hızlı görsel üretimi hatası:', error);
    
    if (error.message) {
      throw error;
    } else if (error.response) {
      throw new Error(`API Hatası: ${error.response.status} - ${error.response.statusText || 'Bilinmeyen hata'}`);
    } else if (error.code) {
      throw new Error(`API Hatası (${error.code}): ${error.message || 'Bilinmeyen hata'}`);
    } else {
      throw new Error(`Görsel üretimi başarısız: ${error.toString()}`);
    }
  }
};

export const generateVideoWithVeo = async (
  characterImages: string[],
  referenceImage: string | null,
  prompt: string,
  season: string,
  aspectRatio: string
): Promise<{ url: string; name: string }> => {
  // API key kontrolü
  if (!process.env.API_KEY) {
    throw new Error('API key bulunamadı! Lütfen .env.local dosyasında GEMINI_API_KEY ayarlandığından emin olun.');
  }

  if (characterImages.length === 0) {
    throw new Error("Video üretimi için karakter DNA görselleri gereklidir.");
  }

  const aiStart = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  // Referans görsel varsa onu kullan, yoksa karakter DNA'sından birini kullan
  const baseImage = referenceImage || characterImages[0];
  
  const charBase64 = baseImage.split(',')[1];
  const mimeType = baseImage.split(';')[0].split(':')[1] || 'image/png';
  const videoRatio: any = aspectRatio === '16:9' ? '16:9' : '9:16';

  // Prompt analizi - kıyafet, saç, aksesuar tespiti
  const hasFormalClothing = /iş|formal|takım elbise|suit|business|profesyonel|ofis/i.test(prompt);
  const hasCasualClothing = /günlük|casual|rahat|t-shirt|gömlek/i.test(prompt);
  const hasSportClothing = /spor|sport|gym|salon|egzersiz|workout|atletik/i.test(prompt);
  const hasEveningClothing = /gece|evening|parti|party|gece kıyafeti|elbise|dress|gece kıyafet/i.test(prompt);
  
  const hasHairStyle = /saç|hair|topuz|uzun|kısa|dalgalı|düz|örgü/i.test(prompt);
  const hasAccessories = /toka|küpe|earring|hair clip|aksesuar|jewelry|mücevher|takı/i.test(prompt);

  const seasonModifier = seasonModifiers[season as keyof typeof seasonModifiers] || seasonModifiers.default;
  const isNightRequested = /akşam|gece|night|evening|dark|sunset|moonlight|parti|party/i.test(prompt);

  // Ortam tespiti
  const hasEnvironment = /plaj|beach|gym|salon|ofis|office|kulüp|club|restoran|cafe|ev|home|bahçe|garden|park/i.test(prompt);

  const videoPrompt = `
    TASK: Create a hyper-realistic cinematic video of the EXACT SAME PERSON shown in the reference image.
    
    ════════════════════════════════════════════════════════════════
    IDENTITY PRESERVATION (ABSOLUTE PRIORITY - NEVER VIOLATE):
    ════════════════════════════════════════════════════════════════
    
    FACE (MUST REMAIN IDENTICAL):
    - Preserve the EXACT facial structure: face shape, bone structure, jawline, cheekbones.
    - Maintain the EXACT eye shape, size, color, and spacing.
    - Keep the EXACT nose shape, size, and proportions.
    - Preserve the EXACT mouth shape, lip size, and proportions.
    - Maintain the EXACT eyebrow shape and positioning.
    - Keep the EXACT facial expressions and micro-features consistent.
    
    HAIR (COLOR & TEXTURE MUST MATCH):
    - HAIR COLOR: Preserve the EXACT original hair color from the reference. DO NOT change it under any circumstances.
    - HAIR TEXTURE: Maintain the same hair texture (fine, thick, wavy, straight).
    - HAIR STYLE: You MAY adjust the hair style (length, up/down, messy/neat) to fit the scene, but keep the SAME color and texture.
    
    BODY & PHYSIQUE (MUST MATCH):
    - Preserve the EXACT body type, height proportions, and physique from the reference image.
    - Maintain the same shoulder width, waist-to-hip ratio, and limb proportions.
    - Keep the same posture and body language characteristics.
    
    SKIN & FEATURES:
    - Maintain the EXACT skin tone and undertones from the reference.
    - Preserve any distinctive features (freckles, moles, birthmarks) if visible.
    
    ════════════════════════════════════════════════════════════════
    SCENE ADAPTATION (ADAPT ONLY CLOTHING, ACCESSORIES, BACKGROUND):
    ════════════════════════════════════════════════════════════════
    
    The scene description: "${prompt}"
    
    CLOTHING (CHANGE TO MATCH SCENE):
    ${hasFormalClothing ? '- Outfit: Professional formal attire (suit, blazer, dress shirt) for business/professional scene.' : ''}
    ${hasCasualClothing ? '- Outfit: Casual everyday clothing (t-shirt, jeans, comfortable wear) for casual scene.' : ''}
    ${hasSportClothing ? '- Outfit: Athletic sportswear (sports bra, leggings, workout clothes) for gym/fitness scene.' : ''}
    ${hasEveningClothing ? '- Outfit: Evening wear, elegant party dress, or formal evening attire for night/party scene.' : ''}
    ${!hasFormalClothing && !hasCasualClothing && !hasSportClothing && !hasEveningClothing ? '- Outfit: Choose appropriate clothing for the scene, but maintain the person\'s body proportions.' : ''}
    
    ACCESSORIES (ADJUST FOR SCENE):
    ${hasAccessories ? '- Add or adjust accessories (hair clips, earrings, jewelry) as appropriate for the scene.' : '- Adjust accessories to match the scene if needed.'}
    
    BACKGROUND & ENVIRONMENT (CREATE NEW SCENE):
    ${hasEnvironment ? `- Create the environment/background based on: "${prompt}".` : `- Create an appropriate environment/background for: "${prompt}".`}
    ${isNightRequested ? '- Lighting: Cinematic night/evening lighting.' : `- Lighting: ${seasonModifier.lighting}`}
    
    ════════════════════════════════════════════════════════════════
    ACTION & MOVEMENT:
    ════════════════════════════════════════════════════════════════
    - Primary Action: ${prompt}
    - Movement must be natural, fluid, and realistic.
    - The SAME PERSON (with identical face, body, hair color) performs the action.
    - Maintain character identity consistency in EVERY SINGLE FRAME of the video.
    
    ════════════════════════════════════════════════════════════════
    QUALITY & TECHNICAL REQUIREMENTS:
    ════════════════════════════════════════════════════════════════
    - Hyper-realistic cinematic quality, professional 4k resolution.
    - Smooth motion, no glitches, artifacts, or morphing.
    - NO MORPHING between different people. It must be THE SAME PERSON throughout.
    - NO EXTRA LIMBS. PERFECT ANATOMY.
    - Professional video production standards.
    - Maintain perfect character identity consistency from first frame to last frame.
    
    ════════════════════════════════════════════════════════════════
    CRITICAL RULES:
    ════════════════════════════════════════════════════════════════
    1. The person in the video MUST look like the EXACT SAME PERSON from the reference image.
    2. Face, body type, hair color, and skin tone must remain CONSISTENT throughout the ENTIRE video.
    3. Only clothing, accessories, and background change based on the scene.
    4. DO NOT create a different person. DO NOT morph into someone else.
    5. If the reference shows a person with specific features, those features must appear in EVERY FRAME.
  `;

  let operation = await aiStart.models.generateVideos({
    model: VIDEO_MODEL,
    prompt: videoPrompt,
    image: { imageBytes: charBase64, mimeType },
    config: { numberOfVideos: 1, resolution: '1080p', aspectRatio: videoRatio }
  });

  while (!operation.done) {
    await new Promise(resolve => setTimeout(resolve, 8000));
    const aiPoll = new GoogleGenAI({ apiKey: process.env.API_KEY });
    operation = await aiPoll.operations.getVideosOperation({ operation });
    if (operation.error) {
      const errorMsg = typeof operation.error === 'string' 
        ? operation.error 
        : (operation.error as any)?.message || 'Video oluşturma hatası';
      throw new Error(errorMsg);
    }
  }

  const response = operation.response as any;
  const videoUri = response?.generatedVideos?.[0]?.video?.uri;
  if (!videoUri) throw new Error("Video işlenemedi.");

  const videoResponse = await fetch(`${videoUri}&key=${process.env.API_KEY}`);
  const videoBlob = await videoResponse.blob();
  
  const nameBase = prompt.split(' ').slice(0, 2).join('_').replace(/[^a-zA-Z0-9_]/g, '') || 'Video';
  const generatedName = `${nameBase}_${Date.now().toString().slice(-4)}`;

  return { 
    url: URL.createObjectURL(videoBlob),
    name: generatedName.toUpperCase()
  };
};
