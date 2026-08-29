# SahakarMitra — Backend

SahakarMitra is an AI Legal Assistant designed specifically for Primary Agricultural Cooperative Societies (PACS) and cooperative institutions across Tamil Nadu, strictly grounded in the **Tamil Nadu Cooperative Societies Act, 1983**.

---

## 📁 Directory Structure

```text
backend/
├── main.py                 # FastAPI application with /ask, /voice, and /health endpoints
├── tnsc_act_sections.json  # Complete Tamil Nadu Cooperative Societies Act dataset
├── requirements.txt        # Python package dependencies
├── test_ask.py             # Automated test suite for the 5 sample legal domains
├── .env.example            # Sample environment variables configuration
└── README.md               # Setup and execution guide
```

---

## 🚀 Quick Setup & Run

### 1. Create and Activate Virtual Environment

```bash
cd backend
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

### 2. Install Dependencies

```bash
pip install -r requirements.txt
```

### 3. Configure Environment Variables

```bash
cp .env.example .env
```

Edit `.env` and set your `GEMINI_API_KEY`:

```env
GEMINI_API_KEY="your_actual_gemini_api_key"
PORT=8000
```

### 4. Start the FastAPI Server

```bash
python3 main.py
# Or with uvicorn directly:
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

The server will initialize ChromaDB with embeddings for all sections in `tnsc_act_sections.json` and start listening on `http://0.0.0.0:8000`.

---

## 🧪 Verification & Testing

Run the automated test script to verify all 5 core legal domains:

```bash
python3 test_ask.py
```

This verifies:
1. **General Meetings** (Section 32)
2. **Board Elections** (Section 33)
3. **Audit of Accounts** (Section 80)
4. **Expulsion of Members** (Section 25)
5. **Winding-Up & Dissolution** (Section 137)

---

## 📡 API Endpoints

### 1. `GET /health`
Connectivity check.
```json
{
  "status": "ok",
  "app": "SahakarMitra",
  "sections_loaded": 27
}
```

### 2. `POST /ask`
Submit text question regarding Tamil Nadu Cooperative Societies Act.
- **Request Body**:
  ```json
  {
    "question": "What is the procedure for expulsion of a member from a cooperative society?"
  }
  ```
- **Response**:
  ```json
  {
    "answer": "Under Section 25 of the Tamil Nadu Co-operative Societies Act, 1983, a member who has acted adversely to the interests of the society may be expelled by a resolution passed by not less than two-thirds of the members present and voting at a general meeting...",
    "cited_section": "Section 25",
    "retrieved_sections": [
      {
        "section": "25",
        "title": "Expulsion of members",
        "chapter": "Chapter III: Members and their Rights and Liabilities",
        "text": "..."
      }
    ]
  }
  ```

### 3. `POST /voice?lang=ta`
Hardware / Browser audio submission endpoint.
- Accepts `multipart/form-data` with an audio file (`file`).
- Query param `lang` (default: `ta` for Tamil).
- Transcribes using Whisper (or Gemini audio transcription), retrieves grounded legal section, and translates back into the requested language.
- **Response**:
  ```json
  {
    "question_text": "How often should audit be conducted for cooperative societies?",
    "answer": "According to Section 80 of the Tamil Nadu Co-operative Societies Act, 1983...",
    "cited_section": "Section 80",
    "translated_answer": "தமிழ்நாடு கூட்டுறவு சங்கங்கள் சட்டம் 1983, பிரிவு 80 இன் படி..."
  }
  ```

---

## 🔌 Hardware Integration (ESP32 Contract)

The physical ESP32 device records voice audio upon button trigger and submits:

```http
POST http://<backend-ip>:8000/voice?lang=ta HTTP/1.1
Host: <backend-ip>:8000
Content-Type: multipart/form-data; boundary=----ESP32Boundary

------ESP32Boundary
Content-Disposition: form-data; name="file"; filename="audio.wav"
Content-Type: audio/wav

<binary audio bytes>
------ESP32Boundary--
```
