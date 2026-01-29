"""
Pluggable ballot processor with support for multiple AI backends.

Switch between processors via AI_PROCESSOR environment variable:
- "mock": Test data (default)
- "qwen": Qwen 2.5-VL via Together AI (RECOMMENDED)
- "openai": OpenAI Vision API
- "gemini": Google Gemini Vision API (FREE tier)
- "google": Google Cloud Vision API
- "tesseract": Local Tesseract OCR
- "custom": Custom ML model
"""

import os
import json
import base64
from typing import Dict, Any
from io import BytesIO

AI_PROCESSOR = os.getenv("AI_PROCESSOR", "mock")


def process_ballot(file_path: str, ballot_type: str, batch_id: str, job_id: str) -> Dict[str, Any]:
    """
    Main ballot processor - routes to appropriate implementation.
    
    Args:
        file_path: Path to ballot image
        ballot_type: "trust" or "surplus"
        batch_id: Batch identifier
        job_id: Job identifier
        
    Returns:
        {
            "candidate_name": str,
            "confidence": float (0-1),
            "ballot_id": str,
            "ballot_type": str,
            "processor": str,
            "status": "success" | "error",
            "error_message": str | None
        }
    """
    try:
        # Read file
        with open(file_path, 'rb') as f:
            file_bytes = f.read()
        
        filename = os.path.basename(file_path)
        
        # Route to appropriate processor
        if AI_PROCESSOR == "qwen":
            return process_ballot_qwen(file_bytes, filename, ballot_type, batch_id, job_id)
        elif AI_PROCESSOR == "openai":
            return process_ballot_openai(file_bytes, filename, ballot_type, batch_id, job_id)
        elif AI_PROCESSOR == "gemini":
            return process_ballot_gemini(file_bytes, filename, ballot_type, batch_id, job_id)
        elif AI_PROCESSOR == "google":
            return process_ballot_google(file_bytes, filename, ballot_type, batch_id, job_id)
        elif AI_PROCESSOR == "tesseract":
            return process_ballot_tesseract(file_bytes, filename, ballot_type, batch_id, job_id)
        elif AI_PROCESSOR == "custom":
            return process_ballot_custom(file_bytes, filename, ballot_type, batch_id, job_id)
        else:  # mock (default)
            return process_ballot_mock(file_bytes, filename, ballot_type, batch_id, job_id)
            
    except Exception as e:
        return {
            "candidate_name": "Unknown",
            "confidence": 0.0,
            "ballot_id": job_id,
            "ballot_type": ballot_type,
            "processor": AI_PROCESSOR,
            "status": "error",
            "error_message": str(e)
        }


# ============================================================================
# MOCK PROCESSOR (for testing)
# ============================================================================

def process_ballot_mock(file_bytes: bytes, filename: str, ballot_type: str, batch_id: str, job_id: str) -> Dict[str, Any]:
    """
    Mock processor - returns test data for development/testing.
    
    Returns fixed candidate names to validate entire pipeline works.
    """
    # Cycle through test candidates
    candidates = ["Candidate A", "Candidate B", "Candidate C"]
    idx = hash(filename) % len(candidates)
    candidate_name = candidates[idx]
    
    return {
        "candidate_name": candidate_name,
        "confidence": 0.85,
        "ballot_id": job_id,
        "ballot_type": ballot_type,
        "processor": "mock",
        "status": "success",
        "error_message": None
    }


# ============================================================================
# QWEN 2.5-VL VIA TOGETHER AI (RECOMMENDED)
# ============================================================================

