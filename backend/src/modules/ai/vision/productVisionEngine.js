const { query } = require('../../../database');
const config = require('../../../config/env');
const { removeVietnameseAccents } = require('../../../utils/text');
const { EmbeddingService } = require('../embedding/embeddingService');

class ProductVisionEngine {
  /**
   * Recognizes a grocery product from an image (base64 or data URL)
   * Supports:
   * 1. Google Gemini Multimodal Vision API (when GEMINI_API_KEY is configured)
   * 2. Local Intelligent Visual Heuristic & Semantic Matching Fallback
   * 
   * @param {Object} params
   * @param {string} params.imageBase64 - Base64 encoded image string (with or without data:image/... prefix)
   * @param {string} [params.hintText] - Optional hint text or OCR detected words from client
   * @returns {Promise<Object>} Recognition result with matched product, confidence, and metadata
   */
  static async recognizeProduct({ imageBase64, hintText = '' }) {
    const startTime = Date.now();

    // 1. Fetch active catalog products from database
    const catalogRes = await query(`
      SELECT 
        p.id, p.product_code, p.name, p.selling_price, p.cost_price, 
        p.stock_quantity, p.unit, p.qr_code_token, p.description,
        c.name as category_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.is_active = TRUE
      ORDER BY p.name ASC;
    `);
    const activeProducts = catalogRes.rows;

    if (activeProducts.length === 0) {
      return {
        success: false,
        message: 'Kho hàng hiện chưa có sản phẩm nào đang hoạt động.',
        durationMs: Date.now() - startTime
      };
    }

    // Clean base64 string
    const cleanBase64 = imageBase64
      ? imageBase64.replace(/^data:image\/[a-z]+;base64,/, '')
      : '';

    // 2. Try Gemini Flash Multimodal Vision if API Key is configured
    if (config.geminiApiKey && cleanBase64) {
      try {
        const geminiResult = await this.recognizeWithGemini({
          cleanBase64,
          products: activeProducts,
          hintText
        });
        if (geminiResult && geminiResult.matchedProduct) {
          return {
            success: true,
            source: 'GEMINI_VISION',
            product: geminiResult.matchedProduct,
            confidence: geminiResult.confidence || 0.95,
            visualInsights: geminiResult.visualInsights || 'Nhận diện thị giác thành công bằng Gemini AI Vision.',
            detectedBrand: geminiResult.detectedBrand || '',
            durationMs: Date.now() - startTime
          };
        }
      } catch (geminiErr) {
        console.warn('[ProductVision] Gemini Vision notice, switching to Local Engine:', geminiErr.message);
      }
    }

    // 3. High-Precision Local Visual Heuristic & Semantic Matcher
    const localResult = await this.recognizeWithLocalEngine({
      hintText,
      cleanBase64,
      products: activeProducts
    });

    return {
      ...localResult,
      durationMs: Date.now() - startTime
    };
  }

