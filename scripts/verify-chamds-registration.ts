import { readFileSync, writeFileSync } from 'fs';

interface DatabaseProduct {
  id: string;
  title: string;
  description: string;
  price: number;
  originalPrice?: number;
  currency: string;
  imageUrl: string;
  productUrl: string;
  mallId: string;
  mallName: string;
  mallUrl: string;
  region: string;
  category: string;
  tags: string[];
  isActive: boolean;
  isFeatured: boolean;
  clickCount: number;
  createdAt: string;
  updatedAt: string;
}

async function verifyChamdsRegistration(): Promise<void> {
  try {
    console.log('🔍 Verifying 참달성 product registration...');

    // Read products database
    const productsData = readFileSync('./src/data/products.json', 'utf8');
    const allProducts: DatabaseProduct[] = JSON.parse(productsData);
    
    // Filter 참달성 products
    const chamdsProducts = allProducts.filter(p => p.mallId === 'chamds');
    
    console.log(`📊 Found ${chamdsProducts.length} 참달성 products in database`);
    console.log(`📚 Total products in database: ${allProducts.length}`);

    // Verify data quality
    const verification = {
      totalProducts: chamdsProducts.length,
      dataQuality: {
        withTitles: 0,
        withPrices: 0,
        withImages: 0,
        withProductUrls: 0,
        withCategories: 0,
        withValidPrices: 0
      },
      categories: {} as { [key: string]: number },
      priceRange: {
        min: Number.MAX_VALUE,
        max: 0,
        average: 0
      },
      sampleProducts: [] as any[],
      issues: [] as string[]
    };

    let totalPrice = 0;
    let validPriceCount = 0;

    for (const product of chamdsProducts) {
      // Check data completeness
      if (product.title && product.title.trim()) verification.dataQuality.withTitles++;
      if (product.price > 0) {
        verification.dataQuality.withPrices++;
        verification.dataQuality.withValidPrices++;
        totalPrice += product.price;
        validPriceCount++;
        
        if (product.price < verification.priceRange.min) verification.priceRange.min = product.price;
        if (product.price > verification.priceRange.max) verification.priceRange.max = product.price;
      }
      if (product.imageUrl && product.imageUrl.trim()) verification.dataQuality.withImages++;
      if (product.productUrl && product.productUrl.trim()) verification.dataQuality.withProductUrls++;
      if (product.category && product.category.trim()) verification.dataQuality.withCategories++;

      // Count categories
      if (product.category) {
        verification.categories[product.category] = (verification.categories[product.category] || 0) + 1;
      }

      // Check for issues
      if (!product.title || product.title.trim().length < 3) {
        verification.issues.push(`Product ${product.id} has missing or too short title`);
      }
      if (product.price <= 0) {
        verification.issues.push(`Product ${product.id} has invalid price: ${product.price}`);
      }
      if (!product.imageUrl || !product.imageUrl.startsWith('http')) {
        verification.issues.push(`Product ${product.id} has invalid image URL`);
      }
      if (!product.productUrl || !product.productUrl.startsWith('http')) {
        verification.issues.push(`Product ${product.id} has invalid product URL`);
      }
    }

    // Calculate average price
    verification.priceRange.average = validPriceCount > 0 ? totalPrice / validPriceCount : 0;

    // Get sample products
    verification.sampleProducts = chamdsProducts.slice(0, 5).map(p => ({
      id: p.id,
      title: p.title.substring(0, 50) + (p.title.length > 50 ? '...' : ''),
      price: p.price,
      category: p.category,
      hasImage: !!p.imageUrl,
      hasProductUrl: !!p.productUrl
    }));

    // Save verification report
    writeFileSync('./scripts/output/chamds-verification-report.json', JSON.stringify(verification, null, 2));

    // Display results
    console.log('\n📊 Verification Results:');
    console.log(`✅ Total 참달성 products: ${verification.totalProducts}`);
    
    console.log('\n📋 Data Quality:');
    console.log(`📝 Products with titles: ${verification.dataQuality.withTitles}/${verification.totalProducts} (${((verification.dataQuality.withTitles/verification.totalProducts)*100).toFixed(1)}%)`);
    console.log(`💰 Products with prices: ${verification.dataQuality.withPrices}/${verification.totalProducts} (${((verification.dataQuality.withPrices/verification.totalProducts)*100).toFixed(1)}%)`);
    console.log(`🖼️ Products with images: ${verification.dataQuality.withImages}/${verification.totalProducts} (${((verification.dataQuality.withImages/verification.totalProducts)*100).toFixed(1)}%)`);
    console.log(`🔗 Products with URLs: ${verification.dataQuality.withProductUrls}/${verification.totalProducts} (${((verification.dataQuality.withProductUrls/verification.totalProducts)*100).toFixed(1)}%)`);
    console.log(`📂 Products with categories: ${verification.dataQuality.withCategories}/${verification.totalProducts} (${((verification.dataQuality.withCategories/verification.totalProducts)*100).toFixed(1)}%)`);

    console.log('\n💰 Price Analysis:');
    console.log(`📊 Price range: ₩${verification.priceRange.min.toLocaleString()} - ₩${verification.priceRange.max.toLocaleString()}`);
    console.log(`📈 Average price: ₩${Math.round(verification.priceRange.average).toLocaleString()}`);

    console.log('\n📂 Categories:');
    Object.entries(verification.categories)
      .sort(([,a], [,b]) => b - a)
      .forEach(([category, count]) => {
        console.log(`  ${category}: ${count} products`);
      });

    console.log('\n🎯 Sample Products:');
    verification.sampleProducts.forEach((product, index) => {
      const status = [];
      if (product.hasImage) status.push('🖼️');
      if (product.hasProductUrl) status.push('🔗');
      
      console.log(`  ${index + 1}. ${product.title}`);
      console.log(`     ₩${product.price.toLocaleString()} | ${product.category} ${status.join(' ')}`);
    });

    if (verification.issues.length > 0) {
      console.log('\n⚠️ Issues Found:');
      verification.issues.slice(0, 10).forEach(issue => {
        console.log(`  - ${issue}`);
      });
      if (verification.issues.length > 10) {
        console.log(`  ... and ${verification.issues.length - 10} more issues`);
      }
    } else {
      console.log('\n✅ No data quality issues found!');
    }

    // Overall assessment
    const completenessScore = (
      (verification.dataQuality.withTitles / verification.totalProducts) * 0.3 +
      (verification.dataQuality.withValidPrices / verification.totalProducts) * 0.3 +
      (verification.dataQuality.withImages / verification.totalProducts) * 0.2 +
      (verification.dataQuality.withProductUrls / verification.totalProducts) * 0.1 +
      (verification.dataQuality.withCategories / verification.totalProducts) * 0.1
    ) * 100;

    console.log(`\n🏆 Overall Data Quality Score: ${completenessScore.toFixed(1)}%`);
    
    if (completenessScore >= 95) {
      console.log('🎉 Excellent data quality!');
    } else if (completenessScore >= 85) {
      console.log('👍 Good data quality with minor issues');
    } else if (completenessScore >= 70) {
      console.log('⚠️ Acceptable data quality but needs improvement');
    } else {
      console.log('❌ Poor data quality - significant issues need attention');
    }

  } catch (error) {
    console.error('❌ Error during verification:', error);
    throw error;
  }
}

// Run verification
verifyChamdsRegistration().then(() => {
  console.log('\n✅ 참달성 registration verification completed!');
}).catch(console.error);