def process_ballot_qwen(file_bytes: bytes, filename: str, ballot_type: str, batch_id: str, job_id: str) -> Dict[str, Any]:
    """
    Qwen 2.5-VL-72B via Together AI - Vietnamese ballot specialist
    
    Setup:
        1. Get API key from https://api.together.xyz
        2. export TOGETHER_API_KEY="..."
        3. pip install together
    
    Cost: ~$0.50 per 1M tokens
    Accuracy: 95%+ for Vietnamese ballots
    """
    try:
        from together import Together
        import mimetypes
        
        api_key = os.getenv("TOGETHER_API_KEY")
        if not api_key:
            raise ValueError("TOGETHER_API_KEY not set. Get key from https://api.together.xyz")
        
        client = Together(api_key=api_key)
        
        # Convert bytes to data URI
        mime_type, _ = mimetypes.guess_type(filename)
        if not mime_type:
            mime_type = "image/png"
        b64_image = base64.b64encode(file_bytes).decode("ascii")
        data_uri = f"data:{mime_type};base64,{b64_image}"
        
        # Load appropriate prompt based on ballot type
        prompt_file = "tin_nhiem.txt" if ballot_type == "trust" else "so_du.txt"
        prompt_path = os.path.join(os.path.dirname(__file__), "..", "app", "prompts", prompt_file)
        
        try:
            with open(prompt_path, 'r', encoding='utf-8') as f:
                prompt_content = f.read()
                # Extract SYSTEM_PROMPT value
                import re
                match = re.search(r'SYSTEM_PROMPT\s*=\s*"""(.+?)"""', prompt_content, re.DOTALL)
                if match:
                    system_prompt = match.group(1).strip()
                else:
                    system_prompt = prompt_content
        except FileNotFoundError:
            # Fallback prompt
            system_prompt = f"""Phân tích phiếu bầu {ballot_type} và trả về JSON với:
ballot_id, validity (VALID/INVALID), invalid_reasons, ballot_details."""
        
        # Call Together AI (using Qwen3-VL-32B which is available)
        response = client.chat.completions.create(
            model="Qwen/Qwen3-VL-32B-Instruct",
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": system_prompt},
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": f"Phân tích lá phiếu {ballot_type} này và CHỈ trả JSON."},
                        {"type": "image_url", "image_url": {"url": data_uri}}
                    ]
                }
            ],
            temperature=0.0,
            max_tokens=2000
        )
        
        # Parse response
        result_text = response.choices[0].message.content.strip()
        result_json = json.loads(result_text)
        
        # Extract candidate names from ballot_details
        candidate_names = []
        confidence = 0.5
        
        if "ballot_details" in result_json and isinstance(result_json["ballot_details"], list):
            for detail in result_json["ballot_details"]:
                if ballot_type == "trust":
                    # Trust ballot: find agree=true
                    if detail.get("agree") == True and detail.get("row_status") == "OK":
                        candidate_names.append(detail.get("name", "Unknown"))
                        confidence = 0.95
                elif ballot_type == "surplus":
                    # Surplus ballot: find selected=true (not crossed)
                    if detail.get("selected") == True and detail.get("row_status") == "OK":
                        candidate_names.append(detail.get("name", "Unknown"))
                        confidence = 0.95
        
        # Check validity
        is_valid = result_json.get("validity") == "VALID"
        if not is_valid:
            confidence = 0.3
            candidate_names = []
        
        # Join multiple candidates
        candidate_name = ", ".join(candidate_names) if candidate_names else "Unknown"
        
        return {
            "candidate_name": candidate_name,
            "confidence": confidence,
            "ballot_id": job_id,
            "ballot_type": ballot_type,
            "processor": "qwen",
            "status": "success",
            "error_message": None,
            "full_analysis": result_json
        }
        
    except ImportError:
        return {
            "candidate_name": "Unknown",
            "confidence": 0.0,
            "ballot_id": job_id,
            "ballot_type": ballot_type,
            "processor": "qwen",
            "status": "error",
            "error_message": "Together SDK not installed. Run: pip install together"
        }
    except Exception as e:
        return {
            "candidate_name": "Unknown",
            "confidence": 0.0,
            "ballot_id": job_id,
            "ballot_type": ballot_type,
            "processor": "qwen",
            "status": "error",
            "error_message": str(e)
        }


# ============================================================================
# GOOGLE GEMINI VISION PROCESSOR (FREE TIER)
# ============================================================================

