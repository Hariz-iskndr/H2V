from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session
from database import Landmark, SessionLocal
import joblib
import numpy as np
from typing import List
import os

app = FastAPI(title="H2V Sign Language API")

# Enable CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True, 
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load ML models at startup
MODEL_DIR = os.path.join(os.path.dirname(__file__), 'models') 
svm_model = None
scaler = None
label_encoder = None

# Load models function
@app.on_event("startup")
def load_models():
    global svm_model, scaler, label_encoder
    
    try:
        model_path = os.path.join(MODEL_DIR, 'svm_model.pkl')
        scaler_path = os.path.join(MODEL_DIR, 'scaler.pkl')
        encoder_path = os.path.join(MODEL_DIR, 'label_encoder.pkl')
        
        svm_model = joblib.load(model_path)
        scaler = joblib.load(scaler_path)
        label_encoder = joblib.load(encoder_path)
        
        print("✓ Models loaded successfully!")
        print(f"✓ Available gestures: {label_encoder.classes_}")
    except FileNotFoundError:
        print("⚠️  Warning: Model files not found. Please train the model first.")
        print("   Run: python train_svm.py")
    except Exception as e:
        print(f"❌ Error loading models: {str(e)}")

# Landmark classification request/response models
class LandmarkRequest(BaseModel):
    name: str
    landmarks: str
    description: str

class PredictionRequest(BaseModel):
    landmarks: List[float]

class PredictionResponse(BaseModel):
    gesture: str
    confidence: float
    all_probabilities: dict

# Dependency to get DB session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# === ENDPOINTS ===

@app.get("/")
def root():
    """Health check endpoint"""
    return {
        "message": "H2V Sign Language API",
        "status": "running",
        "model_loaded": svm_model is not None
    }

@app.get("/gestures")
def get_available_gestures():
    #Get list of gestures the model can recognize
    if label_encoder is None:
        raise HTTPException(status_code=503, detail="Model not loaded")
    
    return {
        "gestures": label_encoder.classes_.tolist(),
        "count": len(label_encoder.classes_)
    }

@app.post("/predict")
def predict_gesture(request: PredictionRequest):

    #Predict gesture from hand landmarks
        
    if svm_model is None or scaler is None or label_encoder is None:
        raise HTTPException(
            status_code=503, 
            detail="Model not loaded. Please train the model first."
        )
    
    try:
        # Validate input
        if len(request.landmarks) != 63:
            raise HTTPException(
                status_code=400,
                detail=f"Expected 63 landmark values, got {len(request.landmarks)}"
            )
        
        # Prepare data - predict for both orientations
        X_original = np.array(request.landmarks).reshape(1, -1)
        X_mirrored = X_original.copy()
        X_mirrored[:, 0::3] = 1 - X_mirrored[:, 0::3]  # Mirror x-coordinates
        
        # Scale features
        X_original_scaled = scaler.transform(X_original)
        X_mirrored_scaled = scaler.transform(X_mirrored)
        
        # Predict both
        pred_original = svm_model.predict(X_original_scaled)[0]
        prob_original = svm_model.predict_proba(X_original_scaled)[0]
        
        pred_mirrored = svm_model.predict(X_mirrored_scaled)[0]
        prob_mirrored = svm_model.predict_proba(X_mirrored_scaled)[0]
        
        # Use the prediction with higher confidence
        conf_original = prob_original[pred_original]
        conf_mirrored = prob_mirrored[pred_mirrored]
        
        if conf_original >= conf_mirrored:
            prediction = pred_original
            probabilities = prob_original
        else:
            prediction = pred_mirrored
            probabilities = prob_mirrored
        
        # Get gesture name
        gesture = label_encoder.inverse_transform([prediction])[0]
        confidence = float(probabilities[prediction])
        
        # All probabilities
        all_probs = {
            label_encoder.inverse_transform([i])[0]: float(prob)
            for i, prob in enumerate(probabilities)
        }
        
        return PredictionResponse(
            gesture=gesture,
            confidence=confidence,
            all_probabilities=all_probs
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction error: {str(e)}")

@app.post("/landmarks/")
def save_landmark(landmark: LandmarkRequest, db: Session = Depends(get_db)):
    """Save landmark data to database (for additional training data)"""
    db_landmark = Landmark(
        name=landmark.name,
        landmarks=landmark.landmarks,
        description=landmark.description
    )
    db.add(db_landmark)
    db.commit()
    db.refresh(db_landmark)
    return {"status": "Landmark saved", "data": db_landmark}

@app.get("/landmarks/")
def get_landmarks(db: Session = Depends(get_db)):
    """Retrieve all saved landmarks"""
    landmarks = db.query(Landmark).all()
    return landmarks

@app.get("/stats")
def get_stats(db: Session = Depends(get_db)):
    """Get statistics about saved data"""
    total_landmarks = db.query(Landmark).count()
    
    return {
        "total_saved_landmarks": total_landmarks,
        "model_loaded": svm_model is not None,
        "available_gestures": label_encoder.classes_.tolist() if label_encoder else []
    }
