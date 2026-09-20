const { query } = require('../../../database');
const { removeVietnameseAccents, generateProductCode } = require('../../../utils/text');

// Knowledge dictionary for Vietnamese Grocery categories
const DOMAIN_DICTIONARY = [
  {
    categoryPatterns: ['nuoc-giai-khat', 'do-uong', 'beverage'],
    keywords: [
      'coca', 'pepsi', '7up', 'sprite', 'fanta', 'mirinda', 'sting', 'redbull', 'bo huc',
      'tra xanh', 'o long', 'oolong', 'c2', 'tra dao', 'nuoc suoi', 'nuoc khoang', 'aquafina',
      'lavie', 'dasani', 'vinh hao', 'bia', 'heineken', 'tiger', 'saigon', 'hanoi', '333',
      'strongbow', 'nuoc ngot', 'tang luc', 'nuoc ep', 'giai khat', 'twister', 'revive',
      'pocari', 'warrior', 'monster', 'nuoc ep tao', 'nuoc ep cam', 'nuoc ep nho', 'soda',
      'nuoc loc', 'nuoc suoi dong chai', 'tra lipton', 'tra oolong', 'bia larue', 'bia truc bach'
    ],
    defaultUnit: 'lon',
    weight: 1.2
  },
  {
    categoryPatterns: ['mi-bun-kho', 'mi-goi', 'noodle', 'kho'],
    keywords: [
      'mi', 'mi tom', 'mi goi', 'mi an lien', 'hao hao', 'omachi', 'kokomi', 'cung dinh',
      '3 mien', 'ba mien', 'indomie', 'samyang', 'cay han quoc', 'bun kho', 'mien', 'pho',
      'pho goi', 'hu tieu', 'nui', 'banh da', 'mien phu huong', 'chao an lien', 'chao goi',
      'banh canh', 'soba', 'udon', 'spaghetti', 'mi y', 'mi tron', 'mi cay', 'mi chua cay',
      'bun bo hue an lien', 'hu tieu nam vang'
    ],
    defaultUnit: 'gói',
    weight: 1.2
  },
  {
    categoryPatterns: ['banh-keo-snack', 'banh-keo', 'snack'],
    keywords: [
      'banh', 'snack', 'keo', 'khoai tay', 'bim bim', 'oishi', 'ostar', 'lays', 'swing',
      'pringles', 'banh quy', 'chocopie', 'orion', 'custas', 'afc', 'cosy', 'oreo', 'kitkat',
      'socola', 'chocolate', 'keo mut', 'keo cao su', 'chewing gum', 'singum', 'cool air',
      'hat dieu', 'dau phong', 'huong duong', 'keo deo', 'chupa chups', 'alpenliebe', 'mentos',
      'banh gao', 'one one', 'an', 'ichi', 'banh mi', 'sandwich', 'cracker', 'wafer', 'xop',
      'rong bien', 'bap rang bo', 'bap rang', 'keo socola', 'banh bong lan', 'solite', 'phong tom'
    ],
    defaultUnit: 'gói',
    weight: 1.2
  },
  {
    categoryPatterns: ['sua', 'dairy', 'milk'],
    keywords: [
      'sua', 'sua tuoi', 'vinamilk', 'th true milk', 'co gai ha lan', 'dutch lady', 'milo',
      'sua chua', 'yaourt', 'probi', 'yakult', 'sua dac', 'ong tho', 'phuong nam', 'ngoi sao phuong nam',
      'pho mai', 'con bo cuoi', 'cheese', 'vang sua', 'monte', 'sua hat', 'sua dau nanh',
      'fami', 'vitasoy', 'sua bap', 'sua bot', 'ensure', 'pediasure', 'loc sua', 'sua tiet trung',
      'sua thanh trung', 'sua uong', 'sua chua uong', 'sua trai cay'
    ],
    defaultUnit: 'lốc',
    weight: 1.2
  },
  {
    categoryPatterns: ['gia-vi-dau-an', 'gia-vi', 'sauce', 'spice'],
    keywords: [
      'dau an', 'tuong an', 'neptune', 'simply', 'meizan', 'cai lan', 'nuoc mam', 'nam ngu',
      'chinsu', 'phu quoc', 'de nhi', 'hat nem', 'knorr', 'maggi', 'bot ngot', 'mi chinh',
      'ajinomoto', 'vedan', 'muoi', 'duong', 'tieu', 'ot', 'sa te', 'tuong ot', 'tuong ca',
      'dau hao', 'giam', 'bot canh', 'ngu vi huong', 'sot', 'mayonnaise', 'cholimex', 'ong cha va',
      'sot uop thi bo', 'sot uop thit nuong', 'dau me', 'bo thuc vat'
    ],
    defaultUnit: 'chai',
    weight: 1.2
  },
  {
    categoryPatterns: ['do-uong-tuoi', 'pha-che', 'fresh'],
    keywords: [
      'nuoc mia', 'nuoc cam', 'cam vat', 'tra sua', 'tra tac', 'da xay', 'sinh to', 'ca phe',
      'cafe', 'cafe den', 'cafe sua', 'bac xiu', 'nuoc dua', 'nuoc chanh', 'tra chanh',
      'pha che', 'tai quay', 'ly khong lo', 'tra dao cam sa', 'nuoc ep dua hau'
    ],
    defaultUnit: 'ly',
    weight: 1.2
  }
];