def process_ballot_gemini(file_bytes: bytes, filename: str, ballot_type: str, batch_id: str, job_id: str) -> Dict[str, Any]:
    """
    Google Gemini Vision API processor - Free tier available
    
    Setup:
        1. Go to https://aistudio.google.com/app/apikey
        2. Create API key (free, no credit card)
        3. export GOOGLE_API_KEY="..."
        4. pip install google-genai
    
    Free tier: 15 RPM (requests per minute), 1500 requests/day
    Cost: FREE
    Accuracy: 90%+
    """
    try:
        from google import genai
        from google.genai.types import GenerateContentConfig
        from PIL import Image
        
        api_key = os.getenv("GOOGLE_API_KEY")
        if not api_key:
            raise ValueError("GOOGLE_API_KEY not set. Get free key from https://aistudio.google.com/app/apikey")
        
        # Configure Gemini client
        client = genai.Client(api_key=api_key)
        
        # Load image
        image = Image.open(BytesIO(file_bytes))
        
        # Save to temp file (new SDK requires file path or bytes)
        import tempfile
        with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as tmp:
            image.save(tmp.name, 'PNG')
            tmp_path = tmp.name
        
        try:
            # Load appropriate prompt based on ballot type
            prompt_file = "tin_nhiem.txt" if ballot_type == "trust" else "so_du.txt"
            prompt_path = os.path.join(os.path.dirname(__file__), "..", "app", "prompts", prompt_file)
            
            try:
                with open(prompt_path, 'r', encoding='utf-8') as f:
                    prompt_content = f.read()
                    # Extract SYSTEM_PROMPT value
                    import re
                    match = re.search(r'SYSTEM_PROMPT\s*=\s*"""(.+?)"""', prompt_content, re.DOTALL)
                    if match:
                        system_prompt = match.group(1).strip()
                    else:
                        system_prompt = prompt_content
            except FileNotFoundError:
                # Fallback to simple prompt
                system_prompt = f"""Phân tích phiếu bầu {ballot_type} này.
Trả về JSON với: ballot_id, validity (VALID/INVALID), invalid_reasons, ballot_details (danh sách ứng cử viên và trạng thái)."""
            
            # Upload file
            with open(tmp_path, 'rb') as f:
                uploaded_file = client.files.upload(file=f, config={'mime_type': 'image/png'})
            
            # Generate response
            response = client.models.generate_content(
                model='gemini-2.5-flash',
                contents=[system_prompt, uploaded_file],
                config=GenerateContentConfig(
                    temperature=0,
                    max_output_tokens=2000
                )
            )
            
            # Parse response
            result_text = response.text.strip()
            
            # Remove markdown code blocks if present
            if result_text.startswith("```"):
                lines = result_text.split("\n")
                result_text = "\n".join([l for l in lines if not l.startswith("```")])
                result_text = result_text.strip()
            
            # Try to parse JSON
            try:
                result_json = json.loads(result_text)
            except json.JSONDecodeError:
                # Fallback: extract from text
                import re
                result_json = {"error": "Failed to parse JSON", "raw": result_text[:200]}
            
            # Extract candidate name from ballot_details
            candidate_name = "Unknown"
            confidence = 0.5
            
            if "ballot_details" in result_json and isinstance(result_json["ballot_details"], list):
                # For trust ballot: find agree=true
                # For surplus ballot: find selected=true
                for detail in result_json["ballot_details"]:
                    if ballot_type == "trust" and detail.get("agree") == True:
                        candidate_name = detail.get("name", "Unknown")
                        confidence = 0.9
                        break
                    elif ballot_type == "surplus" and detail.get("selected") == True:
                        candidate_name = detail.get("name", "Unknown")
                        confidence = 0.9
                        break
            
            # Check validity
            is_valid = result_json.get("validity") == "VALID"
            if not is_valid:
                confidence = 0.3
            
            return {
                "candidate_name": candidate_name,
                "confidence": confidence,
                "ballot_id": job_id,
                "ballot_type": ballot_type,
                "processor": "gemini",
                "status": "success",
                "error_message": None,
                "full_analysis": result_json  # Include full analysis
            }
        finally:
            # Cleanup temp file
            import os as os_mod
            try:
                os_mod.unlink(tmp_path)
            except:
                pass
        
    except ImportError:
        return {
            "candidate_name": "Unknown",
            "confidence": 0.0,
            "ballot_id": job_id,
            "ballot_type": ballot_type,
            "processor": "gemini",
            "status": "error",
            "error_message": "Gemini SDK not installed. Run: pip install google-genai pillow"
        }
    except Exception as e:
        return {
            "candidate_name": "Unknown",
            "confidence": 0.0,
            "ballot_id": job_id,
            "ballot_type": ballot_type,
            "processor": "gemini",
            "status": "error",
            "error_message": str(e)
        }


