# clear_database.py

from db import clear_db

if __name__ == "__main__":
    confirm = input("This will delete all chunks from the database. Are you sure? (y/N): ")
    if confirm.lower() == "y":
        clear_db()
        print("✅ Database cleared!")
    else:
        print("Operation canceled.")
