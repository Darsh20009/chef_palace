import http from 'http';

function makeRequest(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: JSON.parse(body)
          });
        } catch {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: body
          });
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function test() {
  console.log('\n🔐 TESTING WITH AUTHENTICATION\n');
  
  try {
    // Login
    console.log('1️⃣  Logging in...');
    const loginRes = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/employees/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    }, {
      phone: '501111111',
      password: '1234'
    });
    
    const cookies = loginRes.headers['set-cookie'];
    console.log(`   ✓ Login status: ${loginRes.status}`);
    if (cookies) {
      console.log(`   ✓ Got cookie: ${cookies[0]?.substring(0, 50)}...`);
    }
    
    // Test getting tables with branch filter
    console.log('\n2️⃣  Getting tables for branch...');
    const BRANCH_ID = '692372302ce7bbd21529bdd8';
    
    const tablesRes = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: `/api/tables?branchId=${BRANCH_ID}`,
      method: 'GET',
      headers: {
        'Cookie': cookies ? cookies[0] : ''
      }
    });
    
    console.log(`   ✓ Status: ${tablesRes.status}`);
    
    if (Array.isArray(tablesRes.body)) {
      console.log(`   ✓ Tables count: ${tablesRes.body.length}`);
      if (tablesRes.body.length > 0) {
        console.log(`   ✓ Sample table: ${tablesRes.body[0].tableNumber}`);
        console.log(`   ✓ Sample branchId: ${tablesRes.body[0].branchId}`);
      }
    } else {
      console.log(`   ❌ Unexpected response:`, tablesRes.body);
    }
    
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

test();