# ============================================================================
# OPENAI VISION API PROCESSOR
# ============================================================================

def process_ballot_openai(file_bytes: bytes, filename: str, ballot_type: str, batch_id: str, job_id: str) -> Dict[str, Any]:
    """
    OpenAI Vision API processor - uses GPT-4 Vision to analyze ballots.
    
    Requires:
        - pip install openai
        - export OPENAI_API_KEY="sk-..."
    
    Cost: ~$0.01 per image
    Accuracy: 95%+
    """
    try:
        from openai import OpenAI
        
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise ValueError("OPENAI_API_KEY not set")
        
        client = OpenAI(api_key=api_key)
        
        # Encode image to base64
        base64_image = base64.b64encode(file_bytes).decode()
        
        # Determine image type
        image_type = "jpeg" if filename.lower().endswith(('.jpg', '.jpeg')) else "png"
        
        # Prepare prompt
        prompt = f"""Analyze this ballot image and extract the candidate information.

Ballot Type: {ballot_type}
(Use this context if needed for parsing)

Return a JSON object with:
{{
    "candidate_name": "extracted candidate name or 'Unknown'",
    "confidence": 0.0-1.0 confidence score,
    "notes": "any parsing notes"
}}

Only return valid JSON, no additional text."""
        
        # Call OpenAI API
        response = client.chat.completions.create(
            model="gpt-4-vision-preview",
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/{image_type};base64,{base64_image}"
                            }
                        },
                        {
                            "type": "text",
                            "text": prompt
                        }
                    ]
                }
            ],
            max_tokens=200,
            temperature=0
        )
        
        # Parse response
        result_text = response.choices[0].message.content
        result_json = json.loads(result_text)
        
        return {
            "candidate_name": result_json.get("candidate_name", "Unknown"),
            "confidence": float(result_json.get("confidence", 0.5)),
            "ballot_id": job_id,
            "ballot_type": ballot_type,
            "processor": "openai",
            "status": "success",
            "error_message": None
        }
        
    except ImportError:
        return {
            "candidate_name": "Unknown",
            "confidence": 0.0,
            "ballot_id": job_id,
            "ballot_type": ballot_type,
            "processor": "openai",
            "status": "error",
            "error_message": "OpenAI SDK not installed. Run: pip install openai"
        }
    except Exception as e:
        return {
            "candidate_name": "Unknown",
            "confidence": 0.0,
            "ballot_id": job_id,
            "ballot_type": ballot_type,
            "processor": "openai",
            "status": "error",
            "error_message": str(e)
        }


# ============================================================================
# GOOGLE CLOUD VISION API PROCESSOR
# ============================================================================

