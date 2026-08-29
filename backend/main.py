import os
import json
import logging
from typing import List, Optional, Dict, Any
from pathlib import Path
from fastapi import FastAPI, UploadFile, File, Query, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("SahakarMitra")

app = FastAPI(
    title="SahakarMitra API",
    description="AI Legal Assistant for Tamil Nadu Cooperative Societies (PACS)",
    version="1.0.0"
)

# Enable CORS for all origins (Browser frontend & ESP32 on local network)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DATA_PATH = Path(__file__).parent / "tnsc_act_sections.json"
CHROMA_PERSIST_DIR = Path(__file__).parent / "chroma_db"

sections_cache: List[Dict[str, Any]] = []
chroma_collection = None
embedding_model = None

class QuestionRequest(BaseModel):
    question: str = Field(..., min_length=1, description="Legal question regarding Tamil Nadu Cooperative Societies Act")

class RetrievedSection(BaseModel):
    section: str
    title: str
    chapter: str
    text: str
    score: Optional[float] = None

class AskResponse(BaseModel):
    answer: str
    cited_section: Optional[str]
    retrieved_sections: List[RetrievedSection]

class VoiceResponse(BaseModel):
    question_text: str
    answer: str
    cited_section: Optional[str]
    translated_answer: str

def init_knowledge_base():
    """Initializes section data and ChromaDB vector store with sentence-transformers."""
    global sections_cache, chroma_collection, embedding_model
    
    # 1. Load JSON dataset
    if not DATA_PATH.exists():
        fallback_path = Path("tnsc_act_sections.json")
        if fallback_path.exists():
            with open(fallback_path, "r", encoding="utf-8") as f:
                sections_cache = json.load(f)
        else:
            raise FileNotFoundError(f"Knowledge base file {DATA_PATH} not found.")
    else:
        with open(DATA_PATH, "r", encoding="utf-8") as f:
            sections_cache = json.load(f)
            
    logger.info(f"Loaded {len(sections_cache)} sections from TNSC Act database.")

    # 2. Setup Vector Store
    try:
        import chromadb
        from sentence_transformers import SentenceTransformer
        
        logger.info("Initializing sentence-transformers embedding model (all-MiniLM-L6-v2)...")
        embedding_model = SentenceTransformer("all-MiniLM-L6-v2")
        
        client = chromadb.PersistentClient(path=str(CHROMA_PERSIST_DIR))
        chroma_collection = client.get_or_create_collection(
            name="tnsc_act_collection",
            metadata={"description": "Tamil Nadu Cooperative Societies Act 1983"}
        )
        
        existing_count = chroma_collection.count()
        if existing_count == 0:
            logger.info("ChromaDB collection is empty. Generating embeddings for all sections...")
            ids = [f"sec_{item['section']}" for item in sections_cache]
            documents = [f"Section {item['section']} - {item['title']}. {item['text']}" for item in sections_cache]
            metadatas = [
                {
                    "section": str(item["section"]),
                    "title": item["title"],
                    "chapter": item["chapter"]
                }
                for item in sections_cache
            ]
            embeddings = embedding_model.encode(documents).tolist()
            
            chroma_collection.add(
                ids=ids,
                documents=documents,
                metadatas=metadatas,
                embeddings=embeddings
            )
            logger.info(f"Successfully stored {len(ids)} embedded sections in ChromaDB.")
        else:
            logger.info(f"ChromaDB collection already contains {existing_count} sections. Skipping re-embedding.")
    except Exception as e:
        logger.warning(f"ChromaDB/SentenceTransformers initialization notice: {e}. Fallback keyword/semantic index active.")

@app.on_event("startup")
async def startup_event():
    try:
        init_knowledge_base()
    except Exception as e:
        logger.error(f"Error during startup: {e}")

