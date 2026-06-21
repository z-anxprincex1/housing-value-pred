import sys
import json
import os

# Prevent warning prints to stdout which would corrupt the JSON line stream
os.environ['PYTHONWARNINGS'] = 'ignore'

import joblib
import numpy as np
import pandas as pd

# Load models relative to this script
script_dir = os.path.dirname(os.path.abspath(__file__))
rf1_path = os.path.join(script_dir, "models", "rf1_hvp_model.pkl")
rf2_path = os.path.join(script_dir, "models", "rf2_lf_model.pkl")

try:
    rf1 = joblib.load(rf1_path)
    rf2 = joblib.load(rf2_path)
except Exception as e:
    print(json.dumps({"status": "error", "message": f"Failed to load models: {str(e)}"}))
    sys.exit(1)

# Statistical means and standard deviations from training dataset (housingTest.csv)
# Used to scale inputs (Z-score standardization) and descale targets.
stats = {
  "population": {
    "mean": 1425.4767441860465,
    "std": 1132.4621217653375
  },
  "avg_bed": {
    "mean": 1.0970623858069952,
    "std": 0.47610407540203553
  },
  "ocean_proximity_encoded": {
    "mean": 1.4647286821705425,
    "std": 0.8542260477400879
  },
  "housing_median_age": {
    "mean": 28.639486434108527,
    "std": 12.585557612111637
  },
  "median_income": {
    "mean": 3.8706710029069766,
    "std": 1.8998217179452732
  },
  "median_house_value": {
    "mean": 206855.81690891474,
    "std": 115395.6158744132
  },
  "latitude": {
    "mean": 35.63186143410852,
    "std": 2.1359523974571117
  },
  "longitude": {
    "mean": -119.56970445736432,
    "std": 2.003531723502581
  }
}

def scale_val(key, val):
    return (val - stats[key]["mean"]) / stats[key]["std"]

def descale_val(key, val):
    return (val * stats[key]["std"]) + stats[key]["mean"]

# Read JSON strings from stdin, one line per prediction request
for line in sys.stdin:
    if not line.strip():
        continue
    try:
        data = json.loads(line.strip())
        model_type = data.get("type")
        
        # Extracted features
        pop = float(data["population"])
        avg_bed = float(data["avg_bed"])
        ocean_encoded = int(data["ocean_proximity_encoded"])
        median_age = float(data["housing_median_age"])
        
        if model_type == "rf1":
            # Feature ordering: ['population', 'avg_bed', 'ocean_proximity_encoded', 'housing_median_age']
            features = pd.DataFrame([[
                scale_val("population", pop),
                scale_val("avg_bed", avg_bed),
                scale_val("ocean_proximity_encoded", ocean_encoded),
                scale_val("housing_median_age", median_age)
            ]], columns=['population', 'avg_bed', 'ocean_proximity_encoded', 'housing_median_age'])
            pred = rf1.predict(features)[0]
            val = descale_val("median_house_value", pred)
            response = {
                "status": "success",
                "value": val
            }
            
        elif model_type == "rf2":
            # Feature ordering: ['population', 'avg_bed', 'ocean_proximity_encoded', 'housing_median_age', 'median_income']
            income = float(data["median_income"])
            features = pd.DataFrame([[
                scale_val("population", pop),
                scale_val("avg_bed", avg_bed),
                scale_val("ocean_proximity_encoded", ocean_encoded),
                scale_val("housing_median_age", median_age),
                scale_val("median_income", income)
            ]], columns=['population', 'avg_bed', 'ocean_proximity_encoded', 'housing_median_age', 'median_income'])
            pred = rf2.predict(features)[0]
            val = descale_val("median_house_value", pred[0])
            lat = descale_val("latitude", pred[1])
            lng = descale_val("longitude", pred[2])
            response = {
                "status": "success",
                "value": val,
                "latitude": lat,
                "longitude": lng
            }
        else:
            response = {"status": "error", "message": f"Unknown prediction type: {model_type}"}
            
    except Exception as e:
        response = {"status": "error", "message": str(e)}
        
    # Write exactly one line of JSON output and flush immediately
    print(json.dumps(response))
    sys.stdout.flush()
