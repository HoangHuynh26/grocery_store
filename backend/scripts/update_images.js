const { query } = require('../src/database');

const imageMap = {
  'NUOC-COCA-330': 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=500&auto=format&fit=crop&q=80',
  'NUOC-PEPSI-330': 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=500&auto=format&fit=crop&q=80',
  'NUOC-AQUAFINA-500': 'https://images.unsplash.com/photo-1548839140-29a749e1bc4e?w=500&auto=format&fit=crop&q=80',
  'MI-HAOHAO-001': 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=500&auto=format&fit=crop&q=80',
  'MI-OMACHI-SGB': 'https://images.unsplash.com/photo-1612927601601-6638404737ce?w=500&auto=format&fit=crop&q=80',
  'BANH-CHOCORIE-01': 'https://images.unsplash.com/photo-1587314168485-3236d6710814?w=500&auto=format&fit=crop&q=80',
  'SUA-VINAMILK-180': 'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=500&auto=format&fit=crop&q=80',
  'SNACK-LAY-NATURAL': 'https://images.unsplash.com/photo-1566478989037-eec170784d0b?w=500&auto=format&fit=crop&q=80',
  'GIAVI-KNORR-400': 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=500&auto=format&fit=crop&q=80',
  'DAUAN-TUONGAN-1L': 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=500&auto=format&fit=crop&q=80',
  'MON-NUOC-MIA-01': 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=500&auto=format&fit=crop&q=80',
  'MON-CAM-VAT-01': 'https://images.unsplash.com/photo-1613478223719-2ab802602423?w=500&auto=format&fit=crop&q=80'
};

async function run() {
  console.log('[Update Images] Updating products with clear images...');
  for (const [code, img] of Object.entries(imageMap)) {
    const res = await query('UPDATE products SET image_url = $1 WHERE product_code = $2 RETURNING id, name', [img, code]);
    if (res.rows.length > 0) {
      console.log(`- Updated image for: ${res.rows[0].name} (${code})`);
    }
  }
  console.log('[Update Images] Completed successfully!');
  process.exit(0);
}

run().catch(err => {
  console.error('[Update Images] Error:', err);
  process.exit(1);
});
