import axios from 'axios';
import * as cheerio from 'cheerio';
import * as fs from 'fs';
import * as path from 'path';

interface Product {
  id: string;
  name: string;
  price: string;
  originalPrice?: string;
  image: string;
  url: string;
  mall: string;
  region: string;
  category: string;
  inStock: boolean;
  scrapedAt: string;
}

async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function extractPrice(priceText: string): string | null {
  if (!priceText) return null;
  
  const cleanText = priceText.replace(/\s+/g, ' ').trim();
  const priceMatch = cleanText.match(/(\d{1,3}(?:,\d{3})*)[원₩]/);
  
  if (priceMatch) {
    return priceMatch[1].replace(/,/g, '') + '원';
  }
  
  const numberMatch = cleanText.match(/(\d{1,3}(?:,\d{3})*)/);
  if (numberMatch) {
    return numberMatch[1].replace(/,/g, '') + '원';
  }
  
  return null;
}

function cleanProductName(name: string): string {
  if (!name) return '';
  return name
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s가-힣ㄱ-ㅎㅏ-ㅣ()\[\]%+\-.,]/g, '')
    .trim();
}

function generateProductId(url: string): string {
  const match = url.match(/no=(\d+)/);
  return match ? `inje_${match[1]}` : `inje_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

async function scrapeProductDetails(productUrl: string): Promise<Product | null> {
  try {
    console.log(`Scraping: ${productUrl}`);
    
    const response = await axios.get(productUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.8,en-US;q=0.5,en;q=0.3',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      },
      timeout: 15000
    });

    const $ = cheerio.load(response.data);
    
    let productName = '';
    const nameSelectors = [
      '[class*="name"]',
      '.product_name',
      '.goods_name',
      'h1',
      '.title'
    ];
    
    for (const selector of nameSelectors) {
      const nameElement = $(selector).first();
      if (nameElement.length && nameElement.text().trim()) {
        productName = cleanProductName(nameElement.text().trim());
        if (productName && productName !== '추천 상품' && productName.length > 3) {
          break;
        }
      }
    }
    
    if (!productName || productName === '추천 상품' || productName.length < 3) {
      console.log(`Skipping product with invalid name: "${productName}" from ${productUrl}`);
      return null;
    }
    
    let price = '';
    let originalPrice = '';
    const priceSelectors = [
      '[class*="price"]',
      '.product_price',
      '.goods_price',
      '.price'
    ];
    
    for (const selector of priceSelectors) {
      const priceElement = $(selector).first();
      if (priceElement.length) {
        const priceText = priceElement.text().trim();
        const priceLines = priceText.split('\n').map(line => line.trim()).filter(line => line);
        
        for (const line of priceLines) {
          const extractedPrice = extractPrice(line);
          if (extractedPrice) {
            if (!originalPrice && line.includes('%')) {
              originalPrice = extractedPrice;
            } else if (!price) {
              price = extractedPrice;
            }
          }
        }
        
        if (price) break;
      }
    }
    
    if (!price) {
      console.log(`No price found for product: ${productName} from ${productUrl}`);
      return null;
    }
    
    let imageUrl = '';
    const imageSelectors = [
      'img[src*="goods"]',
      '.product_image img',
      '.goods_image img',
      'img[src*="data"]'
    ];
    
    for (const selector of imageSelectors) {
      const imgElement = $(selector).first();
      if (imgElement.length) {
        let imgSrc = imgElement.attr('src') || '';
        if (imgSrc) {
          if (imgSrc.startsWith('//')) {
            imgSrc = 'https:' + imgSrc;
          } else if (imgSrc.startsWith('/')) {
            imgSrc = 'https://inje-mall.com' + imgSrc;
          } else if (!imgSrc.startsWith('http')) {
            imgSrc = 'https://inje-mall.com/' + imgSrc;
          }
          imageUrl = imgSrc;
          break;
        }
      }
    }
    
    const product: Product = {
      id: generateProductId(productUrl),
      name: productName,
      price: price,
      originalPrice: originalPrice || undefined,
      image: imageUrl,
      url: productUrl,
      mall: '인제몰',
      region: '강원도',
      category: '농특산물',
      inStock: true,
      scrapedAt: new Date().toISOString()
    };
    
    console.log(`✓ Scraped: ${productName} - ${price}`);
    return product;
    
  } catch (error) {
    console.error(`Error scraping ${productUrl}:`, error instanceof Error ? error.message : error);
    return null;
  }
}

async function scrapeInjeProducts(): Promise<void> {
  try {
    console.log('🚀 Starting Inje Mall comprehensive scraping...');
    
    const homepageUrl = 'https://inje-mall.com/';
    console.log(`Fetching homepage: ${homepageUrl}`);
    
    const homepageResponse = await axios.get(homepageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
      },
      timeout: 15000
    });

    const $ = cheerio.load(homepageResponse.data);
    
    const productUrls: string[] = [];
    
    $('a[href*="/goods/view?no="]').each((_, element) => {
      const href = $(element).attr('href');
      if (href) {
        let fullUrl = href;
        if (href.startsWith('/')) {
          fullUrl = 'https://inje-mall.com' + href;
        }
        if (!productUrls.includes(fullUrl)) {
          productUrls.push(fullUrl);
        }
      }
    });
    
    console.log(`Found ${productUrls.length} product URLs on homepage`);
    
    if (productUrls.length === 0) {
      console.log('No product URLs found. Checking page structure...');
      console.log('Sample links found:', $('a').slice(0, 10).map((_, el) => $(el).attr('href')).get());
      return;
    }
    
    const products: Product[] = [];
    const scrapingErrors: string[] = [];
    
    for (let i = 0; i < productUrls.length; i++) {
      const url = productUrls[i];
      console.log(`\nProgress: ${i + 1}/${productUrls.length}`);
      
      try {
        const product = await scrapeProductDetails(url);
        if (product) {
          products.push(product);
        }
      } catch (error) {
        const errorMsg = `Failed to scrape ${url}: ${error instanceof Error ? error.message : error}`;
        console.error(errorMsg);
        scrapingErrors.push(errorMsg);
      }
      
      if (i < productUrls.length - 1) {
        await delay(1000 + Math.random() * 1000);
      }
    }
    
    const outputDir = path.join(__dirname, 'output');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    const productsFile = path.join(outputDir, 'inje-products.json');
    fs.writeFileSync(productsFile, JSON.stringify(products, null, 2), 'utf8');
    
    const summary = {
      totalUrls: productUrls.length,
      successfulScrapes: products.length,
      failedScrapes: scrapingErrors.length,
      productsWithPrices: products.filter(p => p.price).length,
      categories: [...new Set(products.map(p => p.category))],
      scrapingErrors: scrapingErrors,
      timestamp: new Date().toISOString(),
      sampleProducts: products.slice(0, 3).map(p => ({
        name: p.name,
        price: p.price,
        url: p.url
      }))
    };
    
    const summaryFile = path.join(outputDir, 'inje-scrape-summary.json');
    fs.writeFileSync(summaryFile, JSON.stringify(summary, null, 2), 'utf8');
    
    console.log('\n🎉 Inje Mall scraping completed!');
    console.log(`📊 Results:`);
    console.log(`   • Total URLs processed: ${productUrls.length}`);
    console.log(`   • Successful scrapes: ${products.length}`);
    console.log(`   • Products with prices: ${products.filter(p => p.price).length}`);
    console.log(`   • Failed scrapes: ${scrapingErrors.length}`);
    console.log(`\n📁 Files saved:`);
    console.log(`   • Products: ${productsFile}`);
    console.log(`   • Summary: ${summaryFile}`);
    
    if (products.length > 0) {
      console.log(`\n🔍 Sample products:`);
      products.slice(0, 3).forEach((product, index) => {
        console.log(`   ${index + 1}. ${product.name} - ${product.price}`);
      });
    }
    
  } catch (error) {
    console.error('Error in main scraping function:', error);
    throw error;
  }
}

if (require.main === module) {
  scrapeInjeProducts()
    .then(() => {
      console.log('✅ Scraping completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Scraping failed:', error);
      process.exit(1);
    });
}

export { scrapeInjeProducts };