import time
import hmac
import hashlib
import requests
from flask import current_app

class HttpClient:
    def __init__(self, base_url, api_key=None):
        self.base_url = base_url
        self.api_key = api_key or "KUNCI_API_ANDA_DISINI"
        self.session = requests.Session()

    def _get_headers(self, method, path):
        # Membuat timestamp dalam milidetik sesuai dokumentasi
        ts = str(int(time.time() * 1000))
        
        # Format payload: METHOD:FULL_PATH:TIMESTAMP
        payload = f"{method}:{path}:{ts}"
        
        # Membuat signature HMAC-SHA256 menggunakan API Key
        signature = hmac.new(
            self.api_key.encode('utf-8'),
            payload.encode('utf-8'),
            hashlib.sha256
        ).hexdigest()
        
        return {
            "X-Timestamp": ts,
            "X-Signature": signature,
            "Content-Type": "application/json"
        }

    def get(self, endpoint, params=None):
        url = f"{self.base_url}{endpoint}"
        # Ambil path relatif untuk payload signature
        path = endpoint.split('?')[0]
        headers = self._get_headers("GET", path)
        
        response = self.session.get(url, headers=headers, params=params, timeout=8)
        return response.json()