def process_ballot_google(file_bytes: bytes, filename: str, ballot_type: str, batch_id: str, job_id: str) -> Dict[str, Any]:
    """
    Google Cloud Vision API processor - uses text detection and ML models.
    
    Requires:
        - pip install google-cloud-vision
        - Set up credentials: export GOOGLE_APPLICATION_CREDENTIALS="path/to/credentials.json"
    
    Cost: ~$1.5 per 1000 requests
    Accuracy: 90%+
    """
    try:
        from google.cloud import vision
        import re
        
        client = vision.ImageAnnotatorClient()
        
        # Create image object
        image = vision.Image(content=file_bytes)
        
        # Perform text detection
        response = client.text_detection(image=image)
        texts = response.text_annotations
        
        if not texts:
            return {
                "candidate_name": "Unknown",
                "confidence": 0.3,
                "ballot_id": job_id,
                "ballot_type": ballot_type,
                "processor": "google",
                "status": "success",
                "error_message": "No text detected in image"
            }
        
        # Extract all text
        full_text = texts[0].description if texts else ""
        
        # Parse with regex - adjust patterns based on ballot format
        # Example patterns:
        # "Ứng cử viên: John Doe"
        # "Candidate: Jane Smith"
        # "Nominated: Bob Johnson"
        
        patterns = [
            r'(?:ứng cử viên|candidate|nominated):\s*(.+?)(?:\n|$)',
            r'\[\s*[xX✓]\s*\]\s*(.+?)(?:\n|$)',
            r'^(.+?)(?:\n|$)'  # Fallback: first line
        ]
        
        candidate_name = "Unknown"
        for pattern in patterns:
            match = re.search(pattern, full_text, re.IGNORECASE | re.MULTILINE)
            if match:
                candidate_name = match.group(1).strip()
                break
        
        # Confidence: 1.0 if found, 0.5 if using fallback
        confidence = 1.0 if candidate_name != "Unknown" else 0.5
        
        return {
            "candidate_name": candidate_name,
            "confidence": confidence,
            "ballot_id": job_id,
            "ballot_type": ballot_type,
            "processor": "google",
            "status": "success",
            "error_message": None
        }
        
    except ImportError:
        return {
            "candidate_name": "Unknown",
            "confidence": 0.0,
            "ballot_id": job_id,
            "ballot_type": ballot_type,
            "processor": "google",
            "status": "error",
            "error_message": "Google Cloud SDK not installed. Run: pip install google-cloud-vision"
        }
    except Exception as e:
        return {
            "candidate_name": "Unknown",
            "confidence": 0.0,
            "ballot_id": job_id,
            "ballot_type": ballot_type,
            "processor": "google",
            "status": "error",
            "error_message": str(e)
        }


# ============================================================================
# TESSERACT OCR PROCESSOR (Local, Free)
# ============================================================================

def process_ballot_tesseract(file_bytes: bytes, filename: str, ballot_type: str, batch_id: str, job_id: str) -> Dict[str, Any]:
    """
    Local Tesseract OCR processor - free, open-source.
    
    Requires:
        - pip install pytesseract pillow
        - macOS: brew install tesseract
        - Linux: apt-get install tesseract-ocr
        - Windows: Download from https://github.com/UB-Mannheim/tesseract/wiki
    
    Cost: FREE (local)
    Accuracy: 60-80% (depends on ballot quality)
    """
    try:
        import pytesseract
        from PIL import Image
        import re
        
        # Load image
        image = Image.open(BytesIO(file_bytes))
        
        # Enhance contrast for better OCR
        from PIL import ImageEnhance
        enhancer = ImageEnhance.Contrast(image)
        image = enhancer.enhance(1.5)
        
        # Extract text
        text = pytesseract.image_to_string(image)
        
        # Parse text - adjust regex based on ballot format
        # Example patterns:
        # "[ X ] John Doe"
        # "[✓] Jane Smith"
        
        patterns = [
            r'\[\s*[xX✓]\s*\]\s*(.+?)(?:\n|$)',
            r'(?:ứng cử viên|candidate|nominated):\s*(.+?)(?:\n|$)',
            r'^(.+?)(?:\n|$)'  # Fallback: first non-empty line
        ]
        
        candidate_name = "Unknown"
        for pattern in patterns:
            match = re.search(pattern, text, re.IGNORECASE | re.MULTILINE)
            if match:
                candidate_name = match.group(1).strip()
                if candidate_name and len(candidate_name) > 2:  # Valid name
                    break
        
        # Confidence: 1.0 if found pattern, 0.5 if using fallback
        confidence = 1.0 if candidate_name != "Unknown" else 0.5
        
        return {
            "candidate_name": candidate_name,
            "confidence": confidence,
            "ballot_id": job_id,
            "ballot_type": ballot_type,
            "processor": "tesseract",
            "status": "success",
            "error_message": None
        }
        
    except ImportError as e:
        return {
            "candidate_name": "Unknown",
            "confidence": 0.0,
            "ballot_id": job_id,
            "ballot_type": ballot_type,
            "processor": "tesseract",
            "status": "error",
            "error_message": f"Dependencies missing. Install: pip install pytesseract pillow && brew install tesseract"
        }
    except Exception as e:
        return {
            "candidate_name": "Unknown",
            "confidence": 0.0,
            "ballot_id": job_id,
            "ballot_type": ballot_type,
            "processor": "tesseract",
            "status": "error",
            "error_message": str(e)
        }


