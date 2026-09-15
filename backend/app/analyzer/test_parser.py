from pathlib import Path

from app.analyzer.parser import parse_python_file


def main():
    test_file = Path("sample_code.py")

    test_file.write_text(
        """
import os
from pathlib import Path

class PaymentService:
    def process_payment(self):
        pass

def calculate_total(amount, tax):
    return amount + tax
""",
        encoding="utf-8",
    )

    result = parse_python_file(str(test_file))

    print("\nClasses:")
    print(result["classes"])

    print("\nFunctions:")
    print(result["functions"])

    print("\nImports:")
    print(result["imports"])

    print("\nSyntax errors:")
    print(result["has_errors"])

    test_file.unlink()


if __name__ == "__main__":
    main()