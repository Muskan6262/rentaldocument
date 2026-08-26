import openai
from typing import List, Dict, Any

from app.core.config import settings

class RAGService:
    def __init__(self):
        if settings.GROQ_API_KEY:
            self.client = openai.OpenAI(
                base_url="https://api.groq.com/openai/v1",
                api_key=settings.GROQ_API_KEY
            )
            self.model = "llama-3.3-70b-versatile"
        elif settings.OPENAI_API_KEY:
            self.client = openai.OpenAI(
                base_url="https://api.sarvam.ai/v1",
                api_key=settings.OPENAI_API_KEY
            )
            self.model = "sarvam-105b"
        else:
            self.client = openai.OpenAI(
                base_url="https://api.groq.com/openai/v1",
                api_key="dummy_key_to_prevent_startup_crash"
            )
            self.model = "llama-3.3-70b-versatile"
        
    def generate_answer(self, question: str, chunks: List[Dict[str, Any]], temperature: float = 0.0, model: str = None) -> Dict[str, Any]:
        """
        Generate a grounded answer based ONLY on the provided retrieved chunks.
        Strictly enforces the rule to return 'not found' if context is missing.
        """
        
        if not chunks:
            return {
                "answer": "The information was not found in the uploaded agreement (no context retrieved).",
                "citations": [],
                "accuracy": 0,
                "confidence": "Not Found",
                "tokens_used": 0
            }
            
        # Build the context string and calculate individual relevance scores
        context_parts = []
        citations = []
        scores = []
        for i, chunk in enumerate(chunks):
            payload = chunk.get("payload", {})
            section = payload.get("section", "Unknown Section")
            page = payload.get("page_number", "Unknown Page")
            text = payload.get("text", "") # text might contain prepended heading from chunker
            
            raw_score = chunk.get("score", chunk.get("relevance_score", 0.0))
            if raw_score > 1.0:
                norm_score = min(1.0, raw_score / 100.0)
            elif 0 < raw_score <= 0.1: # RRF score range (0.015 - 0.035)
                norm_score = min(0.98, max(0.60, (raw_score / 0.033) * 0.92))
            elif raw_score > 0:
                norm_score = raw_score
            else:
                norm_score = 0.85
                
            score_pct = int(round(norm_score * 100))
            scores.append(norm_score)
            
            # Context blocks for LLM
            context_parts.append(f"--- Document Snippet [{i+1}] (Relevance: {score_pct}%) ---\nSection: {section}\nPage: {page}\nText: {text}\n")
            
            # Citations to return to frontend
            citations.append({
                "index": i + 1,
                "section": section,
                "page": page,
                "text_snippet": text[:150] + ("..." if len(text) > 150 else ""),
                "score": score_pct
            })
            
        context_string = "\n".join(context_parts)
        
        system_prompt = (
            "You are a document-understanding assistant specializing in rental agreements. "
            "You are NOT a replacement for legal counsel. "
            "Your sole purpose is to answer the user's question based strictly on the provided Document Snippets.\n\n"
            "CRITICAL RULES:\n"
            "1. If the provided snippets do not contain the answer, you must explicitly say: 'The information was not found in the uploaded agreement.'\n"
            "2. Never invent or guess rent amounts, deposits, dates, notice periods, or legal obligations.\n"
            "3. Clearly distinguish between what the agreement explicitly states and any general explanation. Do not represent general knowledge as if it appeared in the agreement.\n"
            "4. Cite the snippets you use by referencing their number (e.g., 'According to Snippet [1]...').\n"
        )
        
        user_prompt = (
            f"Retrieved Agreement Context:\n\n"
            f"{context_string}\n\n"
            f"User Question: {question}\n\n"
            f"Please answer the question accurately using the snippets above. If the context does not contain the answer, state that the information was not found in the uploaded agreement."
        )
        
        requested_model = model or self.model
        clamped_temp = max(0.0, min(1.0, float(temperature)))
        
        # Dynamic client and model selection
        if settings.GROQ_API_KEY and (requested_model.startswith("llama") or requested_model.startswith("deepseek") or requested_model.startswith("mixtral") or requested_model.startswith("gemma")):
            active_client = openai.OpenAI(
                base_url="https://api.groq.com/openai/v1",
                api_key=settings.GROQ_API_KEY
            )
            selected_model = requested_model
        elif settings.OPENAI_API_KEY:
            active_client = openai.OpenAI(
                base_url="https://api.sarvam.ai/v1",
                api_key=settings.OPENAI_API_KEY
            )
            # Sarvam supports sarvam-105b or sarvam-105b-conversations
            if requested_model.startswith("sarvam"):
                selected_model = "sarvam-105b"
            else:
                # If Groq is not configured, gracefully route to Sarvam 105B
                selected_model = "sarvam-105b"
        else:
            active_client = self.client
            selected_model = self.model

        try:
            response = active_client.chat.completions.create(
                model=selected_model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=clamped_temp
            )
            answer = response.choices[0].message.content
            tokens_used = response.usage.total_tokens if hasattr(response, "usage") and response.usage else 0
        except Exception as api_err:
            print(f"Primary LLM completion error with model {selected_model}: {api_err}")
            # Fallback to Sarvam 105B if other model failed
            if settings.OPENAI_API_KEY and selected_model != "sarvam-105b":
                try:
                    fallback_client = openai.OpenAI(base_url="https://api.sarvam.ai/v1", api_key=settings.OPENAI_API_KEY)
                    response = fallback_client.chat.completions.create(
                        model="sarvam-105b",
                        messages=[
                            {"role": "system", "content": system_prompt},
                            {"role": "user", "content": user_prompt}
                        ],
                        temperature=clamped_temp
                    )
                    answer = response.choices[0].message.content
                    tokens_used = response.usage.total_tokens if hasattr(response, "usage") and response.usage else 0
                except Exception as fb_err:
                    raise Exception(f"Chat generation failed: {fb_err}")
            else:
                raise Exception(f"Chat generation failed: {api_err}")
        
        answer = response.choices[0].message.content
        if not answer:
            answer = "Sorry, the AI model could not generate a response. Please try asking your question differently."
            
        tokens_used = response.usage.total_tokens if hasattr(response, "usage") and response.usage else 0
        
        # Calculate grounding accuracy
        is_not_found = (
            "not found in the uploaded agreement" in answer.lower() or 
            "information was not found" in answer.lower() or
            "does not mention" in answer.lower() or
            "not specified in the agreement" in answer.lower()
        )
        
        if is_not_found:
            accuracy = 0
            confidence = "Not Found"
        else:
            if scores:
                top_score = scores[0]
                avg_score = sum(scores) / len(scores)
                composite_score = (0.7 * top_score) + (0.3 * avg_score)
                accuracy = int(round(min(99, max(65, composite_score * 100))))
                if accuracy >= 88:
                    confidence = "High"
                elif accuracy >= 70:
                    confidence = "Medium"
                else:
                    confidence = "Low"
            else:
                accuracy = 85
                confidence = "Medium"
        
        return {
            "answer": answer,
            "citations": citations,
            "accuracy": accuracy,
            "confidence": confidence,
            "tokens_used": tokens_used
        }

rag_service = RAGService()
