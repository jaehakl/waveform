from __future__ import annotations

import sys

from PySide6.QtWidgets import QApplication

from views.main_window import MainWindow


def main() -> int:
    """Application entry point."""
    app = QApplication(sys.argv)

    window = MainWindow()
    window.show()

    return app.exec()


if __name__ == "__main__":
    sys.exit(main())
