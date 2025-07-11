import { readFileSync, writeFileSync } from 'fs';
import { Product } from '../src/types';
import axios from 'axios';
import * as cheerio from 'cheerio';

interface ImageFixResult {
  timestamp: string;
  totalChamdsProducts: number;
  imagesFixed: number;
  imagesFailed: number;
  fixedProducts: {
    id: string;
    name: string;
    oldImage: string;
    newImage: string;
  }[];
  failedProducts: {
    id: string;
    name: string;
    error: string;
  }[];
}

async function fetchCorrectImageUrl(productUrl: string): Promise<string | null> {
  try {
    console.log(`  🔍 Fetching product page: ${productUrl}`);
    
    const response = await axios.get(productUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8'
      },
      timeout: 15000
    });

    const $ = cheerio.load(response.data);
    
    // Try different selectors for product image
    const imageSelectors = [
      '.product-image img',
      '.product_image img', 
      '.detail_image img',
      '.BigImage img',
      '.big_image img',
      '.product img',
      'img[src*="product"]',
      'img[src*="big"]',
      '#mainImage',
      '.main-image img'
    ];

    for (const selector of imageSelectors) {
      const img = $(selector).first();
      if (img.length > 0) {
        let imgSrc = img.attr('src');
        if (imgSrc) {
          // Convert relative URLs to absolute
          if (imgSrc.startsWith('/')) {
            imgSrc = `https://chamds.com${imgSrc}`;
          } else if (!imgSrc.startsWith('http')) {
            imgSrc = `https://chamds.com/${imgSrc}`;
          }
          
          console.log(`  ✅ Found image with ${selector}: ${imgSrc}`);
          return imgSrc;
        }
      }
    }

    // If no specific product image found, try to find any reasonable image
    const allImages = $('img');
    for (let i = 0; i < allImages.length; i++) {
      const img = $(allImages[i]);
      const src = img.attr('src');
      if (src && (src.includes('product') || src.includes('upload'))) {
        let imgSrc = src.startsWith('/') ? `https://chamds.com${src}` : src;
        if (!imgSrc.startsWith('http')) {
          imgSrc = `https://chamds.com/${imgSrc}`;
        }
        console.log(`  ✅ Found fallback image: ${imgSrc}`);
        return imgSrc;
      }
    }

    console.log(`  ❌ No suitable image found on page`);
    return null;
    
  } catch (error) {
    console.log(`  ❌ Error fetching product page: ${error}`);
    return null;
  }
}

async function fixChamdsImages(): Promise<void> {
  console.log('🔧 Fixing 참달성 product images...');
  
  try {
    // Read current products
    const productsData = readFileSync('./src/data/products.json', 'utf-8');
    const allProducts: Product[] = JSON.parse(productsData);
    
    // Filter chamds products
    const chamdsProducts = allProducts.filter(p => p.id.startsWith('chamds-'));
    
    console.log(`📊 Found ${chamdsProducts.length} 참달성 products to check`);
    
    const result: ImageFixResult = {
      timestamp: new Date().toISOString(),
      totalChamdsProducts: chamdsProducts.length,
      imagesFixed: 0,
      imagesFailed: 0,
      fixedProducts: [],
      failedProducts: []
    };

    // Check and fix each product's image
    for (let i = 0; i < chamdsProducts.length; i++) {
      const product = chamdsProducts[i];
      console.log(`\n${i + 1}/${chamdsProducts.length} Checking ${product.id}: ${product.name}`);
      
      // Check if current image URL is problematic (contains the complex encrypted path)
      const needsFix = product.image && (
        product.image.includes('0jJurf5+JqL2mXn6P+LWO9n3RehRei8HzUfVrvYrRYTek0NwmceiTX1J9Nu1oWzY10ep+nrGOcU69gswAuU7AA==') ||
        product.image.includes('//cafe24.poxo.com/') ||
        !product.image.startsWith('https://chamds.com/upload/')
      );

      if (needsFix && product.url) {
        console.log(`  🔧 Fixing problematic image URL...`);
        console.log(`  📷 Current: ${product.image}`);
        
        const newImageUrl = await fetchCorrectImageUrl(product.url);
        
        if (newImageUrl) {
          const oldImage = product.image;
          product.image = newImageUrl;
          result.imagesFixed++;
          result.fixedProducts.push({
            id: product.id,
            name: product.name,
            oldImage: oldImage,
            newImage: newImageUrl
          });
          console.log(`  ✅ Fixed image: ${newImageUrl}`);
        } else {
          result.imagesFailed++;
          result.failedProducts.push({
            id: product.id,
            name: product.name,
            error: 'Could not find suitable image on product page'
          });
          console.log(`  ❌ Could not fix image`);
        }
        
        // Delay between requests
        await new Promise(resolve => setTimeout(resolve, 2000));
      } else {
        console.log(`  ✅ Image OK: ${product.image}`);
      }
    }

    // Update the products array
    const chamdsProductIds = new Set(chamdsProducts.map(p => p.id));
    const updatedProducts = allProducts.map(p => 
      chamdsProductIds.has(p.id) 
        ? chamdsProducts.find(cp => cp.id === p.id) || p
        : p
    );

    // Write updated products back to file
    writeFileSync('./src/data/products.json', JSON.stringify(updatedProducts, null, 2));
    
    // Save results
    writeFileSync('./scripts/output/chamds-image-fix-summary.json', JSON.stringify(result, null, 2));

    console.log('\n📊 Image Fix Summary:');
    console.log(`✅ Images fixed: ${result.imagesFixed}`);
    console.log(`❌ Images failed: ${result.imagesFailed}`);
    console.log(`📦 Total 참달성 products: ${result.totalChamdsProducts}`);
    
    if (result.fixedProducts.length > 0) {
      console.log('\n🔧 Fixed products:');
      result.fixedProducts.forEach(fp => {
        console.log(`  ${fp.id}: ${fp.name.substring(0, 30)}...`);
      });
    }
    
    if (result.failedProducts.length > 0) {
      console.log('\n❌ Failed products:');
      result.failedProducts.forEach(fp => {
        console.log(`  ${fp.id}: ${fp.name.substring(0, 30)}... - ${fp.error}`);
      });
    }

  } catch (error) {
    console.error('❌ Error fixing images:', error);
    
    const errorInfo = {
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    };
    
    writeFileSync('./scripts/output/chamds-image-fix-error.json', JSON.stringify(errorInfo, null, 2));
  }
}

// Run the image fix
fixChamdsImages().then(() => {
  console.log('\n✅ Image fixing complete!');
}).catch(console.error);