from __future__ import annotations

import sys

from PySide6.QtWidgets import QApplication

from context import Context
from ui.main_window import MainWindow


def main() -> int:
    """Application entry point."""
    app = QApplication(sys.argv)

    context = Context()
    context.set_status_message("Launching Rayform Studio...")

    window = MainWindow()
    window.show()

    return app.exec()


if __name__ == "__main__":
    sys.exit(main())
