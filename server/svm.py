from fastapi import FastAPI, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from database import Landmark, SessionLocal

app = FastAPI()

#Define the structure of landmarks we expect in the request
class LandmarkRequest(BaseModel):
    name: str
    landmarks: str
    description: str
    
# Dependency to get DB session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
        
@app.post("/landmarks/")
def receive_landmark(landmark: LandmarkRequest, db: Session = Depends(get_db)):
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
    landmarks = db.query(Landmark).all()
    return landmarks