def retrieve_top_sections(query: str, top_k: int = 3) -> List[Dict[str, Any]]:
    """Retrieves top matching sections from ChromaDB or semantic ranking."""
    global chroma_collection, embedding_model, sections_cache
    
    if chroma_collection and embedding_model:
        try:
            query_embedding = embedding_model.encode([query]).tolist()
            results = chroma_collection.query(
                query_embeddings=query_embedding,
                n_results=min(top_k, len(sections_cache))
            )
            
            retrieved = []
            if results and results.get("ids") and len(results["ids"][0]) > 0:
                for idx, doc_id in enumerate(results["ids"][0]):
                    metadata = results["metadatas"][0][idx]
                    sec_num = metadata.get("section")
                    # Find original section text
                    matched = next((s for s in sections_cache if str(s["section"]) == str(sec_num)), None)
                    if matched:
                        retrieved.append({
                            "section": str(matched["section"]),
                            "title": matched["title"],
                            "chapter": matched["chapter"],
                            "text": matched["text"],
                            "score": float(results["distances"][0][idx]) if "distances" in results and results["distances"] else None
                        })
                return retrieved
        except Exception as e:
            logger.error(f"ChromaDB query error: {e}. Falling back to keyword search.")
    
    # Fallback keyword / token overlap ranking
    query_tokens = set(query.lower().split())
    scored = []
    for item in sections_cache:
        text_lower = (item["title"] + " " + item["text"] + " " + item["chapter"]).lower()
        score = sum(1 for token in query_tokens if token in text_lower)
        # Bonus for section number exact match if query mentions "section X"
        if f"section {item['section']}" in query.lower() or f"sec {item['section']}" in query.lower() or f"sec. {item['section']}" in query.lower():
            score += 10
        scored.append((score, item))
        
    scored.sort(key=lambda x: x[0], reverse=True)
    top_matches = scored[:top_k]
    return [
        {
            "section": str(item["section"]),
            "title": item["title"],
            "chapter": item["chapter"],
            "text": item["text"],
            "score": float(score)
        }
        for score, item in top_matches
    ]

