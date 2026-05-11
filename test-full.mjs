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
  console.log('\n🧪 FULL AUTHENTICATION & TABLE TEST\n');
  console.log('═'.repeat(70));
  
  try {
    // 1. Login as manager
    console.log('\n1️⃣  Logging in as manager (manager1/1234)...');
    const loginRes = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/employees/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { username: 'manager1', password: '1234' });
    
    console.log(`   Status: ${loginRes.status}`);
    if (loginRes.status === 200) {
      console.log(`   ✅ Login successful!`);
      console.log(`   Employee: ${loginRes.body.fullName}`);
      console.log(`   Branch: ${loginRes.body.branchId}`);
    } else {
      console.log(`   ❌ Login failed:`, loginRes.body);
      process.exit(1);
    }
    
    const cookies = loginRes.headers['set-cookie'];
    if (!cookies) {
      console.log('   ⚠️  No cookie received!');
      process.exit(1);
    }
    
    const cookie = cookies[0].split(';')[0];
    console.log(`   Cookie set: ${cookie.substring(0, 50)}...`);
    
    // 2. Get tables for branch WITHOUT filter (should get all branch's tables)
    const BRANCH_ID = '692372302ce7bbd21529bdd8'; // التحلية branch
    
    console.log(`\n2️⃣  Getting tables for manager's branch (${BRANCH_ID})...`);
    const tablesRes = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: `/api/tables?branchId=${BRANCH_ID}`,
      method: 'GET',
      headers: { 'Cookie': cookie }
    });
    
    console.log(`   Status: ${tablesRes.status}`);
    
    if (Array.isArray(tablesRes.body)) {
      console.log(`   ✅ Got tables! Count: ${tablesRes.body.length}`);
      
      if (tablesRes.body.length > 0) {
        const sample = tablesRes.body[0];
        console.log(`\n   Sample table:)`);
        console.log(`   - tableNumber: ${sample.tableNumber}`);
        console.log(`   - branchId: ${sample.branchId}`);
        console.log(`   - isOccupied: ${sample.isOccupied}`);
      }
      
      // Check all have correct branchId
      const allCorrect = tablesRes.body.every(t => t.branchId === BRANCH_ID);
      console.log(`\n   All tables from correct branch: ${allCorrect ? '✅ YES' : '❌ NO'}`);
      
    } else {
      console.log(`   ❌ Unexpected response:`, tablesRes.body);
    }
    
    // 3. Test with DIFFERENT branch (should fail or return empty)
    const OTHER_BRANCH = '692372302ce7bbd21529bdde'; // الملز
    console.log(`\n3️⃣  Testing with different branch (${OTHER_BRANCH})...`);
    
    const otherRes = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: `/api/tables?branchId=${OTHER_BRANCH}`,
      method: 'GET',
      headers: { 'Cookie': cookie }
    });
    
    console.log(`   Status: ${otherRes.status}`);
    if (Array.isArray(otherRes.body)) {
      console.log(`   Got ${otherRes.body.length} tables`);
      if (otherRes.body.length > 0) {
        console.log(`   ⚠️  WARNING: Manager can access other branch tables!`);
      } else {
        console.log(`   ✅ Correctly returned empty (other branch has no access)`);
      }
    }
    
    console.log('\n' + '═'.repeat(70));
    
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

test();
