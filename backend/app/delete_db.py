import os
from pathlib import Path
import platform

def get_app_data_dir(app_name="Inkling") -> Path:
    """Reproduces the same app data path logic from db.py."""
    system = platform.system()
    if system == "Windows":
        return Path(os.getenv("APPDATA", Path.home() / "AppData" / "Roaming")) / app_name
    elif system == "Darwin":
        return Path.home() / "Library" / "Application Support" / app_name
    else:  # Linux / Unix
        return Path(os.getenv("XDG_DATA_HOME", Path.home() / ".local" / "share")) / app_name

def main():
    app_dir = get_app_data_dir()
    db_path = app_dir / "index.sqlite"

    if not db_path.exists():
        print(f"❌ Database not found at {db_path}")
        return

    print(f"Found database: {db_path}")
    confirm = input("Are you sure you want to delete it? (y/N): ").strip().lower()
    if confirm == "y":
        try:
            os.remove(db_path)
            print("✅ Database deleted successfully.")
        except Exception as e:
            print(f"⚠️ Error deleting database: {e}")
    else:
        print("Aborted. Database not deleted.")

if __name__ == "__main__":
    main()