class ProductClassifier {
  /**
   * Classify a product by name and optional description
   * @param {string} productName
   * @param {string} [description]
   */
  static async classify(productName, description = '') {
    const rawName = (productName || '').trim();
    if (!rawName) {
      return {
        categoryId: null,
        categoryName: '',
        confidence: 0,
        reason: 'Vui lòng nhập tên sản phẩm để AI phân tích phân loại.',
        suggestedCode: '',
        suggestedUnit: 'cái'
      };
    }

    // 1. Fetch all active categories from DB
    const catRes = await query(
      `SELECT id, name, slug, description FROM categories WHERE is_active = TRUE ORDER BY name ASC;`
    );
    const categories = catRes.rows;

    if (categories.length === 0) {
      return {
        categoryId: null,
        categoryName: 'Chưa có danh mục',
        confidence: 0,
        reason: 'Hệ thống hiện chưa có danh mục nào được khởi tạo.',
        suggestedCode: generateProductCode(rawName),
        suggestedUnit: 'cái'
      };
    }

    // 2. Fetch sample products from DB for similarity matching
    const prodRes = await query(
      `SELECT id, name, category_id, unit FROM products WHERE is_active = TRUE LIMIT 300;`
    );
    const existingProducts = prodRes.rows;

    // 3. Normalize input
    const cleanInput = removeVietnameseAccents(rawName.toLowerCase());
    const inputWords = cleanInput.split(/[\s,.-]+/).filter(w => w.length >= 2);

    // 4. Unit detection
    let detectedUnit = 'cái';
    if (/\b(lon|can)\b/i.test(cleanInput)) detectedUnit = 'lon';
    else if (/\b(chai|binh)\b/i.test(cleanInput)) detectedUnit = 'chai';
    else if (/\b(goi|bich|tui)\b/i.test(cleanInput)) detectedUnit = 'gói';
    else if (/\b(hop|thung)\b/i.test(cleanInput)) detectedUnit = 'hộp';
    else if (/\b(loc|vong)\b/i.test(cleanInput)) detectedUnit = 'lốc';
    else if (/\b(ly|coc)\b/i.test(cleanInput)) detectedUnit = 'ly';
    else if (/\b(kg|kilo|gram|gam)\b/i.test(cleanInput)) detectedUnit = 'kg';

    // 5. Score each category
    const scores = categories.map(cat => {
      let score = 0;
      let matchReasons = [];
      const catCleanName = removeVietnameseAccents(cat.name.toLowerCase());
      const catSlug = (cat.slug || '').toLowerCase();

      // Direct name / slug matching
      if (cleanInput.includes(catCleanName)) {
        score += 50;
        matchReasons.push(`Khớp trực tiếp tên danh mục "${cat.name}"`);
      }

      // Check Domain Knowledge Dictionary
      for (const domain of DOMAIN_DICTIONARY) {
        const matchesCat = domain.categoryPatterns.some(
          pattern => catSlug.includes(pattern) || catCleanName.includes(pattern)
        );

        if (matchesCat) {
          for (const kw of domain.keywords) {
            // Check full keyword or word boundaries
            if (cleanInput.includes(kw)) {
              const kwScore = kw.split(' ').length * 15 * domain.weight;
              score += kwScore;
              matchReasons.push(`Khớp từ khóa ngành hàng "${kw}"`);
              if (detectedUnit === 'cái' && domain.defaultUnit) {
                detectedUnit = domain.defaultUnit;
              }
            }
          }
        }
      }

      // Check similarity with existing products in this category
      const prodsInCat = existingProducts.filter(p => p.category_id === cat.id);
      for (const p of prodsInCat) {
        const pClean = removeVietnameseAccents(p.name.toLowerCase());
        let sharedWords = 0;
        for (const w of inputWords) {
          if (pClean.includes(w)) sharedWords++;
        }
        if (sharedWords >= 2) {
          score += sharedWords * 8;
          matchReasons.push(`Tương đồng với sản phẩm đã có: "${p.name}"`);
          if (detectedUnit === 'cái' && p.unit) {
            detectedUnit = p.unit;
          }
        }
      }

      return {
        category: cat,
        score,
        matchReasons: [...new Set(matchReasons)]
      };
    });

    // 6. Find best category
    scores.sort((a, b) => b.score - a.score);
    const best = scores[0];

    let confidence = 0.5;
    let reasonText = '';

    if (best && best.score > 0) {
      // Calculate normalized confidence between 0.70 and 0.99
      confidence = Math.min(0.99, 0.70 + (best.score / 150) * 0.29);
      confidence = Math.round(confidence * 100) / 100;

      const topReasons = best.matchReasons.slice(0, 2).join('; ');
      reasonText = `AI phát hiện: ${topReasons || `Phù hợp với nhóm ${best.category.name}`}.`;
    } else {
      // Fallback default
      best.category = categories[0];
      confidence = 0.50;
      reasonText = `Chưa có từ khóa đặc trưng rõ ràng, gợi ý mặc định danh mục "${categories[0].name}".`;
    }

    return {
      categoryId: best.category.id,
      categoryName: best.category.name,
      confidence,
      reason: reasonText,
      suggestedCode: generateProductCode(rawName),
      suggestedUnit: detectedUnit,
      alternatives: scores.slice(1, 4).filter(s => s.score > 0).map(s => ({
        categoryId: s.category.id,
        categoryName: s.category.name,
        confidence: Math.round(Math.min(0.90, 0.5 + (s.score / 150) * 0.3) * 100) / 100
      }))
    };
  }
}

module.exports = ProductClassifier;
