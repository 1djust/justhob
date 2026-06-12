const http = require('http');

async function testBackend() {
  const loginData = JSON.stringify({ email: "manager_pro@justhob.com", password: "Test1234!" });
  
  const loginReq = http.request({
    hostname: 'localhost',
    port: 3002,
    path: '/api/auth/login',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(loginData)
    }
  }, (res) => {
    let rawData = '';
    let cookies = res.headers['set-cookie'];
    res.on('data', (chunk) => rawData += chunk);
    res.on('end', () => {
      const data = JSON.parse(rawData);
      console.log("Login successful. Workspace ID:", data.user.workspaces[0].workspaceId);
      
      const workspaceId = data.user.workspaces[0].workspaceId;
      const cookieHeader = cookies.map(c => c.split(';')[0]).join('; ');
      
      const start = Date.now();
      const patchData = JSON.stringify({ allowPartialPayments: false });
      
      const patchReq = http.request({
        hostname: 'localhost',
        port: 3002,
        path: '/api/workspaces/' + workspaceId,
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(patchData),
          'Cookie': cookieHeader
        }
      }, (patchRes) => {
        const end = Date.now();
        console.log(`PATCH /api/workspaces took ${end - start}ms`);
      });
      
      patchReq.write(patchData);
      patchReq.end();
    });
  });
  
  loginReq.write(loginData);
  loginReq.end();
}

testBackend();
