import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.svm import SVC
from sklearn.metrics import classification_report, confusion_matrix, accuracy_score
import joblib
import os

def load_and_prepare_data(csv_path):
    """Load CSV data and prepare for training"""
    print(f"Loading data from {csv_path}...")
    
    # Read CSV without header
    df = pd.read_csv(csv_path, header=None)
    
    # Last column is the label, rest are features (63 coordinates)
    X = df.iloc[:, :-1].values  # Features (63 columns: x1,y1,z1,...,x21,y21,z21)
    y = df.iloc[:, -1].values   # Labels
    
    print(f"Loaded {len(X)} samples with {X.shape[1]} features")
    
    # DATA AUGMENTATION: Mirror all samples to work with both hands
    print("Augmenting data by mirroring for left/right hand compatibility...")
    X_mirrored = X.copy()
    # Flip x-coordinates (every 3rd value starting from index 0)
    X_mirrored[:, 0::3] = 1 - X_mirrored[:, 0::3]  # Mirror x-coords
    
    # Combine original + mirrored
    X_augmented = np.vstack([X, X_mirrored])
    y_augmented = np.hstack([y, y])
    
    print(f"After augmentation: {len(X_augmented)} samples (2x original)")
    print(f"Classes found: {np.unique(y_augmented)}")
    print(f"Samples per class:")
    for label in np.unique(y_augmented):
        count = np.sum(y_augmented == label)
        print(f"  {label}: {count} samples")
    
    return X_augmented, y_augmented

def preprocess_data(X, y):
    """Normalize features and encode labels"""
    print("\nPreprocessing data...")
    
    # Encode string labels to integers
    label_encoder = LabelEncoder()
    y_encoded = label_encoder.fit_transform(y)
    
    # Normalize features (important for SVM)
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)
    
    return X_scaled, y_encoded, scaler, label_encoder

def train_svm(X_train, y_train):
    """Train SVM classifier"""
    print("\nTraining SVM model...")
    
    # Using RBF kernel with class weights for imbalanced data
    svm_model = SVC(
        kernel='rbf',           # Radial Basis Function kernel
        C=10,                   # Regularization parameter
        gamma='scale',          # Kernel coefficient
        class_weight='balanced', # Handle imbalanced classes
        probability=True,       # Enable probability estimates
        random_state=42
    )
    
    svm_model.fit(X_train, y_train)
    print("Training complete!")
    
    return svm_model

def evaluate_model(model, X_test, y_test, label_encoder):
    """Evaluate model performance"""
    print("\n" + "="*60)
    print("MODEL EVALUATION")
    print("="*60)
    
    # Predictions
    y_pred = model.predict(X_test)
    
    # Accuracy
    accuracy = accuracy_score(y_test, y_pred)
    print(f"\nAccuracy: {accuracy:.2%}")
    
    # Detailed classification report
    print("\nClassification Report:")
    print(classification_report(
        y_test, 
        y_pred, 
        target_names=label_encoder.classes_
    ))
    
    # Confusion Matrix
    print("Confusion Matrix:")
    cm = confusion_matrix(y_test, y_pred)
    print(cm)
    
    return accuracy

def save_model(model, scaler, label_encoder, save_dir=None):
    """Save trained model and preprocessors"""
    if save_dir is None:
        script_dir = os.path.dirname(os.path.abspath(__file__))
        save_dir = os.path.join(script_dir, 'models')  # No 'backend/' needed!
    os.makedirs(save_dir, exist_ok=True)
    
    model_path = os.path.join(save_dir, 'svm_model.pkl')
    scaler_path = os.path.join(save_dir, 'scaler.pkl')
    encoder_path = os.path.join(save_dir, 'label_encoder.pkl')
    
    joblib.dump(model, model_path)
    joblib.dump(scaler, scaler_path)
    joblib.dump(label_encoder, encoder_path)
    
    print(f"\n✓ Model saved to: {model_path}")
    print(f"✓ Scaler saved to: {scaler_path}")
    print(f"✓ Label encoder saved to: {encoder_path}")


def main():
    import os
    script_dir = os.path.dirname(os.path.abspath(__file__))
    CSV_PATH = os.path.join(script_dir, 'data', 'hand_gesture_data.csv') 
    TEST_SIZE = 0.2
    RANDOM_STATE = 42
    
    try:
        # Load data
        X, y = load_and_prepare_data(CSV_PATH)
        
        # Check if we have enough data 
        if len(X) < 5:
            print("\n⚠️  WARNING: Too few samples! Collect at least 10 samples per gesture.")
            return
        
        if len(X) < 25:
            print("\n⚠️  Demo mode: Using minimal samples. For production, collect 50+ per gesture.")
        
        # Preprocess
        X_scaled, y_encoded, scaler, label_encoder = preprocess_data(X, y)
        
        # Split data
        X_train, X_test, y_train, y_test = train_test_split(
            X_scaled, y_encoded, 
            test_size=TEST_SIZE, 
            random_state=RANDOM_STATE,
            stratify=y_encoded  # Maintain class distribution
        )
        
        print(f"\nTraining set: {len(X_train)} samples")
        print(f"Test set: {len(X_test)} samples")
        
        # Train model
        model = train_svm(X_train, y_train)
        
        # Evaluate
        accuracy = evaluate_model(model, X_test, y_test, label_encoder)
        
        # Save if accuracy is reasonable
        if accuracy > 0.4:
            save_model(model, scaler, label_encoder)
            print("\n✅ Model training completed successfully!")
            if accuracy < 0.6:
                print("💡 Tip: Collect more samples to improve accuracy!")
        else:
            print("\n⚠️  Model accuracy is very low. Collect more diverse data!")
            
    except FileNotFoundError:
        print(f"\n❌ Error: CSV file not found at '{CSV_PATH}'")
        print("Please collect data using the web interface first.")
    except Exception as e:
        print(f"\n❌ Error during training: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()