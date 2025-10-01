from __future__ import annotations

import sys

from PySide6.QtWidgets import QApplication

from state import State
from ui.main_window import MainWindow


def main() -> int:
    """Application entry point."""
    app = QApplication(sys.argv)

    state = State()
    state.set_status_message("Launching Rayform Studio...")

    window = MainWindow()
    window.show()

    return app.exec()


if __name__ == "__main__":
    sys.exit(main())
