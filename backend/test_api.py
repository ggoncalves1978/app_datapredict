import traceback
import sys

def run_test():
    print("Testing main module import...")
    try:
        import main
        print("Import SUCCESS")
    except Exception as e:
        print("Import FAILED")
        traceback.print_exc(file=sys.stdout)

if __name__ == "__main__":
    run_test()
