import os
import urllib.request

def download_dataset():
    csv_url = "https://raw.githubusercontent.com/Avik-Jain/100-Days-Of-ML-Code/master/datasets/50_Startups.csv"
    data_dir = os.path.dirname(os.path.abspath(__file__))
    target_path = os.path.join(data_dir, "50_Startups.csv")
    
    print(f"Downloading dataset from: {csv_url}")
    try:
        # Download the file
        urllib.request.urlretrieve(csv_url, target_path)
        print(f"Dataset successfully saved to: {target_path}")
        
        # Verify row count
        with open(target_path, "r", encoding="utf-8") as f:
            lines = f.readlines()
        print(f"Total lines in downloaded file: {len(lines)} (including header)")
        if len(lines) >= 51:
            print("Data download verification: SUCCESS (50 data rows detected)")
        else:
            print(f"Data download verification: WARNING (Expected 51 lines, got {len(lines)})")
            
    except Exception as e:
        print(f"Error downloading dataset: {e}")

if __name__ == "__main__":
    download_dataset()