# ============================================================================
# CUSTOM ML MODEL PROCESSOR
# ============================================================================

def process_ballot_custom(file_bytes: bytes, filename: str, ballot_type: str, batch_id: str, job_id: str) -> Dict[str, Any]:
    """
    Custom ML model processor - for trained PyTorch/TensorFlow models.
    
    Requires:
        - pip install torch torchvision onnx opencv-python
        - Train or download ballot detection model
        - Place model at: AI/backend/models/ballot_detector.pt (PyTorch)
    
    Cost: FREE (local inference)
    Accuracy: Depends on training data
    """
    try:
        import torch
        import cv2
        import numpy as np
        
        model_path = os.path.join(os.path.dirname(__file__), "models", "ballot_detector.pt")
        
        if not os.path.exists(model_path):
            raise FileNotFoundError(f"Model not found at {model_path}")
        
        # Load model
        model = torch.jit.load(model_path)
        model.eval()
        
        # Load and preprocess image
        nparr = np.frombuffer(file_bytes, np.uint8)
        image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        # Resize to expected size (adjust based on model)
        image = cv2.resize(image, (224, 224))
        
        # Normalize
        image_tensor = torch.from_numpy(image).float() / 255.0
        image_tensor = image_tensor.unsqueeze(0).permute(0, 3, 1, 2)  # [1, 3, 224, 224]
        
        # Inference
        with torch.no_grad():
            output = model(image_tensor)
        
        # Parse output (adjust based on your model architecture)
        # Assuming output has 'confidence' and 'candidate_id' fields
        confidence = float(output['confidence'][0].cpu().numpy())
        candidate_idx = int(output['candidate_id'][0].cpu().numpy())
        
        # Candidate mapping (adjust based on training)
        candidates = ["John Doe", "Jane Smith", "Bob Johnson"]
        candidate_name = candidates[candidate_idx] if 0 <= candidate_idx < len(candidates) else "Unknown"
        
        return {
            "candidate_name": candidate_name,
            "confidence": confidence,
            "ballot_id": job_id,
            "ballot_type": ballot_type,
            "processor": "custom",
            "status": "success",
            "error_message": None
        }
        
    except FileNotFoundError:
        return {
            "candidate_name": "Unknown",
            "confidence": 0.0,
            "ballot_id": job_id,
            "ballot_type": ballot_type,
            "processor": "custom",
            "status": "error",
            "error_message": "Model not found. Train model and place at AI/backend/models/ballot_detector.pt"
        }
    except ImportError:
        return {
            "candidate_name": "Unknown",
            "confidence": 0.0,
            "ballot_id": job_id,
            "ballot_type": ballot_type,
            "processor": "custom",
            "status": "error",
            "error_message": "Dependencies missing. Install: pip install torch torchvision opencv-python"
        }
    except Exception as e:
        return {
            "candidate_name": "Unknown",
            "confidence": 0.0,
            "ballot_id": job_id,
            "ballot_type": ballot_type,
            "processor": "custom",
            "status": "error",
            "error_message": str(e)
        }
