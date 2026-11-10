# Author: Joel Franusic
from browser import document, html, window, timer
import sys

class DivOut:
    def __init__(self, div_id):
        self.div_id = div_id

    def write(self, output):
        document[self.div_id].clear()
        document[self.div_id] <= output


def runPy(cm):
    code = cm.getValue()
    sys.stdout = cm.options.stdout
    exec(code)

refresh_from_editor_delay_ms = 400

def edit_hook(cm, *arg):
    if cm.typing_delay_timer:
        timer.clear_timeout(cm.typing_delay_timer)
    cm.typing_delay_timer = timer.set_timeout(runPy, refresh_from_editor_delay_ms, cm)

def init_hook(cm):
    cm.typing_delay_timer = None
    edit_hook(cm)
    cm.on("changes", edit_hook)
    cm.on("update", edit_hook)

window.CodeMirror.defineInitHook(init_hook)

for editor in document.select("textarea.live-code"):
    output_id = "output-{}".format(editor.id.split("-")[1])
    window.CodeMirror.fromTextArea(editor, {
        "lineNumbers": True,
        "mode": "python",
        "matchBrackets": True,
        "indentUnit": 4,
        "stdout": DivOut(output_id),
        "outputId": output_id,
        "theme": "neat",
    })
