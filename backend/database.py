from sqlalchemy import create_engine, Column, Integer, String
from sqlalchemy.orm import sessionmaker, declarative_base

# Create database for storing landmarks
DATABASE_URL = "sqlite:///./landmarks.db"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

# Define the landmark table
class Landmark(Base):
    __tablename__ = "landmarks"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    landmarks = Column(String)
    description = Column(String)

# Create the database tables
Base.metadata.create_all(bind=engine)