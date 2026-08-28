const https = require('https');

const data = JSON.stringify({
  username: 'zildjiannesta',
  'g-recaptcha-response': 'dummy_token_123_bypass_test'
});

const options = {
  hostname: 'kemerdekaan.liputan6.com',
  port: 443,
  path: '/api/games/tariktambang/sessions',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
    'Origin': 'https://kemerdekaan.liputan6.com',
    'Referer': 'https://kemerdekaan.liputan6.com/games/tariktambang',
    'Content-Length': data.length
  }
};

const req = https.request(options, (res) => {
  console.log(`statusCode: ${res.statusCode}`);
  res.on('data', d => {
    process.stdout.write(d);
  });
});

req.on('error', error => {
  console.error(error);
});

req.write(data);
req.end();
