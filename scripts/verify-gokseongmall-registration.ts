import * as fs from 'fs';

interface Product {
  id: string;
  title: string;
  price: string;
  image: string;
  url: string;
  category: string;
  mall: string;
  mallId: string;
}

async function verifyGokseongmallRegistration() {
  console.log('Verifying 곡성몰 product registration...');

  // Read current products database
  const dbPath = './src/data/products.json';
  if (!fs.existsSync(dbPath)) {
    console.error('Products database not found:', dbPath);
    return;
  }

  const products: Product[] = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
  console.log(`Total products in database: ${products.length}`);

  // Filter 곡성몰 products
  const gokseongmallProducts = products.filter(p => p.mallId === 'gokseongmall');
  console.log(`곡성몰 products found: ${gokseongmallProducts.length}`);

  // Verify essential fields
  const issues = [];
  let validCount = 0;

  gokseongmallProducts.forEach((product, index) => {
    const productIssues = [];

    // Check required fields
    if (!product.id) productIssues.push('Missing ID');
    if (!product.title) productIssues.push('Missing title');
    if (!product.price) productIssues.push('Missing price');
    if (!product.url) productIssues.push('Missing URL');
    if (!product.category) productIssues.push('Missing category');
    if (!product.mall) productIssues.push('Missing mall name');
    if (!product.mallId) productIssues.push('Missing mall ID');

    // Check for valid price format (should contain '원')
    if (product.price && !product.price.includes('원')) {
      productIssues.push('Invalid price format');
    }

    // Check for valid URL format
    if (product.url && !product.url.startsWith('http')) {
      productIssues.push('Invalid URL format');
    }

    // Check mall consistency
    if (product.mall !== '곡성몰') {
      productIssues.push(`Incorrect mall name: ${product.mall}`);
    }

    if (product.mallId !== 'gokseongmall') {
      productIssues.push(`Incorrect mall ID: ${product.mallId}`);
    }

    if (productIssues.length > 0) {
      issues.push({
        index: index + 1,
        id: product.id,
        title: product.title,
        issues: productIssues
      });
    } else {
      validCount++;
    }
  });

  // Category analysis
  const categoryCount = gokseongmallProducts.reduce((acc, product) => {
    acc[product.category] = (acc[product.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Price analysis
  const pricesWithValues = gokseongmallProducts.filter(p => p.price && p.price.includes('원'));
  const imagesWithValues = gokseongmallProducts.filter(p => p.image && p.image.length > 0);

  // Sample products for verification
  const sampleProducts = gokseongmallProducts.slice(0, 5).map(p => ({
    id: p.id,
    title: p.title,
    price: p.price,
    category: p.category,
    url: p.url
  }));

  // Create verification report
  const report = {
    timestamp: Date.now(),
    mall: '곡성몰',
    mallId: 'gokseongmall',
    totalProducts: gokseongmallProducts.length,
    validProducts: validCount,
    issuesFound: issues.length,
    productsWithPrices: pricesWithValues.length,
    productsWithImages: imagesWithValues.length,
    categoryBreakdown: categoryCount,
    issues: issues.slice(0, 10), // Show first 10 issues
    sampleProducts,
    summary: {
      registrationSuccess: issues.length === 0,
      completeness: `${validCount}/${gokseongmallProducts.length} products valid`,
      priceRate: `${pricesWithValues.length}/${gokseongmallProducts.length} have prices`,
      imageRate: `${imagesWithValues.length}/${gokseongmallProducts.length} have images`
    }
  };

  const reportPath = './scripts/output/gokseongmall-verification-report.json';
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  console.log('\n=== VERIFICATION REPORT ===');
  console.log(`Mall: ${report.mall}`);
  console.log(`Total products: ${report.totalProducts}`);
  console.log(`Valid products: ${report.validProducts}`);
  console.log(`Issues found: ${report.issuesFound}`);
  console.log(`Products with prices: ${report.productsWithPrices}`);
  console.log(`Products with images: ${report.productsWithImages}`);
  
  console.log('\nCategory breakdown:');
  Object.entries(categoryCount).forEach(([category, count]) => {
    console.log(`  ${category}: ${count} products`);
  });

  if (issues.length > 0) {
    console.log('\nFirst few issues found:');
    issues.slice(0, 5).forEach(issue => {
      console.log(`  Product ${issue.index} (${issue.id}): ${issue.issues.join(', ')}`);
    });
  } else {
    console.log('\n✓ All products passed validation!');
  }

  console.log(`\nVerification report saved: ${reportPath}`);
  return report;
}

if (require.main === module) {
  verifyGokseongmallRegistration().catch(console.error);
}

export { verifyGokseongmallRegistration };