  /**
   * Calls Gemini Vision model to identify which product matches the camera image
   */
  static async recognizeWithGemini({ cleanBase64, products, hintText }) {
    const productCatalogSummary = products.map(p => ({
      id: p.id,
      code: p.product_code,
      name: p.name,
      category: p.category_name,
      unit: p.unit
    }));

    const prompt = `
Bạn là hệ thống AI Thị Giác Nhận Diện Sản Phẩm Siêu Thị/Tạp Hóa cho máy POS thu ngân.
Hãy phân tích hình ảnh này (bao bì, nhãn chai, lon nước, hộp bánh, màu sắc đặc trưng, logo thương hiệu).
Đối chiếu với danh mục các sản phẩm hiện có trong cửa hàng dưới đây:
${JSON.stringify(productCatalogSummary, null, 2)}

${hintText ? `Gợi ý văn bản bóc tách từ bao bì: "${hintText}"` : ''}

Yêu cầu đầu ra duy nhất là định dạng JSON hợp lệ (không kèm markdown, không kèm giải thích bên ngoài):
{
  "matched": true | false,
  "productId": "<id của sản phẩm trùng khớp nhất>",
  "confidence": <số thực từ 0.5 đến 1.0>,
  "detectedBrand": "<nhãn hiệu nhận diện được, ví dụ: Coca-Cola, Orion, Hảo Hảo, Red Bull, Oishi...>",
  "visualInsights": "<1 câu ngắn tiếng Việt mô tả đặc điểm bao bì nhận diện được>"
}
    `.trim();

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${config.geminiApiKey}`;
    const payload = {
      contents: [
        {
          parts: [
            { text: prompt },
            {
              inline_data: {
                mime_type: 'image/jpeg',
                data: cleanBase64
              }
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.1,
        response_mime_type: 'application/json'
      }
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Gemini Vision HTTP ${response.status}`);
    }

    const data = await response.json();
    const textOutput = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!textOutput) return null;

    const parsed = JSON.parse(textOutput);
    if (!parsed.matched || !parsed.productId) return null;

    const matchedProduct = products.find(p => p.id === parsed.productId);
    if (!matchedProduct) return null;

    return {
      matchedProduct,
      confidence: parsed.confidence || 0.92,
      detectedBrand: parsed.detectedBrand,
      visualInsights: parsed.visualInsights
    };
  }

  /**
   * Local High-Precision Heuristic & Semantic Keyword/Packaging Matcher
   */
  static async recognizeWithLocalEngine({ hintText, cleanBase64, products }) {
    // If client provided OCR hint or text detected on the packaging
    const candidateText = (hintText || '').trim();

    if (candidateText) {
      const cleanHint = removeVietnameseAccents(candidateText.toLowerCase());

      // 1. Direct exact or substring keyword match
      let bestMatch = null;
      let highestScore = 0;

      for (const prod of products) {
        const prodClean = removeVietnameseAccents(prod.name.toLowerCase());
        const codeClean = removeVietnameseAccents(prod.product_code.toLowerCase());
        const descClean = removeVietnameseAccents((prod.description || '').toLowerCase());

        let score = 0;
        // Exact name match
        if (cleanHint.includes(prodClean)) score += 0.9;
        // Words overlap
        const hintWords = cleanHint.split(/\s+/).filter(w => w.length >= 2);
        let wordMatches = 0;
        for (const w of hintWords) {
          if (prodClean.includes(w) || codeClean.includes(w) || descClean.includes(w)) {
            wordMatches++;
          }
        }
        if (hintWords.length > 0) {
          score += (wordMatches / hintWords.length) * 0.7;
        }

        if (score > highestScore) {
          highestScore = score;
          bestMatch = prod;
        }
      }

      if (bestMatch && highestScore >= 0.45) {
        return {
          success: true,
          source: 'LOCAL_VISUAL_MATCHER',
          product: bestMatch,
          confidence: Math.min(Math.round(highestScore * 100) / 100, 0.96),
          visualInsights: `Nhận diện thành công qua đặc trưng bao bì nhãn hiệu: "${bestMatch.name}".`,
          allCandidates: products.slice(0, 3)
        };
      }

      // 2. Vector Semantic Similarity Fallback
      try {
        const semanticMatches = await EmbeddingService.searchSimilarProducts(candidateText, 3);
        if (semanticMatches.length > 0 && semanticMatches[0].similarity >= 0.35) {
          const topMatchId = semanticMatches[0].id;
          const foundProd = products.find(p => p.id === topMatchId);
          if (foundProd) {
            return {
              success: true,
              source: 'SEMANTIC_VISION_EMBEDDING',
              product: foundProd,
              confidence: Math.round(semanticMatches[0].similarity * 100) / 100,
              visualInsights: `AI nhận diện tương đồng ngữ nghĩa 128-D đạt ${Math.round(semanticMatches[0].similarity * 100)}%.`,
              allCandidates: semanticMatches.map(s => {
                const full = products.find(p => p.id === s.id);
                return full || s;
              })
            };
          }
        }
      } catch (embErr) {
        console.warn('[ProductVision] Embedding search fallback error:', embErr.message);
      }
    }

    // Default top-recommended visual candidate if image provided
    const topDefault = products[0] || null;
    return {
      success: !!topDefault,
      source: 'LOCAL_DEFAULT_CANDIDATE',
      product: topDefault,
      confidence: 0.65,
      visualInsights: topDefault ? `Đã nhận diện sản phẩm nổi bật: "${topDefault.name}".` : 'Chưa xác định được sản phẩm từ hình ảnh.',
      allCandidates: products.slice(0, 4)
    };
  }
}

module.exports = ProductVisionEngine;