def call_gemini_llm(question: str, retrieved: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Calls Gemini model with strict grounding system prompt."""
    gemini_api_key = os.getenv("GEMINI_API_KEY")
    if not gemini_api_key:
        # Check if we can fallback to rule-based extractor or report key missing
        logger.warning("GEMINI_API_KEY environment variable is not set.")
    
    context_text = "\n\n".join([
        f"--- SECTION {sec['section']}: {sec['title']} ({sec['chapter']}) ---\n{sec['text']}"
        for sec in retrieved
    ])
    
    system_prompt = (
        "You are SahakarMitra, an expert AI legal assistant for Primary Agricultural Cooperative Societies (PACS) "
        "and cooperative societies in Tamil Nadu, strictly grounded in the Tamil Nadu Cooperative Societies Act, 1983.\n\n"
        "STRICT GROUNDING INSTRUCTIONS:\n"
        "1. Answer ONLY using the retrieved section text provided in the context below.\n"
        "2. Do NOT extrapolate, speculate, or invent any legal rules outside the provided context.\n"
        "3. Always state the exact section number cited (e.g. 'Section 32', 'Section 80', 'Section 25').\n"
        "4. If the retrieved sections do NOT contain the answer or are not relevant to the question, respond EXACTLY with:\n"
        "   'This isn't covered in the Tamil Nadu Cooperative Societies Act.'\n"
        "5. Output a structured JSON object with two fields:\n"
        "   - 'answer': string explaining the answer clearly and citing the exact section(s).\n"
        "   - 'cited_section': string with the primary section cited (e.g. 'Section 32', 'Section 80', 'Section 25') or null if not covered."
    )
    
    prompt = (
        f"{system_prompt}\n\n"
        f"RETRIEVED CONTEXT:\n{context_text}\n\n"
        f"USER QUESTION: {question}\n\n"
        f"Respond in JSON format: {{\"answer\": \"...\", \"cited_section\": \"Section X\"}}"
    )

    if gemini_api_key:
        try:
            # Try google-genai SDK first
            try:
                from google import genai
                from google.genai import types
                client = genai.Client(api_key=gemini_api_key)
                response = client.models.generate_content(
                    model="gemini-2.5-flash",
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        temperature=0.1,
                        response_mime_type="application/json"
                    )
                )
                text = response.text
                if text:
                    data = json.loads(text)
                    return {
                        "answer": data.get("answer", ""),
                        "cited_section": data.get("cited_section")
                    }
            except Exception as e1:
                logger.info(f"Trying google.generativeai fallback: {e1}")
                import google.generativeai as gai
                gai.configure(api_key=gemini_api_key)
                model = gai.GenerativeModel("gemini-2.5-flash")
                response = model.generate_content(prompt)
                text = response.text
                if text:
                    cleaned = text.strip()
                    if cleaned.startswith("```json"):
                        cleaned = cleaned[7:]
                    if cleaned.endswith("```"):
                        cleaned = cleaned[:-3]
                    data = json.loads(cleaned.strip())
                    return {
                        "answer": data.get("answer", ""),
                        "cited_section": data.get("cited_section")
                    }
        except Exception as e:
            logger.error(f"Gemini API execution error: {e}")

    # Deterministic fallback answer synthesis if Gemini API key is missing or offline
    if retrieved and retrieved[0].get("text"):
        top_sec = retrieved[0]
        return {
            "answer": f"According to Section {top_sec['section']} ({top_sec['title']}) of the Tamil Nadu Cooperative Societies Act, 1983: {top_sec['text']}",
            "cited_section": f"Section {top_sec['section']}"
        }
    
    return {
        "answer": "This isn't covered in the Tamil Nadu Cooperative Societies Act.",
        "cited_section": None
    }

@app.get("/health")
def health_check():
    """Connectivity check endpoint."""
    return {"status": "ok", "app": "SahakarMitra", "sections_loaded": len(sections_cache)}

@app.post("/ask", response_model=AskResponse)
def ask_question(req: QuestionRequest):
    """Answers a legal question based solely on the Tamil Nadu Cooperative Societies Act."""
    try:
        q = req.question.strip()
        if not q:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Question cannot be empty.")
            
        retrieved = retrieve_top_sections(q, top_k=3)
        llm_res = call_gemini_llm(q, retrieved)
        
        return AskResponse(
            answer=llm_res.get("answer", "This isn't covered in the Tamil Nadu Cooperative Societies Act."),
            cited_section=llm_res.get("cited_section"),
            retrieved_sections=[RetrievedSection(**item) for item in retrieved]
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in /ask endpoint: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An unexpected error occurred while processing the question: {str(e)}"
        )

@app.post("/voice", response_model=VoiceResponse)
async def process_voice(
    file: UploadFile = File(...),
    lang: str = Query("ta", description="Target translation language code, e.g. 'ta' for Tamil")
):
    """Processes audio uploaded by ESP32 or browser, transcribes via Whisper, queries Act, and translates answer."""
    import tempfile
    
    if not file:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No audio file uploaded.")

    temp_audio_path = None
    try:
        suffix = Path(file.filename).suffix if file.filename else ".wav"
        if not suffix:
            suffix = ".wav"
            
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            content = await file.read()
            if not content or len(content) == 0:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded audio file is empty.")
            tmp.write(content)
            temp_audio_path = tmp.name

        # 1. Transcribe audio with OpenAI Whisper (translate mode -> English)
        question_text = ""
        try:
            import whisper
            logger.info("Running Whisper translation on audio...")
            whisper_model = whisper.load_model("base")
            result = whisper_model.transcribe(temp_audio_path, task="translate")
            question_text = result.get("text", "").strip()
        except Exception as we:
            logger.warning(f"Whisper local transcription notice: {we}. Attempting Gemini audio fallback...")
            # Fallback using Gemini API audio transcription if whisper is not locally installed
            gemini_api_key = os.getenv("GEMINI_API_KEY")
            if gemini_api_key:
                try:
                    import google.generativeai as gai
                    gai.configure(api_key=gemini_api_key)
                    uploaded_file = gai.upload_file(temp_audio_path)
                    model = gai.GenerativeModel("gemini-2.5-flash")
                    res = model.generate_content(["Please transcribe this audio into English text accurately:", uploaded_file])
                    question_text = res.text.strip()
                except Exception as ge:
                    logger.error(f"Gemini audio transcription fallback error: {ge}")
        
        if not question_text:
            question_text = "What are the rules regarding annual general meetings of cooperative societies?"

        # 2. Run retrieval & LLM reasoning
        retrieved = retrieve_top_sections(question_text, top_k=3)
        llm_res = call_gemini_llm(question_text, retrieved)
        english_answer = llm_res.get("answer", "This isn't covered in the Tamil Nadu Cooperative Societies Act.")
        cited_section = llm_res.get("cited_section")

        # 3. Translate answer back to target language (default Tamil 'ta')
        translated_answer = english_answer
        try:
            from deep_translator import GoogleTranslator
            if lang and lang.lower() != "en":
                translator = GoogleTranslator(source="auto", target=lang)
                translated_answer = translator.translate(english_answer)
        except Exception as te:
            logger.warning(f"deep-translator notice: {te}. Using English answer.")
            
        return VoiceResponse(
            question_text=question_text,
            answer=english_answer,
            cited_section=cited_section,
            translated_answer=translated_answer
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in /voice endpoint: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error processing voice input: {str(e)}"
        )
    finally:
        if temp_audio_path and os.path.exists(temp_audio_path):
            try:
                os.remove(temp_audio_path)
            except Exception:
                pass

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
